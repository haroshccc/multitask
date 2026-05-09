// =============================================================================
// whatsapp-webhook — Supabase Edge Function
// =============================================================================
// Receives inbound WhatsApp messages from Twilio, matches the sender's phone
// to a registered user (profiles.whatsapp_phone_e164), and creates a thought.
//
// Text messages  → Claude Haiku generates a title → thought (processed)
// Audio messages → download from Twilio → upload to R2 → submit to Gladia
//                  → thought created (unprocessed). transcribe-webhook will
//                  fill in ai_generated_title + text_content once Gladia is done.
//
// Required secrets (set in Supabase Dashboard → Settings → Edge Functions):
//   ANTHROPIC_API_KEY       — AI title generation
//   GLADIA_API_KEY          — audio transcription
//   GLADIA_WEBHOOK_TOKEN    — shared secret for Gladia callback URL
//   R2_ACCOUNT_ID           — Cloudflare R2
//   R2_ACCESS_KEY_ID        — Cloudflare R2
//   R2_SECRET_ACCESS_KEY    — Cloudflare R2
//   R2_BUCKET_NAME          — Cloudflare R2 bucket
//   TWILIO_ACCOUNT_SID      — Twilio auth (for downloading media)
//   TWILIO_AUTH_TOKEN       — Twilio auth (for downloading media)
//
// Deploy with verify_jwt = false (Twilio has no Supabase JWT).
// Add to supabase/config.toml:
//   [functions.whatsapp-webhook]
//   verify_jwt = false
// =============================================================================

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.1";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "npm:@aws-sdk/client-s3@3.700.0";
import { getSignedUrl } from "npm:@aws-sdk/s3-request-presigner@3.700.0";

// ---------------------------------------------------------------------------
// Env
// ---------------------------------------------------------------------------

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const GLADIA_API_KEY = Deno.env.get("GLADIA_API_KEY") ?? "";
const GLADIA_WEBHOOK_TOKEN = Deno.env.get("GLADIA_WEBHOOK_TOKEN") ?? "";
const R2_ACCOUNT_ID = Deno.env.get("R2_ACCOUNT_ID") ?? "";
const R2_ACCESS_KEY_ID = Deno.env.get("R2_ACCESS_KEY_ID") ?? "";
const R2_SECRET_ACCESS_KEY = Deno.env.get("R2_SECRET_ACCESS_KEY") ?? "";
const R2_BUCKET_NAME = Deno.env.get("R2_BUCKET_NAME") ?? "";
const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID") ?? "";
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN") ?? "";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Empty TwiML response — tells Twilio we handled the message. */
function twiml(): Response {
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`,
    { headers: { "Content-Type": "application/xml" } }
  );
}

function makeR2Client(): S3Client {
  return new S3Client({
    region: "auto",
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  });
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204 });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  const from = (form.get("From") as string | null) ?? "";
  const body = ((form.get("Body") as string | null) ?? "").trim();
  const numMedia = parseInt((form.get("NumMedia") as string) ?? "0");
  const mediaUrl = form.get("MediaUrl0") as string | null;
  const mediaType = (form.get("MediaContentType0") as string | null) ?? "";
  const messageSid = (form.get("MessageSid") as string | null) ?? "";

  // Twilio sends From as "whatsapp:+972XXXXXXXXX"
  const phone = from.replace(/^whatsapp:/i, "").trim();
  if (!phone) return twiml();

  const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  // Find the user registered with this phone number
  const { data: profile } = await db
    .from("profiles")
    .select("id")
    .eq("whatsapp_phone_e164", phone)
    .maybeSingle();

  if (!profile) {
    // Number not registered — silently ignore (don't reveal app exists)
    console.log("whatsapp_unknown_phone", { phone });
    return twiml();
  }

  const userId = profile.id as string;

  // Get primary organization
  const { data: membership } = await db
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (!membership) return twiml();
  const orgId = membership.organization_id as string;

  // Deduplication — Twilio may retry; skip if already processed
  if (messageSid) {
    const { count } = await db
      .from("thoughts")
      .select("id", { count: "exact", head: true })
      .eq("whatsapp_message_id", messageSid);
    if ((count ?? 0) > 0) {
      console.log("whatsapp_dedup_skip", { messageSid });
      return twiml();
    }
  }

  try {
    if (numMedia > 0 && mediaUrl && mediaType.startsWith("audio/")) {
      await handleAudio({ db, userId, orgId, mediaUrl, mediaType, caption: body || null, messageSid });
    } else if (body) {
      await handleText({ db, userId, orgId, text: body, messageSid });
    }
  } catch (err) {
    console.error("whatsapp_webhook_error", err);
    // Still return 200 so Twilio doesn't retry
  }

  return twiml();
});

// ---------------------------------------------------------------------------
// Text message handler
// ---------------------------------------------------------------------------

async function handleText({
  db, userId, orgId, text, messageSid,
}: {
  db: ReturnType<typeof createClient>;
  userId: string;
  orgId: string;
  text: string;
  messageSid: string;
}) {
  const title = await generateTitle(text);

  const { error } = await db.from("thoughts").insert({
    source: "whatsapp_text",
    status: "processed",
    text_content: text,
    ai_generated_title: title,
    owner_id: userId,
    organization_id: orgId,
    whatsapp_message_id: messageSid || null,
    tags: [],
  });

  if (error) throw new Error(`thought_insert_failed: ${error.message}`);
  console.log("whatsapp_text_thought_created", { userId, chars: text.length });
}

// ---------------------------------------------------------------------------
// Audio / voice note handler
// ---------------------------------------------------------------------------

async function handleAudio({
  db, userId, orgId, mediaUrl, mediaType, caption, messageSid,
}: {
  db: ReturnType<typeof createClient>;
  userId: string;
  orgId: string;
  mediaUrl: string;
  mediaType: string;
  caption: string | null;
  messageSid: string;
}) {
  // 1. Download audio from Twilio (requires basic auth)
  const twilioAuth =
    TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN
      ? `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}`
      : undefined;

  const audioRes = await fetch(mediaUrl, {
    headers: twilioAuth ? { Authorization: twilioAuth } : {},
  });
  if (!audioRes.ok) {
    throw new Error(`twilio_audio_download_failed: ${audioRes.status}`);
  }
  const audioBuffer = await audioRes.arrayBuffer();
  const sizeBytes = audioBuffer.byteLength;

  // 2. Upload to R2
  const ext = mediaType.includes("ogg")
    ? "ogg"
    : mediaType.includes("mp4")
    ? "mp4"
    : mediaType.includes("mpeg")
    ? "mp3"
    : "audio";
  const key = `recordings/whatsapp/${userId}/${crypto.randomUUID()}.${ext}`;

  const r2 = makeR2Client();
  await r2.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: new Uint8Array(audioBuffer),
      ContentType: mediaType,
      ContentLength: sizeBytes,
    })
  );
  console.log("whatsapp_audio_uploaded_r2", { key, sizeBytes });

  // 3. Create recording row
  const placeholderTitle = caption ? await generateTitle(caption) : "הקלטה קולית מווטסאפ";

  const { data: recording, error: recErr } = await (db as any)
    .from("recordings")
    .insert({
      owner_id: userId,
      organization_id: orgId,
      source: "whatsapp",
      storage_provider: "r2",
      storage_key: key,
      mime_type: mediaType,
      size_bytes: sizeBytes,
      status: "uploaded",
      language: "he",
      title: placeholderTitle,
      tags: [],
    })
    .select("id")
    .single();

  if (recErr || !recording) {
    throw new Error(`recording_insert_failed: ${recErr?.message}`);
  }

  // 4. Create thought (unprocessed — transcribe-webhook will fill in transcript + title)
  const { error: thoughtErr } = await db.from("thoughts").insert({
    source: "whatsapp_audio",
    status: "unprocessed",
    ai_generated_title: placeholderTitle,
    text_content: caption ?? null,
    recording_id: recording.id,
    owner_id: userId,
    organization_id: orgId,
    whatsapp_message_id: messageSid || null,
    tags: [],
  });

  if (thoughtErr) throw new Error(`thought_insert_failed: ${thoughtErr.message}`);

  // 5. Submit to Gladia — transcribe-webhook auto-updates thought when done
  if (!GLADIA_API_KEY || !GLADIA_WEBHOOK_TOKEN) {
    console.warn("whatsapp_gladia_not_configured — skipping transcription");
    return;
  }

  const presignedUrl = await getSignedUrl(
    r2,
    new GetObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key }),
    { expiresIn: 3600 }
  );
  const callbackUrl = `${SUPABASE_URL}/functions/v1/transcribe-webhook?token=${encodeURIComponent(GLADIA_WEBHOOK_TOKEN)}`;

  const gladiaRes = await fetch("https://api.gladia.io/v2/pre-recorded", {
    method: "POST",
    headers: {
      "x-gladia-key": GLADIA_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      audio_url: presignedUrl,
      callback_url: callbackUrl,
      diarization: false,
      language_config: { languages: ["he"], code_switching: false },
      detect_language: false,
    }),
  });

  if (!gladiaRes.ok) {
    console.error("whatsapp_gladia_submit_failed", gladiaRes.status);
    return;
  }

  const gladiaJob = (await gladiaRes.json()) as { id?: string };
  if (gladiaJob.id) {
    await (db as any)
      .from("recordings")
      .update({ status: "transcribing", provider: "gladia", provider_job_id: gladiaJob.id })
      .eq("id", recording.id);
    console.log("whatsapp_gladia_job_submitted", { jobId: gladiaJob.id, recordingId: recording.id });
  }
}

// ---------------------------------------------------------------------------
// AI title generation
// ---------------------------------------------------------------------------

async function generateTitle(text: string): Promise<string> {
  const fallback = text.length > 60 ? `${text.substring(0, 57)}...` : text;
  if (!ANTHROPIC_API_KEY) return fallback;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 60,
        messages: [
          {
            role: "user",
            content: `צור כותרת קצרה של 3-6 מילים בשפת המקור למחשבה הבאה. החזר רק את הכותרת, ללא גרשיים וללא הסבר:\n\n${text.substring(0, 800)}`,
          },
        ],
      }),
    });
    if (!res.ok) return fallback;
    const data = await res.json();
    const title = ((data?.content?.[0]?.text ?? "") as string).trim().slice(0, 120);
    return title || fallback;
  } catch {
    return fallback;
  }
}

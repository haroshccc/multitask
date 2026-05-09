// =============================================================================
// parse-image-tasks — Supabase Edge Function
// =============================================================================
// Accepts a base64-encoded image, sends it to Claude Vision, and returns a
// list of task titles extracted from the image (whiteboard, sticky note, etc.)
//
// POST /parse-image-tasks
// Headers: Authorization: Bearer <SUPABASE_ANON_KEY>
// Body:    { image_base64: string, media_type: "image/jpeg"|"image/png"|"image/webp" }
// Returns: { tasks: string[] }
//
// Requires secrets:
//   ANTHROPIC_API_KEY
// =============================================================================

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.1";

const ALLOWED_ORIGINS = new Set<string>([
  "https://multitask-one.vercel.app",
  "http://localhost:5173",
]);

function corsHeaders(origin: string | null): HeadersInit {
  const allowOrigin =
    origin && ALLOWED_ORIGINS.has(origin) ? origin : "https://multitask-one.vercel.app";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Max-Age": "3600",
    Vary: "Origin",
  };
}

function json(body: unknown, status = 200, origin: string | null = null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...corsHeaders(origin) },
  });
}

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

type AllowedMediaType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";

const ALLOWED_MEDIA_TYPES: AllowedMediaType[] = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
];

serve(async (req) => {
  const origin = req.headers.get("origin");

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  if (req.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405, origin);
  }

  // Verify the caller is an authenticated Supabase user (JWT required).
  const authHeader = req.headers.get("Authorization") ?? "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "");
  if (!jwt) return json({ error: "unauthorized" }, 401, origin);

  const service = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  const { data: { user }, error: authErr } = await service.auth.getUser(jwt);
  if (authErr || !user) return json({ error: "unauthorized" }, 401, origin);

  const body = await req.json().catch(() => null) as {
    image_base64?: string;
    media_type?: string;
  } | null;

  if (!body?.image_base64) {
    return json({ error: "missing image_base64" }, 400, origin);
  }

  const mediaType = (body.media_type ?? "image/jpeg") as AllowedMediaType;
  if (!ALLOWED_MEDIA_TYPES.includes(mediaType)) {
    return json({ error: "unsupported media type" }, 400, origin);
  }

  if (!ANTHROPIC_API_KEY) {
    return json({ error: "anthropic_not_configured" }, 503, origin);
  }

  // Rough size guard — base64 of a 5MB image ≈ 6.7MB string
  if (body.image_base64.length > 7_000_000) {
    return json({ error: "image_too_large" }, 413, origin);
  }

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: mediaType,
                  data: body.image_base64,
                },
              },
              {
                type: "text",
                text: `Look at this image. Extract all task items, todo items, action items, or things-to-do that you can see.\n\nReturn ONLY a JSON array of strings — each string is one task title in the original language.\nDo not add explanations, numbering, or any extra text outside the JSON.\n\nExample output:\n["Buy milk", "Call dentist", "Submit report"]\n\nIf you find no tasks, return an empty array: []`,
              },
            ],
          },
        ],
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error("anthropic_error", res.status, errText);
      return json({ error: "ai_error", detail: res.status }, 502, origin);
    }

    const data = await res.json();
    const rawText: string = data?.content?.[0]?.text ?? "";

    // Parse JSON from the model's response, stripping markdown fences if present
    const jsonMatch = rawText.match(/\[[\s\S]*\]/);
    let tasks: string[] = [];
    if (jsonMatch) {
      try {
        tasks = JSON.parse(jsonMatch[0]) as string[];
      } catch {
        tasks = [];
      }
    }

    // Sanitize: keep only non-empty strings, cap at 100 tasks
    tasks = tasks
      .filter((t) => typeof t === "string" && t.trim())
      .map((t) => t.trim())
      .slice(0, 100);

    return json({ tasks }, 200, origin);
  } catch (err) {
    console.error("parse_image_tasks_error", err);
    return json(
      { error: "server_error", message: err instanceof Error ? err.message : String(err) },
      500,
      origin
    );
  }
});

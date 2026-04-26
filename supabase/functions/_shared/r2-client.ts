// Cloudflare R2 client (S3-compatible). Holds the secrets — must NEVER be
// imported from anywhere outside `supabase/functions/`.
//
// Why npm: specifiers — Supabase Edge Functions run Deno, which can pull
// node packages via the npm: prefix. The AWS SDK is the same code that runs
// on Node servers, just imported through Deno's npm compatibility layer.

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  type CompletedPart,
} from "npm:@aws-sdk/client-s3@3.700.0";
import { getSignedUrl } from "npm:@aws-sdk/s3-request-presigner@3.700.0";

const R2_ACCOUNT_ID = Deno.env.get("R2_ACCOUNT_ID")!;
const R2_ACCESS_KEY_ID = Deno.env.get("R2_ACCESS_KEY_ID")!;
const R2_SECRET_ACCESS_KEY = Deno.env.get("R2_SECRET_ACCESS_KEY")!;
export const R2_BUCKET_NAME = Deno.env.get("R2_BUCKET_NAME")!;

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

const PRESIGN_EXPIRES_SECONDS = 15 * 60;
const PRESIGN_GET_EXPIRES_SECONDS = 60 * 60;

export async function presignSingleUpload(opts: {
  key: string;
  contentType: string;
  contentLength?: number;
}): Promise<string> {
  const cmd = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: opts.key,
    ContentType: opts.contentType,
    ContentLength: opts.contentLength,
  });
  return getSignedUrl(r2, cmd, { expiresIn: PRESIGN_EXPIRES_SECONDS });
}

export async function presignDownload(key: string): Promise<string> {
  const cmd = new GetObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key });
  return getSignedUrl(r2, cmd, { expiresIn: PRESIGN_GET_EXPIRES_SECONDS });
}

export async function createMultipart(opts: {
  key: string;
  contentType: string;
}): Promise<{ uploadId: string }> {
  const out = await r2.send(
    new CreateMultipartUploadCommand({
      Bucket: R2_BUCKET_NAME,
      Key: opts.key,
      ContentType: opts.contentType,
    })
  );
  if (!out.UploadId) throw new Error("r2_no_upload_id");
  return { uploadId: out.UploadId };
}

export async function presignUploadParts(opts: {
  key: string;
  uploadId: string;
  partNumbers: number[];
}): Promise<{ partNumber: number; url: string }[]> {
  return Promise.all(
    opts.partNumbers.map(async (partNumber) => {
      const cmd = new UploadPartCommand({
        Bucket: R2_BUCKET_NAME,
        Key: opts.key,
        UploadId: opts.uploadId,
        PartNumber: partNumber,
      });
      const url = await getSignedUrl(r2, cmd, { expiresIn: PRESIGN_EXPIRES_SECONDS });
      return { partNumber, url };
    })
  );
}

export async function completeMultipart(opts: {
  key: string;
  uploadId: string;
  parts: CompletedPart[];
}): Promise<void> {
  await r2.send(
    new CompleteMultipartUploadCommand({
      Bucket: R2_BUCKET_NAME,
      Key: opts.key,
      UploadId: opts.uploadId,
      MultipartUpload: {
        Parts: opts.parts.sort((a, b) => (a.PartNumber ?? 0) - (b.PartNumber ?? 0)),
      },
    })
  );
}

export async function abortMultipart(opts: {
  key: string;
  uploadId: string;
}): Promise<void> {
  await r2.send(
    new AbortMultipartUploadCommand({
      Bucket: R2_BUCKET_NAME,
      Key: opts.key,
      UploadId: opts.uploadId,
    })
  );
}

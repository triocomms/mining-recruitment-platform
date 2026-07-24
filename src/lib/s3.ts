import { S3Client, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import crypto from "crypto";

const s3 = new S3Client({
  region: process.env.S3_REGION ?? "auto",
  endpoint: process.env.S3_ENDPOINT,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },
  forcePathStyle: true, // works with MinIO/R2
});

const BUCKET = process.env.S3_BUCKET!;

// Site-wide hard ceiling: nothing may ever be uploaded above this, no
// matter what an individual kind below specifies. Keeps a typo in a future
// per-kind limit (or a raised one) from ever re-opening the door to
// multi-hundred-MB/GB uploads. Set to 5MB to line up with Seek's upload cap.
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB

export const UPLOAD_RULES = {
  resume: { maxBytes: 5 * 1024 * 1024, types: ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"] },
  coverLetter: { maxBytes: 4 * 1024 * 1024, types: ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"] },
  photo: { maxBytes: 3 * 1024 * 1024, types: ["image/jpeg", "image/png", "image/webp"] },
  logo: { maxBytes: 3 * 1024 * 1024, types: ["image/jpeg", "image/png", "image/webp", "image/svg+xml"] },
  kyb: { maxBytes: 5 * 1024 * 1024, types: ["application/pdf", "image/jpeg", "image/png"] },
  certification: { maxBytes: 5 * 1024 * 1024, types: ["application/pdf", "image/jpeg", "image/png"] },
  employment: { maxBytes: 5 * 1024 * 1024, types: ["application/pdf", "image/jpeg", "image/png"] },
  blogCover: { maxBytes: 5 * 1024 * 1024, types: ["image/jpeg", "image/png", "image/webp"] },
  blogImage: { maxBytes: 5 * 1024 * 1024, types: ["image/jpeg", "image/png", "image/webp"] },
  companyMedia: { maxBytes: 5 * 1024 * 1024, types: ["image/jpeg", "image/png", "image/webp"] },
} as const;

export type UploadKind = keyof typeof UPLOAD_RULES;

/** All objects are private. Access is only ever via short-lived signed URLs
 *  issued after a server-side authorization check.
 *
 *  Uses a presigned POST (not a presigned PUT) specifically so the
 *  `content-length-range` condition below is enforced by S3 itself — a
 *  presigned PUT URL has no way to cap the byte count of the request body,
 *  so a client that ignored the `maxBytes` we hand back (or hit this
 *  endpoint directly, bypassing the browser entirely) could previously PUT
 *  an arbitrarily large — even multi-GB — file straight to the bucket. The
 *  browser-side size check in each upload component is still there as a
 *  fast, friendly pre-check, but this is the real limit. */
export async function presignUpload(userId: string, kind: UploadKind, contentType: string) {
  const rule = UPLOAD_RULES[kind];
  if (!(rule.types as readonly string[]).includes(contentType)) throw new Error("Unsupported file type");
  const maxBytes = Math.min(rule.maxBytes, MAX_UPLOAD_BYTES);
  const key = `${kind}/${userId}/${crypto.randomUUID()}`;
  const { url, fields } = await createPresignedPost(s3, {
    Bucket: BUCKET,
    Key: key,
    Conditions: [
      ["content-length-range", 1, maxBytes],
      ["eq", "$Content-Type", contentType],
    ],
    Fields: { "Content-Type": contentType },
    Expires: 300,
  });
  return { key, url, fields, maxBytes };
}

export async function presignDownload(key: string, expiresIn = 300) {
  return getSignedUrl(s3, new GetObjectCommand({ Bucket: BUCKET, Key: key }), { expiresIn });
}

/** Reads an object's bytes straight into memory — for server-side
 *  processing (resume parsing, P2.7) where the app itself needs the file
 *  content rather than handing the browser a signed URL. Resumes are
 *  capped at 8MB (see UPLOAD_RULES) so buffering fully is fine. */
export async function getObjectBuffer(key: string): Promise<Buffer> {
  const res = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
  const chunks: Buffer[] = [];
  // @ts-expect-error - Body is a Node Readable in the Node runtime, which is
  // all this app targets (see route.ts files' absence of "edge" runtime).
  for await (const chunk of res.Body) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export async function deleteObject(key: string) {
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

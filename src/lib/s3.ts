import { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
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

export const UPLOAD_RULES = {
  resume: { maxBytes: 8 * 1024 * 1024, types: ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"] },
  coverLetter: { maxBytes: 4 * 1024 * 1024, types: ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"] },
  photo: { maxBytes: 3 * 1024 * 1024, types: ["image/jpeg", "image/png", "image/webp"] },
  logo: { maxBytes: 3 * 1024 * 1024, types: ["image/jpeg", "image/png", "image/webp", "image/svg+xml"] },
  kyb: { maxBytes: 10 * 1024 * 1024, types: ["application/pdf", "image/jpeg", "image/png"] },
  certification: { maxBytes: 8 * 1024 * 1024, types: ["application/pdf", "image/jpeg", "image/png"] },
} as const;

export type UploadKind = keyof typeof UPLOAD_RULES;

/** All objects are private. Access is only ever via short-lived signed URLs
 *  issued after a server-side authorization check. */
export async function presignUpload(userId: string, kind: UploadKind, contentType: string) {
  const rule = UPLOAD_RULES[kind];
  if (!(rule.types as readonly string[]).includes(contentType)) throw new Error("Unsupported file type");
  const key = `${kind}/${userId}/${crypto.randomUUID()}`;
  const url = await getSignedUrl(
    s3,
    new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: contentType, ContentLength: undefined }),
    { expiresIn: 300 }
  );
  return { key, url, maxBytes: rule.maxBytes };
}

export async function presignDownload(key: string, expiresIn = 300) {
  return getSignedUrl(s3, new GetObjectCommand({ Bucket: BUCKET, Key: key }), { expiresIn });
}

export async function deleteObject(key: string) {
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, 
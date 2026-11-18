import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { s3, s3Get, s3Put } from "./s3";

// Local disk (UPLOAD_DIR) unless S3_BUCKET is set — use S3/R2 on hosts without a persistent disk (Vercel).
const ROOT = path.resolve(/*turbopackIgnore: true*/ process.env.UPLOAD_DIR ?? "./uploads");

export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

/** Allowed types, identified by their leading bytes — the browser's claimed MIME type is not trusted. */
const TYPES = [
  { mime: "application/pdf", ext: "pdf", magic: [0x25, 0x50, 0x44, 0x46] }, // %PDF
  { mime: "image/jpeg", ext: "jpg", magic: [0xff, 0xd8, 0xff] },
  { mime: "image/png", ext: "png", magic: [0x89, 0x50, 0x4e, 0x47] },
  // .docx is a zip; the extension check below keeps random zips out
  { mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", ext: "docx", magic: [0x50, 0x4b, 0x03, 0x04] },
] as const;

const KEY_RE = /^[\w-]+(\/[\w-]+)*\.(pdf|jpg|png|docx)$/;

export class UploadError extends Error {}

export async function saveUpload(file: File, accept: readonly (typeof TYPES)[number]["ext"][] = ["pdf", "jpg", "png", "docx"]) {
  if (file.size === 0) throw new UploadError("The file is empty.");
  if (file.size > MAX_UPLOAD_BYTES) throw new UploadError("Files must be 4 MB or smaller.");

  const bytes = Buffer.from(await file.arrayBuffer());
  const type = TYPES.find((t) => t.magic.every((b, i) => bytes[i] === b));
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (!type || !accept.includes(type.ext) || (type.ext === "docx" && ext !== "docx")) {
    throw new UploadError(`Only ${new Intl.ListFormat("en-GB").format(accept.map((e) => e.toUpperCase()))} files are allowed.`);
  }

  const now = new Date();
  const key = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${randomUUID()}.${type.ext}`;
  await writeKey(key, bytes);
  return { fileUrl: fileUrlFor(key), mimeType: type.mime, size: bytes.length };
}

export async function writeKey(key: string, bytes: Buffer) {
  const target = resolveKey(key);
  if (s3) return s3Put(key, bytes);
  // turbopackIgnore: uploads are runtime data; never trace them (customer IDs!) into the build output
  await mkdir(/*turbopackIgnore: true*/ path.dirname(target), { recursive: true });
  await writeFile(/*turbopackIgnore: true*/ target, bytes);
}

export async function readKey(key: string): Promise<Buffer | null> {
  const target = resolveKey(key);
  if (s3) return s3Get(key);
  return readFile(/*turbopackIgnore: true*/ target).catch(() => null);
}

export const fileUrlFor = (key: string) => `/api/files/${key}`;
export const keyFromUrl = (fileUrl: string) => fileUrl.replace(/^\/api\/files\//, "");

export function mimeForKey(key: string) {
  const ext = key.split(".").pop();
  return TYPES.find((t) => t.ext === ext)?.mime ?? "application/octet-stream";
}

function resolveKey(key: string) {
  if (!KEY_RE.test(key)) throw new UploadError("Invalid file key.");
  const target = path.resolve(ROOT, key);
  if (!target.startsWith(ROOT + path.sep)) throw new UploadError("Invalid file key.");
  return target;
}

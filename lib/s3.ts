import { createHash, createHmac } from "node:crypto";

/**
 * Minimal S3-compatible object store (AWS S3, Cloudflare R2, MinIO): signed GET and PUT of one
 * object, path-style. Enabled when S3_BUCKET is set; see README → File storage.
 * No "server-only" import so the seed script can use it too.
 */
export const s3 = process.env.S3_BUCKET
  ? {
      bucket: process.env.S3_BUCKET,
      endpoint: (process.env.S3_ENDPOINT ?? "").replace(/\/+$/, ""),
      region: process.env.S3_REGION || "auto",
      accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
    }
  : null;

type Creds = { region: string; accessKeyId: string; secretAccessKey: string };

const sha256 = (data: string | Buffer) => createHash("sha256").update(data).digest("hex");
const hmac = (key: string | Buffer, data: string) => createHmac("sha256", key).update(data).digest();

/**
 * AWS Signature V4 `Authorization` value. `headers` must be lower-case and include host,
 * x-amz-date and x-amz-content-sha256. Object keys are limited to [\w/.-] by lib/storage,
 * so the path needs no extra URI encoding.
 */
export function authorization(method: string, url: URL, headers: Record<string, string>, creds: Creds) {
  const names = Object.keys(headers).sort();
  const canonical = [method, url.pathname, url.search.slice(1), ...names.map((n) => `${n}:${headers[n]!.trim()}`), "", names.join(";"), headers["x-amz-content-sha256"]].join("\n");
  const day = headers["x-amz-date"]!.slice(0, 8);
  const scope = `${day}/${creds.region}/s3/aws4_request`;
  const key = ["s3", "aws4_request"].reduce(hmac, hmac(hmac(`AWS4${creds.secretAccessKey}`, day), creds.region));
  const signature = createHmac("sha256", key).update(["AWS4-HMAC-SHA256", headers["x-amz-date"], scope, sha256(canonical)].join("\n")).digest("hex");
  return `AWS4-HMAC-SHA256 Credential=${creds.accessKeyId}/${scope}, SignedHeaders=${names.join(";")}, Signature=${signature}`;
}

async function request(method: "GET" | "PUT", key: string, body?: Buffer) {
  if (!s3?.endpoint) throw new Error("S3_BUCKET is set but S3_ENDPOINT is missing.");
  const url = new URL(`${s3.endpoint}/${s3.bucket}/${key}`);
  const amz = { "x-amz-content-sha256": sha256(body ?? ""), "x-amz-date": new Date().toISOString().replace(/[-:]|\.\d{3}/g, "") };
  return fetch(url, {
    method,
    // fetch sends Host itself; it is still part of the signature
    headers: { ...amz, authorization: authorization(method, url, { host: url.host, ...amz }, s3) },
    body: body ? new Uint8Array(body) : undefined,
    cache: "no-store",
  });
}

export async function s3Put(key: string, body: Buffer) {
  const res = await request("PUT", key, body);
  if (!res.ok) throw new Error(`S3 upload failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
}

/** Object bytes, or null when the key doesn't exist. */
export async function s3Get(key: string): Promise<Buffer | null> {
  const res = await request("GET", key);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`S3 download failed (${res.status})`);
  return Buffer.from(await res.arrayBuffer());
}

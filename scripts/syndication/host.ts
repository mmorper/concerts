/**
 * Public hosting for a card, for the one channel that cannot take an upload.
 *
 * Instagram's Graph API publishes an image **by URL**: it fetches `image_url` itself.
 * The card only exists in `.renditions/` on the runner, so it goes to a public R2 bucket
 * first, and is deleted once Instagram has published (it keeps its own copy). A 1-day
 * lifecycle rule on the bucket is the backstop for a run that dies in between.
 *
 * R2 speaks the S3 API. Signing is done here with `node:crypto` (AWS Signature V4) rather
 * than pulling in an S3 SDK for two calls. Free tier is the condition this was chosen on
 * (spec: global-instagram-syndication.md, Q1): a few hundred KB stored, a handful of
 * operations a day.
 *
 * Credentials: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET,
 * R2_PUBLIC_URL (the bucket's public r2.dev or custom-domain base URL).
 *
 * `media:publish-video` signs through this class too, with its own bucket and a token scoped
 * to it (the R2_MEDIA_ prefix). Same signing, separate credentials, so neither job can touch
 * the other's objects.
 */

import { createHash, createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { basename, join } from "node:path";

import { ROOT } from "./payload.ts";

export interface HostConfig {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicUrl: string;
}

export function hostConfigFromEnv(env: NodeJS.ProcessEnv = process.env, prefix = "R2"): HostConfig | undefined {
  const accountId = env[`${prefix}_ACCOUNT_ID`];
  const accessKeyId = env[`${prefix}_ACCESS_KEY_ID`];
  const secretAccessKey = env[`${prefix}_SECRET_ACCESS_KEY`];
  const bucket = env[`${prefix}_BUCKET`];
  const publicUrl = env[`${prefix}_PUBLIC_URL`];
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !publicUrl) return undefined;
  return { accountId, accessKeyId, secretAccessKey, bucket, publicUrl: publicUrl.replace(/\/+$/, "") };
}

export interface CardHost {
  /** Upload a repo-relative file and return its public HTTPS URL. */
  publish(path: string): Promise<{ key: string; url: string }>;
  /** Delete a published object. Never throws: the lifecycle rule is the backstop. */
  remove(key: string): Promise<void>;
}

type Fetch = typeof fetch;

export class R2Host implements CardHost {
  constructor(
    private readonly config: HostConfig,
    private readonly fetchImpl: Fetch = fetch,
    private readonly now: () => Date = () => new Date()
  ) {}

  async publish(path: string): Promise<{ key: string; url: string }> {
    const body = readFileSync(join(ROOT, path));
    // Timestamped so a retry or a corrected card never collides with a cached copy.
    const key = `cards/${this.now().getTime()}-${basename(path)}`;
    const res = await this.signed("PUT", key, body, "image/jpeg");
    if (!res.ok) throw new Error(`R2 upload of ${key} failed: ${res.status} ${await res.text()}`);
    return { key, url: `${this.config.publicUrl}/${key}` };
  }

  /** Store bytes at an exact key, for a caller that names its own objects. */
  async put(key: string, body: Buffer, contentType: string, cacheControl?: string): Promise<void> {
    const res = await this.signed("PUT", key, body, contentType, cacheControl);
    if (!res.ok) throw new Error(`R2 upload of ${key} failed: ${res.status} ${await res.text()}`);
  }

  async remove(key: string): Promise<void> {
    try {
      const res = await this.signed("DELETE", key, Buffer.alloc(0));
      if (!res.ok && res.status !== 404) console.warn(`   ⚠️  R2 delete of ${key}: ${res.status}`);
    } catch (err) {
      console.warn(`   ⚠️  R2 delete of ${key}: ${(err as Error).message}`);
    }
  }

  /** AWS Signature V4, region "auto", service "s3" — what R2 expects. */
  private signed(
    method: "PUT" | "DELETE",
    key: string,
    body: Buffer,
    contentType?: string,
    cacheControl?: string
  ): Promise<Response> {
    const { accountId, accessKeyId, secretAccessKey, bucket } = this.config;
    const host = `${accountId}.r2.cloudflarestorage.com`;
    const path = `/${bucket}/${key.split("/").map(encodeURIComponent).join("/")}`;
    const amzDate = this.now().toISOString().replace(/[:-]|\.\d{3}/g, "");
    const day = amzDate.slice(0, 8);
    const payloadHash = sha256(body);

    const headers: Record<string, string> = {
      host,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
      ...(contentType ? { "content-type": contentType } : {}),
      ...(cacheControl ? { "cache-control": cacheControl } : {}),
    };
    const names = Object.keys(headers).sort();
    const canonical = [
      method,
      path,
      "",
      ...names.map((n) => `${n}:${headers[n]}`),
      "",
      names.join(";"),
      payloadHash,
    ].join("\n");
    const scope = `${day}/auto/s3/aws4_request`;
    const toSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256(canonical)].join("\n");
    let k: Buffer = hmac(`AWS4${secretAccessKey}`, day);
    for (const part of ["auto", "s3", "aws4_request"]) k = hmac(k, part);
    const signature = createHmac("sha256", k).update(toSign).digest("hex");

    const { host: _host, ...sent } = headers;
    return this.fetchImpl(`https://${host}${path}`, {
      method,
      headers: {
        ...sent,
        Authorization: `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope}, SignedHeaders=${names.join(";")}, Signature=${signature}`,
      },
      body: method === "PUT" ? new Uint8Array(body) : undefined,
    });
  }
}

function sha256(data: string | Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

function hmac(key: string | Buffer, data: string): Buffer {
  return createHmac("sha256", key).update(data).digest();
}

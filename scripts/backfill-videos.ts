/**
 * Standalone script to download videos and stream them to R2.
 * Runs outside Next.js to avoid OOM crashes with large files.
 *
 * Usage: npx tsx scripts/backfill-videos.ts [--limit 10] [--dry-run]
 */

import { config } from "dotenv";
config({ path: ".env.local" });
config(); // also load .env as fallback
import { S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { Readable } from "stream";
import pg from "pg";

const DATABASE_URL = process.env.DATABASE_URL!;
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID!;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID!;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY!;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME!;

// Parse args
const args = process.argv.slice(2);
const limitIdx = args.indexOf("--limit");
const limit = limitIdx >= 0 ? parseInt(args[limitIdx + 1], 10) : 60;
const dryRun = args.includes("--dry-run");

function getS3Client(): S3Client {
  return new S3Client({
    region: "auto",
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  });
}

function extractExtension(url: string): string {
  const urlPath = url.split("?")[0];
  const ext = urlPath.split(".").pop()?.toLowerCase();
  if (ext && ext.length <= 5 && /^[a-z0-9]+$/.test(ext)) return ext;
  return "mp4";
}

async function streamUpload(key: string, stream: Readable, contentType: string): Promise<void> {
  const client = getS3Client();
  const upload = new Upload({
    client,
    params: {
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: stream,
      ContentType: contentType,
    },
    queueSize: 1,
    partSize: 10 * 1024 * 1024, // 10MB parts
  });

  upload.on("httpUploadProgress", (progress) => {
    if (progress.loaded) {
      const mb = (progress.loaded / (1024 * 1024)).toFixed(1);
      process.stdout.write(`\r    Uploaded: ${mb}MB`);
    }
  });

  await upload.done();
  process.stdout.write("\n");
}

async function downloadAndUpload(
  mediaId: string,
  contentItemId: string,
  originalUrl: string
): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 600_000); // 10 min timeout

  try {
    const response = await fetch(originalUrl, {
      signal: controller.signal,
      headers: { "User-Agent": "Scrollback/1.0" },
    });
    clearTimeout(timeout);

    if (!response.ok) {
      console.log(`    SKIP: HTTP ${response.status}`);
      return null;
    }

    if (!response.body) {
      console.log("    SKIP: No response body");
      return null;
    }

    const contentType = response.headers.get("content-type") || "video/mp4";
    const ext = extractExtension(originalUrl);
    const key = `media/${contentItemId}/${mediaId}.${ext}`;

    // Convert web ReadableStream to Node Readable for S3 Upload
    const nodeStream = Readable.fromWeb(response.body as import("stream/web").ReadableStream);

    await streamUpload(key, nodeStream, contentType);
    return key;
  } catch (error) {
    clearTimeout(timeout);
    console.log(`    ERROR: ${error instanceof Error ? error.message : error}`);
    return null;
  }
}

async function main() {
  // Validate env
  if (!DATABASE_URL) { console.error("Missing DATABASE_URL"); process.exit(1); }
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME) {
    console.error("Missing R2 env vars"); process.exit(1);
  }

  console.log(`Video backfill — limit: ${limit}, dry-run: ${dryRun}\n`);

  const pool = new pg.Pool({ connectionString: DATABASE_URL });

  try {
    const { rows } = await pool.query(
      `SELECT id, content_item_id, original_url
       FROM media
       WHERE stored_path IS NULL AND media_type = 'video'
       ORDER BY id ASC
       LIMIT $1`,
      [limit]
    );

    console.log(`Found ${rows.length} videos to download\n`);

    let success = 0;
    let failed = 0;

    for (let i = 0; i < rows.length; i++) {
      const { id, content_item_id, original_url } = rows[i];
      console.log(`[${i + 1}/${rows.length}] ${original_url.slice(0, 80)}...`);

      if (dryRun) {
        console.log("    DRY RUN — skipped\n");
        continue;
      }

      const storedPath = await downloadAndUpload(id, content_item_id, original_url);

      if (storedPath) {
        await pool.query(
          `UPDATE media SET stored_path = $1 WHERE id = $2`,
          [storedPath, id]
        );
        console.log(`    OK: ${storedPath}\n`);
        success++;
      } else {
        failed++;
        console.log("");
      }
    }

    console.log(`\nDone! Success: ${success}, Failed: ${failed}`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

import { createWriteStream, existsSync, mkdirSync, statSync } from "fs";
import { writeFile } from "fs/promises";
import path from "path";
import { pipeline } from "stream/promises";
import { Readable } from "stream";
import { config } from "dotenv";
import pg from "pg";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  S3Client,
  type _Object,
} from "@aws-sdk/client-s3";

config({ path: ".env.local" });
config();

type R2Object = {
  key: string;
  size: number;
  etag?: string;
  lastModified?: string;
};

type Options = {
  prefix: string;
  outDir: string;
  download: boolean;
  deleteAfterDownload: boolean;
  confirmDelete: boolean;
  limit?: number;
};

const DELETE_CONFIRMATION = "DELETE_ORPHAN_R2_OBJECTS";

function parseArgs(): Options {
  const args = process.argv.slice(2);
  const options: Options = {
    prefix: "media/",
    outDir: path.join(
      "backups",
      "r2-orphans",
      new Date().toISOString().replace(/[:.]/g, "-")
    ),
    download: false,
    deleteAfterDownload: false,
    confirmDelete: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--download") {
      options.download = true;
      continue;
    }
    if (arg === "--delete") {
      options.deleteAfterDownload = true;
      continue;
    }
    if (arg === "--confirm" && args[i + 1] === DELETE_CONFIRMATION) {
      options.confirmDelete = true;
      i++;
      continue;
    }
    if (arg === "--prefix" && args[i + 1]) {
      options.prefix = args[++i];
      continue;
    }
    if (arg === "--out" && args[i + 1]) {
      options.outDir = args[++i];
      continue;
    }
    if (arg === "--limit" && args[i + 1]) {
      options.limit = Math.max(1, Number.parseInt(args[++i], 10));
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  if (options.deleteAfterDownload && (!options.download || !options.confirmDelete)) {
    throw new Error(
      `Deleting requires both --download and --confirm ${DELETE_CONFIRMATION}`
    );
  }

  return options;
}

function printHelp() {
  console.log(`
Usage:
  npx tsx scripts/r2-orphan-cleanup.ts [options]

Safe dry-run inventory:
  npx tsx scripts/r2-orphan-cleanup.ts

Download orphaned objects:
  npx tsx scripts/r2-orphan-cleanup.ts --download

Download and delete orphaned objects:
  npx tsx scripts/r2-orphan-cleanup.ts --download --delete --confirm ${DELETE_CONFIRMATION}

Options:
  --prefix <prefix>  R2 prefix to inspect. Default: media/
  --out <dir>        Backup output directory. Default: backups/r2-orphans/<timestamp>
  --limit <n>        Limit orphan processing, useful for test runs.
`);
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function createR2Client(): S3Client {
  return new S3Client({
    region: "auto",
    endpoint: `https://${requireEnv("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: requireEnv("R2_ACCESS_KEY_ID"),
      secretAccessKey: requireEnv("R2_SECRET_ACCESS_KEY"),
    },
  });
}

function normalizeStoredPath(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed || /^https?:\/\//i.test(trimmed)) return null;
  if (trimmed.startsWith("/api/r2/")) return trimmed.replace(/^\/api\/r2\//, "");
  return trimmed.replace(/^\/+/, "");
}

function localPathForKey(outDir: string, key: string): string {
  const normalizedKey = key.replace(/^\/+/, "");
  return path.join(outDir, "objects", normalizedKey);
}

async function loadReferencedKeys(): Promise<Set<string>> {
  const databaseUrl = requireEnv("DATABASE_URL");
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const result = await client.query<{ stored_path: string }>(
      `
        SELECT DISTINCT stored_path
        FROM media
        WHERE stored_path IS NOT NULL
          AND stored_path <> ''
      `
    );

    const keys = new Set<string>();
    for (const row of result.rows) {
      const key = normalizeStoredPath(row.stored_path);
      if (key) keys.add(key);
    }
    return keys;
  } finally {
    await client.end();
  }
}

async function listR2Objects(client: S3Client, prefix: string): Promise<R2Object[]> {
  const bucket = requireEnv("R2_BUCKET_NAME");
  const objects: R2Object[] = [];
  let ContinuationToken: string | undefined;

  do {
    const response = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken,
      })
    );

    for (const object of response.Contents ?? []) {
      const normalized = normalizeR2Object(object);
      if (normalized) objects.push(normalized);
    }

    ContinuationToken = response.NextContinuationToken;
  } while (ContinuationToken);

  return objects;
}

function normalizeR2Object(object: _Object): R2Object | null {
  if (!object.Key) return null;
  return {
    key: object.Key,
    size: object.Size ?? 0,
    etag: object.ETag,
    lastModified: object.LastModified?.toISOString(),
  };
}

async function downloadObject(
  client: S3Client,
  object: R2Object,
  outDir: string
): Promise<string> {
  const bucket = requireEnv("R2_BUCKET_NAME");
  const targetPath = localPathForKey(outDir, object.key);
  mkdirSync(path.dirname(targetPath), { recursive: true });

  if (existsSync(targetPath) && statSync(targetPath).size === object.size) {
    return targetPath;
  }

  const response = await client.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: object.key,
    })
  );

  if (!response.Body) throw new Error(`No body returned for ${object.key}`);

  await pipeline(response.Body as Readable, createWriteStream(targetPath));
  return targetPath;
}

async function deleteObject(client: S3Client, key: string): Promise<void> {
  await client.send(
    new DeleteObjectCommand({
      Bucket: requireEnv("R2_BUCKET_NAME"),
      Key: key,
    })
  );
}

function sumBytes(objects: R2Object[]): number {
  return objects.reduce((sum, object) => sum + object.size, 0);
}

function formatBytes(bytes: number): string {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(unit === 0 ? 0 : 2)} ${units[unit]}`;
}

async function main() {
  const options = parseArgs();
  const r2 = createR2Client();

  console.log(`[r2-orphans] Loading referenced DB media keys...`);
  const referencedKeys = await loadReferencedKeys();
  console.log(`[r2-orphans] DB references: ${referencedKeys.size}`);

  console.log(`[r2-orphans] Listing R2 objects under ${options.prefix}...`);
  const allObjects = await listR2Objects(r2, options.prefix);
  console.log(`[r2-orphans] R2 objects: ${allObjects.length}`);

  let orphaned = allObjects.filter((object) => !referencedKeys.has(object.key));
  if (options.limit) orphaned = orphaned.slice(0, options.limit);

  mkdirSync(options.outDir, { recursive: true });
  const manifestPath = path.join(options.outDir, "manifest.json");
  await writeFile(
    manifestPath,
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        prefix: options.prefix,
        bucket: process.env.R2_BUCKET_NAME,
        dry_run: !options.download,
        delete_after_download: options.deleteAfterDownload,
        r2_object_count: allObjects.length,
        db_reference_count: referencedKeys.size,
        orphan_count: orphaned.length,
        orphan_bytes: sumBytes(orphaned),
        orphan_human_size: formatBytes(sumBytes(orphaned)),
        objects: orphaned,
      },
      null,
      2
    )
  );

  console.log(`[r2-orphans] Orphans: ${orphaned.length}`);
  console.log(`[r2-orphans] Orphan size: ${formatBytes(sumBytes(orphaned))}`);
  console.log(`[r2-orphans] Manifest: ${manifestPath}`);

  if (!options.download) {
    console.log("[r2-orphans] Dry run only. No files downloaded or deleted.");
    return;
  }

  const downloaded: Array<R2Object & { local_path: string; deleted?: boolean }> = [];
  const failed: Array<R2Object & { error: string }> = [];

  for (const [index, object] of Array.from(orphaned.entries())) {
    try {
      console.log(
        `[r2-orphans] Ensuring local backup ${index + 1}/${orphaned.length}: ${object.key}`
      );
      const localPath = await downloadObject(r2, object, options.outDir);
      const record: R2Object & { local_path: string; deleted?: boolean } = {
        ...object,
        local_path: localPath,
      };

      if (options.deleteAfterDownload) {
        await deleteObject(r2, object.key);
        record.deleted = true;
        console.log(`[r2-orphans] Deleted from R2: ${object.key}`);
      }

      downloaded.push(record);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[r2-orphans] Failed ${object.key}: ${message}`);
      failed.push({ ...object, error: message });
    }
  }

  const resultPath = path.join(options.outDir, "result.json");
  await writeFile(
    resultPath,
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        downloaded_count: downloaded.length,
        deleted_count: downloaded.filter((record) => record.deleted).length,
        failed_count: failed.length,
        downloaded,
        failed,
      },
      null,
      2
    )
  );

  console.log(`[r2-orphans] Result: ${resultPath}`);
  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

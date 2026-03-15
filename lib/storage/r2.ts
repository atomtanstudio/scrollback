import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { Readable } from "stream";

const REQUIRED_ENV_VARS = [
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET_NAME",
] as const;

export function isR2Configured(): boolean {
  return REQUIRED_ENV_VARS.every((key) => !!process.env[key]);
}

let _client: S3Client | null = null;

function getClient(): S3Client {
  if (!_client) {
    _client = new S3Client({
      region: "auto",
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    });
  }
  return _client;
}

export async function uploadMedia(
  key: string,
  body: Buffer,
  contentType: string
): Promise<string> {
  const client = getClient();
  await client.send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
  return key;
}

/**
 * Stream upload for large files — uses S3 multipart upload
 * so we never hold the entire file in memory.
 */
export async function uploadMediaStream(
  key: string,
  body: Readable | ReadableStream,
  contentType: string
): Promise<string> {
  const client = getClient();
  const nodeStream = body instanceof Readable ? body : Readable.fromWeb(body as import("stream/web").ReadableStream);

  const upload = new Upload({
    client,
    params: {
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: key,
      Body: nodeStream,
      ContentType: contentType,
    },
    queueSize: 1, // limit concurrency to keep memory low
    partSize: 10 * 1024 * 1024, // 10MB parts
  });

  await upload.done();
  return key;
}

export async function getR2Object(
  key: string,
  range?: string
): Promise<{
  body: ReadableStream;
  contentType: string;
  contentLength: number | undefined;
  contentRange?: string;
  acceptRanges?: string;
  statusCode?: number;
} | null> {
  const client = getClient();
  try {
    const response = await client.send(
      new GetObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME!,
        Key: key,
        Range: range,
      })
    );
    if (!response.Body) return null;

    // Wrap the SDK stream so that enqueue-after-close (client disconnect) is
    // silently caught instead of crashing the process as an uncaughtException.
    const sdkStream = response.Body as import("stream").Readable;
    const safeStream = new ReadableStream({
      start(controller) {
        sdkStream.on("data", (chunk: Buffer) => {
          try {
            controller.enqueue(new Uint8Array(chunk));
          } catch {
            // Controller already closed (client disconnected) — ignore
            sdkStream.destroy();
          }
        });
        sdkStream.on("end", () => {
          try { controller.close(); } catch { /* already closed */ }
        });
        sdkStream.on("error", (err: Error) => {
          try { controller.error(err); } catch { /* already closed */ }
        });
      },
      cancel() {
        sdkStream.destroy();
      },
    });

    return {
      body: safeStream,
      contentType: response.ContentType || "application/octet-stream",
      contentLength: response.ContentLength,
      contentRange: response.ContentRange,
      acceptRanges: response.AcceptRanges,
      statusCode: response.$metadata.httpStatusCode,
    };
  } catch (err) {
    const code = (err as { Code?: string; name?: string }).Code || (err as { name?: string }).name;
    console.error(`R2 getObject failed for key="${key}" bucket="${process.env.R2_BUCKET_NAME}":`, code, err instanceof Error ? err.message : err);
    return null;
  }
}

export async function deleteMedia(key: string): Promise<void> {
  const client = getClient();
  await client.send(
    new DeleteObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: key,
    })
  );
}

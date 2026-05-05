import { lookup as defaultDnsLookup } from "dns/promises";
import http from "http";
import https from "https";
import net from "net";
import { Readable } from "stream";

type LookupAddress = {
  address: string;
  family: 4 | 6;
};

type SafeUrlOptions = {
  lookup?: (hostname: string) => Promise<LookupAddress[]>;
};

const BLOCKED_HOSTNAMES = new Set(["localhost", "localhost.localdomain"]);

type SafeHttpUrl = {
  url: URL;
  addresses: LookupAddress[];
};

type SafeFetchOptions = SafeUrlOptions & {
  maxRedirects?: number;
  request?: (safeUrl: SafeHttpUrl, init: RequestInit) => Promise<Response>;
};

function parseIpv4(address: string): number[] | null {
  const parts = address.split(".");
  if (parts.length !== 4) return null;
  const octets = parts.map((part) => Number(part));
  if (octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) {
    return null;
  }
  return octets;
}

function isBlockedIpv4(address: string): boolean {
  const octets = parseIpv4(address);
  if (!octets) return true;
  const [a, b] = octets;

  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

function isBlockedIpv6(address: string): boolean {
  const lower = address.toLowerCase();
  if (lower === "::" || lower === "::1") return true;

  if (lower.startsWith("::ffff:")) {
    const mappedIpv4 = lower.slice("::ffff:".length);
    if (net.isIP(mappedIpv4) === 4) return isBlockedIpv4(mappedIpv4);
  }

  const firstHextetText = lower.split(":").find(Boolean);
  const firstHextet = firstHextetText ? parseInt(firstHextetText, 16) : 0;
  if (!Number.isFinite(firstHextet)) return true;

  return (
    (firstHextet & 0xfe00) === 0xfc00 ||
    (firstHextet & 0xffc0) === 0xfe80 ||
    (firstHextet & 0xff00) === 0xff00
  );
}

function isBlockedIpAddress(address: string): boolean {
  const family = net.isIP(address);
  if (family === 4) return isBlockedIpv4(address);
  if (family === 6) return isBlockedIpv6(address);
  return true;
}

export async function assertSafeHttpUrl(
  rawUrl: string,
  options: SafeUrlOptions = {}
): Promise<URL> {
  return (await resolveSafeHttpUrl(rawUrl, options)).url;
}

async function resolveSafeHttpUrl(
  rawUrl: string,
  options: SafeUrlOptions = {}
): Promise<SafeHttpUrl> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("Invalid URL");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only HTTP URLs are allowed");
  }

  if (url.username || url.password) {
    throw new Error("URL credentials are not allowed");
  }

  const hostname = url.hostname.toLowerCase().replace(/^\[(.*)\]$/, "$1");
  if (!hostname || BLOCKED_HOSTNAMES.has(hostname) || hostname.endsWith(".localhost")) {
    throw new Error(`Host "${hostname}" is not allowed`);
  }

  if (net.isIP(hostname)) {
    if (isBlockedIpAddress(hostname)) {
      throw new Error(`Host "${hostname}" resolves to a private or reserved address`);
    }
    return { url, addresses: [{ address: hostname, family: net.isIP(hostname) as 4 | 6 }] };
  }

  const lookup = options.lookup ?? (async (host: string) =>
    defaultDnsLookup(host, { all: true, verbatim: true }) as Promise<LookupAddress[]>);
  const addresses = await lookup(hostname);

  if (addresses.length === 0) {
    throw new Error(`Host "${hostname}" did not resolve`);
  }

  if (addresses.some(({ address }) => isBlockedIpAddress(address))) {
    throw new Error(`Host "${hostname}" resolves to a private or reserved address`);
  }

  return { url, addresses };
}

function buildHostHeader(url: URL): string {
  return url.host;
}

function requestBodyFromInit(body: BodyInit | null | undefined): string | Buffer | Uint8Array | undefined {
  if (!body) return undefined;
  if (typeof body === "string" || body instanceof URLSearchParams) return body.toString();
  if (body instanceof ArrayBuffer) return Buffer.from(body);
  if (ArrayBuffer.isView(body)) return Buffer.from(body.buffer, body.byteOffset, body.byteLength);
  if (body instanceof Blob) {
    throw new Error("Blob request bodies are not supported by safeFetch");
  }
  throw new Error("Streaming request bodies are not supported by safeFetch");
}

function headersFromIncoming(headers: http.IncomingHttpHeaders): Headers {
  const result = new Headers();
  for (const [key, value] of Object.entries(headers)) {
    if (typeof value === "string") {
      result.append(key, value);
    } else if (Array.isArray(value)) {
      for (const item of value) result.append(key, item);
    }
  }
  return result;
}

function isNullBodyStatus(statusCode: number): boolean {
  return statusCode === 204 || statusCode === 205 || statusCode === 304;
}

async function fetchPinnedAddress(
  safeUrl: SafeHttpUrl,
  init: RequestInit
): Promise<Response> {
  const { url, addresses } = safeUrl;
  const address = addresses[0];
  const isHttps = url.protocol === "https:";
  const transport = isHttps ? https : http;
  const headers = new Headers(init.headers);
  headers.set("host", buildHostHeader(url));

  const body = requestBodyFromInit(init.body);
  const port = url.port ? Number(url.port) : isHttps ? 443 : 80;

  return new Promise<Response>((resolve, reject) => {
    const request = transport.request(
      {
        protocol: url.protocol,
        hostname: address.address,
        family: address.family,
        port,
        method: init.method || "GET",
        path: `${url.pathname}${url.search}`,
        headers: Object.fromEntries(headers.entries()),
        signal: init.signal ?? undefined,
        servername: isHttps ? url.hostname.replace(/^\[(.*)\]$/, "$1") : undefined,
      },
      (incoming) => {
        const status = incoming.statusCode ?? 0;
        const responseBody = isNullBodyStatus(status)
          ? null
          : (Readable.toWeb(incoming) as ReadableStream<Uint8Array>);
        resolve(
          new Response(responseBody, {
            status,
            statusText: incoming.statusMessage,
            headers: headersFromIncoming(incoming.headers),
          })
        );
      }
    );

    request.on("error", reject);
    if (body) request.write(body);
    request.end();
  });
}

export async function safeFetch(
  rawUrl: string,
  init: RequestInit = {},
  options: SafeFetchOptions = {}
): Promise<Response> {
  const maxRedirects = options.maxRedirects ?? 3;
  let currentUrl = rawUrl;

  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount++) {
    const safeUrl = await resolveSafeHttpUrl(currentUrl, options);
    const request = options.request ?? fetchPinnedAddress;
    const response = await request(safeUrl, { ...init, redirect: "manual" });
    const url = safeUrl.url;

    if (
      response.status >= 300 &&
      response.status < 400 &&
      response.headers.has("location")
    ) {
      if (redirectCount === maxRedirects) {
        throw new Error("Too many redirects");
      }
      currentUrl = new URL(response.headers.get("location")!, url).href;
      continue;
    }

    return response;
  }

  throw new Error("Too many redirects");
}

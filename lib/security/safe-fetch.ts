import { lookup as defaultDnsLookup } from "dns/promises";
import net from "net";

type LookupAddress = {
  address: string;
  family: 4 | 6;
};

type SafeUrlOptions = {
  lookup?: (hostname: string) => Promise<LookupAddress[]>;
};

type SafeFetchOptions = SafeUrlOptions & {
  maxRedirects?: number;
};

const BLOCKED_HOSTNAMES = new Set(["localhost", "localhost.localdomain"]);

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

  const hostname = url.hostname.toLowerCase();
  if (!hostname || BLOCKED_HOSTNAMES.has(hostname) || hostname.endsWith(".localhost")) {
    throw new Error(`Host "${hostname}" is not allowed`);
  }

  if (net.isIP(hostname)) {
    if (isBlockedIpAddress(hostname)) {
      throw new Error(`Host "${hostname}" resolves to a private or reserved address`);
    }
    return url;
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

  return url;
}

export async function safeFetch(
  rawUrl: string,
  init: RequestInit = {},
  options: SafeFetchOptions = {}
): Promise<Response> {
  const maxRedirects = options.maxRedirects ?? 3;
  let currentUrl = rawUrl;

  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount++) {
    const url = await assertSafeHttpUrl(currentUrl, options);
    const response = await fetch(url.href, { ...init, redirect: "manual" });

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

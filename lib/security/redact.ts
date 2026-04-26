const URL_CREDENTIALS_RE =
  /((?:postgres(?:ql)?|mysql|mariadb|mongodb(?:\+srv)?):\/\/)([^/\s:@]+)(?::([^@\s/]+))?@/gi;
const QUERY_SECRET_RE =
  /([?&](?:key|api_key|token|access_token|refresh_token|client_secret)=)([^&\s]+)/gi;
const ENV_SECRET_RE =
  /\b(DATABASE_URL|GEMINI_API_KEY|OPENAI_API_KEY|CAPTURE_SECRET|XAPI_BEARER_TOKEN|XAPI_CLIENT_SECRET|SUPABASE_SERVICE_KEY|SUPABASE_ANON_KEY)\s*=\s*([^\s]+)/gi;
const LABELLED_SECRET_RE =
  /\b(api[_-]?key|secret|token|password|client[_-]?secret|access[_-]?token|refresh[_-]?token)\b(\s*[:=]\s*)(["']?)([^"'\s,}]+)(["']?)/gi;
const BEARER_RE = /(Bearer\s+)([A-Za-z0-9._~-]+)/gi;

export function redactSensitiveText(value: string): string {
  return value
    .replace(URL_CREDENTIALS_RE, "$1[redacted]:[redacted]@")
    .replace(QUERY_SECRET_RE, "$1[redacted]")
    .replace(ENV_SECRET_RE, "$1=[redacted]")
    .replace(BEARER_RE, "$1[redacted]")
    .replace(
      LABELLED_SECRET_RE,
      (
        _match,
        label: string,
        separator: string,
        openingQuote: string,
        _value: string,
        closingQuote: string
      ) => {
        const start = openingQuote || closingQuote;
        const end = closingQuote || openingQuote;
        const wrapped = start || end ? `${start}[redacted]${end}` : "[redacted]";
        return `${label}${separator}${wrapped}`;
      }
    );
}

export function sanitizeErrorMessage(
  error: unknown,
  fallback: string = "Request failed"
): string {
  if (error instanceof Error && error.message) {
    return redactSensitiveText(error.message);
  }
  if (typeof error === "string" && error) {
    return redactSensitiveText(error);
  }
  return fallback;
}

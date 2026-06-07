const DEFAULT_REQUEST_TIMEOUT_MS = 30000;

export function getRequestTimeoutMs(envValue: string | undefined = process.env.REQUEST_TIMEOUT_MS): number {
  const trimmed = envValue?.trim();
  if (!trimmed) {
    return DEFAULT_REQUEST_TIMEOUT_MS;
  }

  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_REQUEST_TIMEOUT_MS;
  }

  return parsed;
}

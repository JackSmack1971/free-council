const DEFAULT_REQUEST_TIMEOUT_MS = 30000;

export function getRequestTimeoutMs(envValue: string | undefined = process.env.REQUEST_TIMEOUT_MS): number {
  const trimmed = envValue?.trim();
  if (!trimmed) {
    return DEFAULT_REQUEST_TIMEOUT_MS;
  }

  if (!/^\d+$/.test(trimmed)) {
    console.warn(
      `[requestTimeout] Invalid REQUEST_TIMEOUT_MS "${trimmed}", using default ${DEFAULT_REQUEST_TIMEOUT_MS}ms`
    );
    return DEFAULT_REQUEST_TIMEOUT_MS;
  }

  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    console.warn(
      `[requestTimeout] Invalid REQUEST_TIMEOUT_MS "${trimmed}", using default ${DEFAULT_REQUEST_TIMEOUT_MS}ms`
    );
    return DEFAULT_REQUEST_TIMEOUT_MS;
  }

  return parsed;
}

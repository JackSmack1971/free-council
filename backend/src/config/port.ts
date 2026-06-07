const DEFAULT_PORT = 3001;

export function resolvePort(envValue: string | undefined = process.env.PORT): number {
  const trimmed = envValue?.trim();
  if (!trimmed) {
    return DEFAULT_PORT;
  }

  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 65535) {
    throw new Error(`PORT must be an integer between 1 and 65535. Received "${envValue}".`);
  }

  return parsed;
}

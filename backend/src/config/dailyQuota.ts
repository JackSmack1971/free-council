const DEFAULT_DAILY_API_QUOTA = 200;

export function getDailyApiQuotaLimit(envValue: string | undefined = process.env.DAILY_API_QUOTA): number {
  const trimmed = envValue?.trim();
  if (!trimmed) {
    return DEFAULT_DAILY_API_QUOTA;
  }

  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_DAILY_API_QUOTA;
  }

  return parsed;
}

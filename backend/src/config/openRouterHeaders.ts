const DEFAULT_FRONTEND_URL = 'http://localhost:3000';

export function getOpenRouterHttpReferer(envValue: string | undefined = process.env.FRONTEND_URL): string {
  const trimmed = envValue?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : DEFAULT_FRONTEND_URL;
}

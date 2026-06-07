import type { CorsOptions } from 'cors';

export const DEFAULT_CORS_ORIGINS = ['http://localhost:3000'];

export function parseCorsOrigins(env: NodeJS.ProcessEnv = process.env): string[] {
  const configuredOrigins = env.CORS_ORIGINS
    ?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return configuredOrigins?.length ? configuredOrigins : DEFAULT_CORS_ORIGINS;
}

export function isCorsOriginAllowed(
  origin: string | undefined,
  allowedOrigins: string[] = parseCorsOrigins()
): boolean {
  return !origin || allowedOrigins.includes(origin);
}

export function buildCorsOptions(env: NodeJS.ProcessEnv = process.env): CorsOptions {
  const allowedOrigins = parseCorsOrigins(env);

  return {
    origin(origin, callback) {
      if (isCorsOriginAllowed(origin, allowedOrigins)) {
        callback(null, true);
        return;
      }

      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'OPTIONS']
  };
}

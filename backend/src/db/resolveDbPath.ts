import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function resolveDbPath(env: NodeJS.ProcessEnv = process.env, currentDir = __dirname): string {
  const configuredPath = env.DATABASE_PATH?.trim();

  if (configuredPath) {
    return path.resolve(configuredPath);
  }

  return path.resolve(currentDir, '../../../free_council.db');
}

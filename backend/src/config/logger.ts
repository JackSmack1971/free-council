type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const METHOD_LEVELS = {
  log: 1,
  warn: 2,
  error: 3
} as const;

const LEVELS: Record<LogLevel, number> = {
  debug: 1,
  info: 1,
  warn: 2,
  error: 3
};

const NO_OP = () => {};

export function resolveLogLevel(envValue: string | undefined = process.env.LOG_LEVEL): LogLevel {
  const normalized = envValue?.trim().toLowerCase();
  if (normalized === 'debug' || normalized === 'info' || normalized === 'warn' || normalized === 'error') {
    return normalized;
  }

  return 'info';
}

export function configureConsoleLogging(envValue: string | undefined = process.env.LOG_LEVEL): void {
  const activeLevel = LEVELS[resolveLogLevel(envValue)];
  const originalLog = console.log.bind(console);
  const originalWarn = console.warn.bind(console);
  const originalError = console.error.bind(console);

  console.log = METHOD_LEVELS.log >= activeLevel ? originalLog : NO_OP;
  console.warn = METHOD_LEVELS.warn >= activeLevel ? originalWarn : NO_OP;
  console.error = METHOD_LEVELS.error >= activeLevel ? originalError : NO_OP;
}

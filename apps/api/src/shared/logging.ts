import pino from 'pino';
import type { LoggerOptions } from 'pino';

export const loggerConfig: LoggerOptions = {
  level: process.env.LOG_LEVEL ?? 'info',
  transport:
    process.env.NODE_ENV === 'development'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
  base: {
    service: 'seedling-api',
    env: process.env.NODE_ENV ?? 'development',
  },
};

export const logger = pino(loggerConfig);

export function createChildLogger(bindings: Record<string, unknown>) {
  return logger.child(bindings);
}

import pino from 'pino';

const level = process.env.LOG_LEVEL ?? 'info';
const pretty = process.env.LOG_PRETTY === 'true' || process.env.LOG_PRETTY === '1';

export const logger = pino({
  level,
  base: { service: 'market-intel' },
  timestamp: pino.stdTimeFunctions.isoTime,
  ...(pretty
    ? {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname,service' },
        },
      }
    : {}),
});

export type Logger = pino.Logger;

/** Child logger bound to a run / source / job so every line is traceable. */
export function scoped(bindings: Record<string, unknown>): Logger {
  return logger.child(bindings);
}

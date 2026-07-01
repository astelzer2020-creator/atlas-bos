import pino, { type Logger as PinoLogger, type LoggerOptions } from 'pino';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface LoggerBindings {
  readonly correlationId?: string;
  readonly tenantId?: string;
  readonly userId?: string;
  readonly service?: string;
  readonly module?: string;
  readonly operation?: string;
  readonly [key: string]: unknown;
}

export interface Logger {
  debug(message: string, metadata?: Record<string, unknown>): void;
  info(message: string, metadata?: Record<string, unknown>): void;
  warn(message: string, metadata?: Record<string, unknown>): void;
  error(message: string, metadata?: Record<string, unknown>): void;
  fatal(message: string, metadata?: Record<string, unknown>): void;
  child(bindings: LoggerBindings): Logger;
}

export interface CreateLoggerOptions {
  readonly level?: LogLevel;
  readonly service?: string;
  readonly bindings?: LoggerBindings;
  readonly pinoOptions?: LoggerOptions;
}

const REDACT_PATHS = [
  'password',
  'token',
  'accessToken',
  'refreshToken',
  'authorization',
  'apiKey',
  'secret',
  '*.password',
  '*.token',
  '*.accessToken',
  '*.refreshToken',
  '*.authorization',
  '*.apiKey',
  '*.secret',
];

class PinoLoggerAdapter implements Logger {
  constructor(private readonly logger: PinoLogger) {}

  debug(message: string, metadata?: Record<string, unknown>): void {
    this.logger.debug(metadata ?? {}, message);
  }

  info(message: string, metadata?: Record<string, unknown>): void {
    this.logger.info(metadata ?? {}, message);
  }

  warn(message: string, metadata?: Record<string, unknown>): void {
    this.logger.warn(metadata ?? {}, message);
  }

  error(message: string, metadata?: Record<string, unknown>): void {
    this.logger.error(metadata ?? {}, message);
  }

  fatal(message: string, metadata?: Record<string, unknown>): void {
    this.logger.fatal(metadata ?? {}, message);
  }

  child(bindings: LoggerBindings): Logger {
    return new PinoLoggerAdapter(this.logger.child(bindings));
  }
}

/**
 * Creates a structured JSON logger backed by Pino.
 */
export function createLogger(options: CreateLoggerOptions = {}): Logger {
  const pinoLogger = pino({
    level: options.level ?? (process.env['NODE_ENV'] === 'production' ? 'info' : 'debug'),
    base: {
      service: options.service ?? 'atlas',
      ...(options.bindings ?? {}),
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: {
      paths: REDACT_PATHS,
      censor: '[REDACTED]',
    },
    formatters: {
      level(label) {
        return { level: label };
      },
    },
    ...options.pinoOptions,
  });

  return new PinoLoggerAdapter(pinoLogger);
}

/**
 * Creates a child logger scoped to a request correlation identifier.
 */
export function createCorrelationLogger(
  parent: Logger,
  correlationId: string,
  bindings: LoggerBindings = {},
): Logger {
  return parent.child({ correlationId, ...bindings });
}
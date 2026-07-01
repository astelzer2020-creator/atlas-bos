import type { Logger } from '@atlas/platform';

export interface EmailMessage {
  readonly to: string;
  readonly subject: string;
  readonly body: string;
  readonly from?: string;
}

export interface EmailTransportResult {
  readonly transport: string;
  readonly messageId: string;
  readonly accepted: boolean;
}

export interface EmailTransport {
  send(message: EmailMessage): Promise<EmailTransportResult>;
}

export interface LogEmailTransportOptions {
  readonly logger: Logger;
  readonly fromAddress?: string;
}

/**
 * Development-friendly transport that records email payloads in structured logs.
 */
export class LogEmailTransport implements EmailTransport {
  constructor(private readonly options: LogEmailTransportOptions) {}

  async send(message: EmailMessage): Promise<EmailTransportResult> {
    const messageId = crypto.randomUUID();
    const from = message.from ?? this.options.fromAddress ?? 'noreply@atlas.local';

    this.options.logger.info('Email message delivered via log transport', {
      transport: 'log',
      messageId,
      from,
      to: message.to,
      subject: message.subject,
      bodyLength: message.body.length,
    });

    return {
      transport: 'log',
      messageId,
      accepted: true,
    };
  }
}

export interface SmtpEmailTransportOptions {
  readonly logger: Logger;
  readonly host: string;
  readonly port: number;
  readonly user?: string;
  readonly password?: string;
  readonly fromAddress: string;
  readonly secure?: boolean;
}

/**
 * Sends email via raw SMTP using fetch to a compatible HTTP relay when `SMTP_HTTP_RELAY_URL` is set,
 * otherwise falls back to structured logging.
 */
export class SmtpEmailTransport implements EmailTransport {
  private readonly fallback: LogEmailTransport;

  constructor(private readonly options: SmtpEmailTransportOptions) {
    this.fallback = new LogEmailTransport({
      logger: options.logger,
      fromAddress: options.fromAddress,
    });
  }

  async send(message: EmailMessage): Promise<EmailTransportResult> {
    const relayUrl = process.env.SMTP_HTTP_RELAY_URL;

    if (relayUrl === undefined || relayUrl.length === 0) {
      this.options.logger.warn('SMTP configured without HTTP relay; using log transport', {
        host: this.options.host,
        port: this.options.port,
      });
      return this.fallback.send({
        ...message,
        from: message.from ?? this.options.fromAddress,
      });
    }

    try {
      const response = await fetch(relayUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          from: message.from ?? this.options.fromAddress,
          to: message.to,
          subject: message.subject,
          body: message.body,
          smtp: {
            host: this.options.host,
            port: this.options.port,
            secure: this.options.secure ?? false,
            user: this.options.user,
            password: this.options.password,
          },
        }),
        signal: AbortSignal.timeout(15_000),
      });

      if (!response.ok) {
        throw new Error(`SMTP relay returned HTTP ${String(response.status)}`);
      }

      const payload = (await response.json()) as { messageId?: string };
      const messageId = payload.messageId ?? crypto.randomUUID();

      return {
        transport: 'smtp-relay',
        messageId,
        accepted: true,
      };
    } catch (error) {
      this.options.logger.error('SMTP relay failed; falling back to log transport', {
        error: error instanceof Error ? error.message : String(error),
      });
      return this.fallback.send({
        ...message,
        from: message.from ?? this.options.fromAddress,
      });
    }
  }
}

export function createEmailTransport(logger: Logger): EmailTransport {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? '587');
  const fromAddress = process.env.SMTP_FROM ?? 'noreply@atlas.local';

  if (host !== undefined && host.length > 0) {
    return new SmtpEmailTransport({
      logger,
      host,
      port,
      fromAddress,
      ...(process.env.SMTP_USER !== undefined ? { user: process.env.SMTP_USER } : {}),
      ...(process.env.SMTP_PASSWORD !== undefined ? { password: process.env.SMTP_PASSWORD } : {}),
      secure: process.env.SMTP_SECURE === 'true',
    });
  }

  return new LogEmailTransport({ logger, fromAddress });
}
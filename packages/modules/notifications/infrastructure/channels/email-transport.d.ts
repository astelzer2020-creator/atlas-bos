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
export declare class LogEmailTransport implements EmailTransport {
    private readonly options;
    constructor(options: LogEmailTransportOptions);
    send(message: EmailMessage): Promise<EmailTransportResult>;
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
export declare class SmtpEmailTransport implements EmailTransport {
    private readonly options;
    private readonly fallback;
    constructor(options: SmtpEmailTransportOptions);
    send(message: EmailMessage): Promise<EmailTransportResult>;
}
export declare function createEmailTransport(logger: Logger): EmailTransport;
//# sourceMappingURL=email-transport.d.ts.map
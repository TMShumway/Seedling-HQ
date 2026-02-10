import { randomUUID } from 'node:crypto';
import type { QuoteRepository } from '../ports/quote-repository.js';
import type { UnitOfWork } from '../ports/unit-of-work.js';
import type { EmailSender } from '../ports/email-sender.js';
import type { MessageOutboxRepository } from '../ports/message-outbox-repository.js';
import type { ClientRepository } from '../ports/client-repository.js';
import type { AppConfig } from '../../shared/config.js';
import type { SendQuoteInput, SendQuoteOutput } from '../dto/send-quote-dto.js';
import { NotFoundError, ValidationError, ConflictError } from '../../shared/errors.js';
import { hashToken } from '../../shared/crypto.js';

const DEFAULT_EXPIRES_IN_DAYS = 14;

export class SendQuoteUseCase {
  constructor(
    private quoteRepo: QuoteRepository,
    private uow: UnitOfWork,
    private emailSender: EmailSender,
    private outboxRepo: MessageOutboxRepository,
    private clientRepo: ClientRepository,
    private config: AppConfig,
  ) {}

  async execute(input: SendQuoteInput, correlationId: string): Promise<SendQuoteOutput> {
    // 1. Fetch quote
    const quote = await this.quoteRepo.getById(input.tenantId, input.quoteId);
    if (!quote) {
      throw new NotFoundError('Quote not found');
    }

    // 2. Validate draft status
    if (quote.status !== 'draft') {
      throw new ValidationError(`Cannot send a quote with status "${quote.status}"`);
    }

    // 3. Validate line items exist
    if (quote.lineItems.length === 0) {
      throw new ValidationError('Cannot send a quote with no line items');
    }

    // 4. Generate raw token + hash
    const rawToken = randomUUID();
    const tokenHash = hashToken(this.config.SECURE_LINK_HMAC_SECRET, rawToken);
    const link = `${this.config.APP_BASE_URL}/quote/${rawToken}`;

    const expiresInDays = input.expiresInDays ?? DEFAULT_EXPIRES_IN_DAYS;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    // 5. Atomic: update status + create token + audit
    const updatedQuote = await this.uow.run(async (repos) => {
      const updated = await repos.quoteRepo.updateStatus(
        input.tenantId,
        input.quoteId,
        'sent',
        { sentAt: new Date() },
        ['draft'],
      );
      if (!updated) {
        throw new ConflictError('Quote has already been sent');
      }

      await repos.secureLinkTokenRepo.create({
        id: randomUUID(),
        tenantId: input.tenantId,
        tokenHash,
        hashVersion: 'v1',
        subjectType: 'quote',
        subjectId: input.quoteId,
        scopes: ['quote:read', 'quote:respond'],
        expiresAt,
        revokedAt: null,
        createdByUserId: input.userId,
      });

      await repos.auditRepo.record({
        id: randomUUID(),
        tenantId: input.tenantId,
        principalType: 'internal',
        principalId: input.userId,
        eventName: 'quote.sent',
        subjectType: 'quote',
        subjectId: input.quoteId,
        correlationId,
      });

      return updated;
    });

    // 6. Best-effort: send email to client
    try {
      if (this.config.NOTIFICATION_ENABLED) {
        const client = await this.clientRepo.getById(input.tenantId, quote.clientId);
        if (client?.email) {
          const { subject, html } = buildQuoteSentEmail(quote.title, link, client.email);

          const outboxId = randomUUID();
          await this.outboxRepo.create({
            id: outboxId,
            tenantId: input.tenantId,
            type: 'quote_sent',
            recipientId: client.id,
            recipientType: 'client',
            channel: 'email',
            subject,
            body: html,
            status: 'queued',
            provider: null,
            providerMessageId: null,
            lastErrorCode: null,
            lastErrorMessage: null,
            correlationId,
            scheduledFor: null,
          });

          try {
            const result = await this.emailSender.send({
              from: this.config.SMTP_FROM,
              to: client.email,
              subject,
              html,
            });
            await this.outboxRepo.updateStatus(outboxId, 'sent', {
              provider: 'smtp',
              providerMessageId: result.messageId,
              sentAt: new Date(),
            });
          } catch (sendError) {
            await this.outboxRepo.updateStatus(outboxId, 'failed', {
              lastErrorMessage: sendError instanceof Error ? sendError.message : String(sendError),
            });
          }
        }
      }
    } catch {
      // Best-effort — never throw on notification failure
    }

    return { quote: updatedQuote, token: rawToken, link };
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildQuoteSentEmail(quoteTitle: string, link: string, clientEmail: string) {
  const subject = `Your quote is ready: ${quoteTitle}`;
  const html = `
<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #1e3a5f;">Your Quote is Ready</h2>
  <p>A new quote has been prepared for you: <strong>${escapeHtml(quoteTitle)}</strong></p>
  <p>Click the link below to view your quote:</p>
  <p style="margin: 24px 0;">
    <a href="${escapeHtml(link)}" style="background-color: #1e3a5f; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">View Quote</a>
  </p>
  <p style="color: #6b7280; font-size: 12px;">If the button doesn't work, copy and paste this link into your browser:<br>${escapeHtml(link)}</p>
  <p style="color: #6b7280; font-size: 12px;">This is an automated notification from Seedling HQ.</p>
</div>`.trim();

  return { subject, html };
}

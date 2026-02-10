import { randomUUID } from 'node:crypto';
import type { QuoteRepository } from '../ports/quote-repository.js';
import type { AuditEventRepository } from '../ports/audit-event-repository.js';
import type { UserRepository } from '../ports/user-repository.js';
import type { MessageOutboxRepository } from '../ports/message-outbox-repository.js';
import type { EmailSender } from '../ports/email-sender.js';
import type { AppConfig } from '../../shared/config.js';
import type { RespondToQuoteInput, RespondToQuoteOutput } from '../dto/respond-quote-dto.js';
import { NotFoundError, ValidationError, ConflictError } from '../../shared/errors.js';

export class RespondToQuoteUseCase {
  constructor(
    private quoteRepo: QuoteRepository,
    private auditRepo: AuditEventRepository,
    private userRepo: UserRepository,
    private outboxRepo: MessageOutboxRepository,
    private emailSender: EmailSender,
    private config: AppConfig,
  ) {}

  async execute(input: RespondToQuoteInput, correlationId: string): Promise<RespondToQuoteOutput> {
    const quote = await this.quoteRepo.getById(input.tenantId, input.quoteId);
    if (!quote) {
      throw new NotFoundError('Quote not found');
    }

    const targetStatus = input.action === 'approve' ? 'approved' : 'declined';
    const oppositeStatus = input.action === 'approve' ? 'declined' : 'approved';

    // Idempotent: same action repeated → return current state
    if (quote.status === targetStatus) {
      return {
        quote: {
          id: quote.id,
          status: quote.status,
          approvedAt: quote.approvedAt?.toISOString() ?? null,
          declinedAt: quote.declinedAt?.toISOString() ?? null,
        },
      };
    }

    // Cross-transition guard
    if (quote.status === oppositeStatus) {
      throw new ValidationError(`This quote has already been ${oppositeStatus}`);
    }

    // Non-sent guard
    if (quote.status !== 'sent') {
      throw new ValidationError(`Only sent quotes can be ${input.action === 'approve' ? 'approved' : 'declined'}`);
    }

    const statusFields = input.action === 'approve'
      ? { approvedAt: new Date() }
      : { declinedAt: new Date() };

    const updated = await this.quoteRepo.updateStatus(
      input.tenantId, input.quoteId, targetStatus, statusFields, ['sent'],
    );
    if (!updated) {
      throw new ConflictError(`Quote has already been ${targetStatus}`);
    }

    // Best-effort audit
    try {
      await this.auditRepo.record({
        id: randomUUID(),
        tenantId: input.tenantId,
        principalType: 'external',
        principalId: input.tokenId,
        eventName: `quote.${targetStatus}`,
        subjectType: 'quote',
        subjectId: input.quoteId,
        correlationId,
      });
    } catch {
      // best-effort
    }

    // Best-effort owner notification
    await this.sendOwnerNotification(input.tenantId, input.quoteId, quote.title, input.action, correlationId);

    return {
      quote: {
        id: updated.id,
        status: updated.status,
        approvedAt: updated.approvedAt?.toISOString() ?? null,
        declinedAt: updated.declinedAt?.toISOString() ?? null,
      },
    };
  }

  private async sendOwnerNotification(
    tenantId: string,
    quoteId: string,
    quoteTitle: string,
    action: 'approve' | 'decline',
    correlationId: string,
  ): Promise<void> {
    try {
      if (!this.config.NOTIFICATION_ENABLED) return;

      const owner = await this.userRepo.getOwnerByTenantId(tenantId);
      if (!owner?.email) return;

      const { subject, html } = buildQuoteResponseEmail(quoteTitle, action, this.config.APP_BASE_URL, quoteId);

      const outboxId = randomUUID();
      await this.outboxRepo.create({
        id: outboxId,
        tenantId,
        type: `quote_${action === 'approve' ? 'approved' : 'declined'}`,
        recipientId: owner.id,
        recipientType: 'user',
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
          to: owner.email,
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
    } catch {
      // Best-effort — never throw on notification failure
    }
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildQuoteResponseEmail(quoteTitle: string, action: 'approve' | 'decline', baseUrl: string, quoteId: string) {
  const actionPast = action === 'approve' ? 'approved' : 'declined';
  const color = action === 'approve' ? '#16a34a' : '#dc2626';
  const link = `${baseUrl}/quotes/${quoteId}`;

  const subject = `Quote ${actionPast}: ${quoteTitle}`;
  const html = `
<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #1e3a5f;">Quote ${escapeHtml(actionPast.charAt(0).toUpperCase() + actionPast.slice(1))}</h2>
  <p>Your quote <strong>${escapeHtml(quoteTitle)}</strong> has been <span style="color: ${color}; font-weight: 600;">${escapeHtml(actionPast)}</span> by the client.</p>
  <p style="margin: 24px 0;">
    <a href="${escapeHtml(link)}" style="background-color: #1e3a5f; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">View Quote</a>
  </p>
  <p style="color: #6b7280; font-size: 12px;">If the button doesn't work, copy and paste this link into your browser:<br>${escapeHtml(link)}</p>
  <p style="color: #6b7280; font-size: 12px;">This is an automated notification from Seedling HQ.</p>
</div>`.trim();

  return { subject, html };
}

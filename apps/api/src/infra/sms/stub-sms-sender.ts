import { randomUUID } from 'node:crypto';
import type { SmsSender, SmsSendResult } from '../../application/ports/sms-sender.js';
import { logger } from '../../shared/logging.js';

export class StubSmsSender implements SmsSender {
  async send(destination: string, body: string): Promise<SmsSendResult> {
    const last4 = destination.slice(-4);
    logger.info({ to: `***${last4}`, bodyLength: body.length }, 'StubSmsSender: SMS sent (stub)');
    return { providerMessageId: `stub-${randomUUID()}` };
  }
}

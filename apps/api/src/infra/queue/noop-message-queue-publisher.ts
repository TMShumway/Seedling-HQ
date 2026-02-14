import type { MessageQueuePublisher } from '../../application/ports/message-queue-publisher.js';
import type { MessageJobPayload } from '../../application/dto/message-job-payload.js';
import { logger } from '../../shared/logging.js';

export class NoopMessageQueuePublisher implements MessageQueuePublisher {
  async publish(payload: MessageJobPayload): Promise<void> {
    logger.debug(
      { jobType: payload.jobType, outboxId: payload.outboxId },
      'NoopMessageQueuePublisher: message job not published (no queue configured)',
    );
  }
}

import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import type { MessageQueuePublisher } from '../../application/ports/message-queue-publisher.js';
import type { MessageJobPayload } from '../../application/dto/message-job-payload.js';
import { logger } from '../../shared/logging.js';

export class SqsMessageQueuePublisher implements MessageQueuePublisher {
  private client: SQSClient;

  constructor(
    private queueUrl: string,
    region: string,
    endpoint?: string,
  ) {
    this.client = new SQSClient({
      region,
      ...(endpoint
        ? {
            endpoint,
            credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
          }
        : {}),
    });
  }

  async publish(payload: MessageJobPayload): Promise<void> {
    await this.client.send(
      new SendMessageCommand({
        QueueUrl: this.queueUrl,
        MessageBody: JSON.stringify(payload),
        MessageGroupId: payload.tenantId,
        MessageDeduplicationId: `${payload.outboxId}-${payload.jobType}`,
      }),
    );
    logger.info(
      { jobType: payload.jobType, outboxId: payload.outboxId, correlationId: payload.correlationId },
      'Published message job to SQS',
    );
  }
}

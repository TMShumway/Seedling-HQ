import {
  SQSClient,
  ReceiveMessageCommand,
  DeleteMessageCommand,
} from '@aws-sdk/client-sqs';
import type { MessageJobWorker } from '../../application/usecases/message-job-worker.js';
import type { MessageJobPayload } from '../../application/dto/message-job-payload.js';
import { logger } from '../../shared/logging.js';

export class InlineSqsPoller {
  private client: SQSClient;
  private running = false;

  constructor(
    private queueUrl: string,
    private worker: MessageJobWorker,
    endpoint?: string,
  ) {
    this.client = new SQSClient({
      ...(endpoint ? { endpoint } : {}),
    });
  }

  start(): void {
    this.running = true;
    logger.info({ queueUrl: this.queueUrl }, 'Polling SQS queue...');
    this.poll();
  }

  stop(): void {
    this.running = false;
    logger.info('SQS poller stopping');
  }

  private async poll(): Promise<void> {
    while (this.running) {
      try {
        const result = await this.client.send(
          new ReceiveMessageCommand({
            QueueUrl: this.queueUrl,
            WaitTimeSeconds: 10,
            MaxNumberOfMessages: 5,
          }),
        );

        const messages = result.Messages ?? [];
        for (const msg of messages) {
          if (!msg.Body || !msg.ReceiptHandle) continue;

          try {
            const payload: MessageJobPayload = JSON.parse(msg.Body);
            await this.worker.processJob(payload);

            // Delete on success
            await this.client.send(
              new DeleteMessageCommand({
                QueueUrl: this.queueUrl,
                ReceiptHandle: msg.ReceiptHandle,
              }),
            );
          } catch (err) {
            // Don't delete — SQS will redeliver after visibility timeout
            logger.error(
              { err, messageId: msg.MessageId },
              'Failed to process message job',
            );
          }
        }
      } catch (err) {
        // SQS polling error — back off and retry
        logger.error({ err }, 'SQS polling error');
        await this.sleep(5000);
      }
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

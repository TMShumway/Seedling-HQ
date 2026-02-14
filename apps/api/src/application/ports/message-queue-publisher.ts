import type { MessageJobPayload } from '../dto/message-job-payload.js';

export interface MessageQueuePublisher {
  publish(payload: MessageJobPayload): Promise<void>;
}

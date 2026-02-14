import {
  PinpointSMSVoiceV2Client,
  SendTextMessageCommand,
} from '@aws-sdk/client-pinpoint-sms-voice-v2';
import type { SmsSender, SmsSendResult } from '../../application/ports/sms-sender.js';

export class AwsSmsSender implements SmsSender {
  private client: PinpointSMSVoiceV2Client;

  constructor(region: string) {
    this.client = new PinpointSMSVoiceV2Client({ region });
  }

  async send(destination: string, body: string, originationIdentity?: string): Promise<SmsSendResult> {
    const result = await this.client.send(
      new SendTextMessageCommand({
        DestinationPhoneNumber: destination,
        MessageBody: body,
        ...(originationIdentity ? { OriginationIdentity: originationIdentity } : {}),
      }),
    );

    return { providerMessageId: result.MessageId ?? 'unknown' };
  }
}

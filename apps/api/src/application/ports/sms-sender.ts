export interface SmsSendResult {
  providerMessageId: string;
}

export interface SmsSender {
  send(destination: string, body: string, originationIdentity?: string): Promise<SmsSendResult>;
}

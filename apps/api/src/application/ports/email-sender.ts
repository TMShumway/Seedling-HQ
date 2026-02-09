export interface EmailMessage {
  from: string;
  to: string;
  subject: string;
  html: string;
}

export interface EmailSendResult {
  messageId: string;
}

export interface EmailSender {
  send(message: EmailMessage): Promise<EmailSendResult>;
}

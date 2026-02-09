import { createTransport, type Transporter } from 'nodemailer';
import type { EmailSender, EmailMessage, EmailSendResult } from '../../application/ports/email-sender.js';

export class NodemailerEmailSender implements EmailSender {
  private transport: Transporter;

  constructor(host: string, port: number) {
    this.transport = createTransport({
      host,
      port,
      secure: false,
    });
  }

  async send(message: EmailMessage): Promise<EmailSendResult> {
    const info = await this.transport.sendMail({
      from: message.from,
      to: message.to,
      subject: message.subject,
      html: message.html,
    });
    return { messageId: info.messageId };
  }
}

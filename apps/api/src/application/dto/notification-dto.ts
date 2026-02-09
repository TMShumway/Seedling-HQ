import type { Request } from '../../domain/entities/request.js';

export interface NotificationEmail {
  subject: string;
  html: string;
}

export function buildRequestNotificationEmail(
  request: Request,
  tenantName: string,
): NotificationEmail {
  const subject = `New service request from ${request.clientName}`;

  const html = `
<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #1e3a5f;">New Service Request</h2>
  <p>A new service request has been submitted for <strong>${escapeHtml(tenantName)}</strong>.</p>
  <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
    <tr>
      <td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #e5e7eb;">Name</td>
      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${escapeHtml(request.clientName)}</td>
    </tr>
    <tr>
      <td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #e5e7eb;">Email</td>
      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${escapeHtml(request.clientEmail)}</td>
    </tr>
    ${request.clientPhone ? `<tr>
      <td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #e5e7eb;">Phone</td>
      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${escapeHtml(request.clientPhone)}</td>
    </tr>` : ''}
    <tr>
      <td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #e5e7eb;">Description</td>
      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${escapeHtml(request.description)}</td>
    </tr>
  </table>
  <p style="color: #6b7280; font-size: 12px;">This is an automated notification from Seedling HQ.</p>
</div>`.trim();

  return { subject, html };
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

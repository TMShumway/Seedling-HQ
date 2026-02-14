import { and, eq, sql } from 'drizzle-orm';
import type { SmsRecipientPrefsRepository } from '../../../application/ports/sms-recipient-prefs-repository.js';
import type { SmsRecipientPrefs } from '../../../domain/entities/sms-recipient-prefs.js';
import type { Database } from '../client.js';
import { smsRecipientPrefs } from '../schema.js';

function toEntity(row: typeof smsRecipientPrefs.$inferSelect): SmsRecipientPrefs {
  return {
    id: row.id,
    tenantId: row.tenantId,
    phone: row.phone,
    optedOut: row.optedOut,
    optedOutAt: row.optedOutAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class DrizzleSmsRecipientPrefsRepository implements SmsRecipientPrefsRepository {
  constructor(private db: Database) {}

  async getByPhone(tenantId: string, phone: string): Promise<SmsRecipientPrefs | null> {
    const rows = await this.db
      .select()
      .from(smsRecipientPrefs)
      .where(
        and(
          eq(smsRecipientPrefs.tenantId, tenantId),
          sql`lower(${smsRecipientPrefs.phone}) = lower(${phone})`,
        ),
      )
      .limit(1);
    return rows.length > 0 ? toEntity(rows[0]) : null;
  }
}

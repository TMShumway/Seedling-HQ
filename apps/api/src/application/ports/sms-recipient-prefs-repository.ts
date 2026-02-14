import type { SmsRecipientPrefs } from '../../domain/entities/sms-recipient-prefs.js';

export interface SmsRecipientPrefsRepository {
  getByPhone(tenantId: string, phone: string): Promise<SmsRecipientPrefs | null>;
}

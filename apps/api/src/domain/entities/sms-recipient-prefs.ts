export interface SmsRecipientPrefs {
  id: string;
  tenantId: string;
  phone: string;
  optedOut: boolean;
  optedOutAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

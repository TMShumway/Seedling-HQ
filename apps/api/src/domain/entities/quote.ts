export type QuoteStatus = 'draft' | 'sent' | 'approved' | 'declined' | 'expired';

export interface QuoteLineItem {
  serviceItemId: string | null;
  description: string;
  quantity: number;
  unitPrice: number; // integer cents
  total: number; // integer cents
}

export interface Quote {
  id: string;
  tenantId: string;
  requestId: string | null;
  clientId: string;
  propertyId: string | null;
  title: string;
  lineItems: QuoteLineItem[];
  subtotal: number; // integer cents
  tax: number; // integer cents
  total: number; // integer cents
  status: QuoteStatus;
  sentAt: Date | null;
  approvedAt: Date | null;
  declinedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type RequestStatus = 'new' | 'reviewed' | 'converted' | 'declined';
export type RequestSource = 'public_form' | 'manual';

export interface Request {
  id: string;
  tenantId: string;
  source: RequestSource;
  clientName: string;
  clientEmail: string;
  clientPhone: string | null;
  description: string;
  status: RequestStatus;
  assignedUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

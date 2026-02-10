import type { Request } from '../../domain/entities/request.js';
import type { Client } from '../../domain/entities/client.js';
import type { Property } from '../../domain/entities/property.js';
import type { Quote } from '../../domain/entities/quote.js';

export interface ConvertRequestInput {
  tenantId: string;
  userId: string;
  requestId: string;
  existingClientId?: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  addressLine1: string;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  quoteTitle: string;
}

export interface ConvertRequestOutput {
  request: Request;
  client: Client;
  property: Property;
  quote: Quote;
  clientCreated: boolean;
}

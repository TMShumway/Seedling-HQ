const BASE_URL = '';

interface ApiError {
  error: { code: string; message: string };
}

class ApiClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

// --- Auth provider for Cognito mode token injection ---

export interface AuthTokenProvider {
  getToken: () => Promise<string>;
  forceRefresh: () => Promise<string>;
  onAuthFailure: () => Promise<void> | void;
}

let authProvider: AuthTokenProvider | null = null;

export function setAuthProvider(provider: AuthTokenProvider): void {
  authProvider = provider;
}

export function clearAuthProvider(): void {
  authProvider = null;
}

// --- Request helpers ---

function getDevAuthHeaders(): Record<string, string> {
  const tenantId = localStorage.getItem('dev_tenant_id');
  const userId = localStorage.getItem('dev_user_id');
  return {
    ...(tenantId ? { 'X-Dev-Tenant-Id': tenantId } : {}),
    ...(userId ? { 'X-Dev-User-Id': userId } : {}),
  };
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  if (authProvider) {
    const token = await authProvider.getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }
  return getDevAuthHeaders();
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const correlationId = crypto.randomUUID();
  const authHeaders = await getAuthHeaders();

  const doFetch = async (headers: Record<string, string>) => {
    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        'X-Correlation-Id': correlationId,
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    return res;
  };

  let res = await doFetch(authHeaders);

  // 401 retry for cognito mode
  if (res.status === 401 && authProvider) {
    try {
      const newToken = await authProvider.forceRefresh();
      res = await doFetch(newToken ? { Authorization: `Bearer ${newToken}` } : {});

      if (res.status === 401) {
        await authProvider.onAuthFailure();
        const err: ApiError = await res.json().catch(() => ({
          error: { code: 'UNAUTHORIZED', message: res.statusText },
        }));
        throw new ApiClientError(res.status, err.error.code, err.error.message);
      }
    } catch (retryErr) {
      if (retryErr instanceof ApiClientError) throw retryErr;
      // forceRefresh itself failed (e.g., refresh token expired)
      await authProvider.onAuthFailure();
      const err: ApiError = await res.json().catch(() => ({
        error: { code: 'UNAUTHORIZED', message: res.statusText },
      }));
      throw new ApiClientError(res.status, err.error.code, err.error.message);
    }
  }

  if (!res.ok) {
    const err: ApiError = await res.json().catch(() => ({
      error: { code: 'UNKNOWN', message: res.statusText },
    }));
    throw new ApiClientError(res.status, err.error.code, err.error.message);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}

export interface TenantResponse {
  id: string;
  slug: string;
  name: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserResponse {
  id: string;
  tenantId: string;
  email: string;
  fullName: string;
  role: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTenantRequest {
  businessName: string;
  ownerEmail: string;
  ownerFullName: string;
}

export interface CreateTenantResponse {
  tenant: TenantResponse;
  user: UserResponse;
}

export interface DaySchedule {
  open: string | null;
  close: string | null;
  closed: boolean;
}

export interface BusinessHoursResponse {
  monday: DaySchedule;
  tuesday: DaySchedule;
  wednesday: DaySchedule;
  thursday: DaySchedule;
  friday: DaySchedule;
  saturday: DaySchedule;
  sunday: DaySchedule;
}

export interface BusinessSettingsResponse {
  id: string;
  tenantId: string;
  phone: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  timezone: string | null;
  businessHours: BusinessHoursResponse | null;
  serviceArea: string | null;
  defaultDurationMinutes: number | null;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertBusinessSettingsRequest {
  phone: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  timezone: string | null;
  businessHours: BusinessHoursResponse | null;
  serviceArea: string | null;
  defaultDurationMinutes: number | null;
  description: string | null;
}

export interface ServiceCategoryResponse {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  sortOrder: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateServiceCategoryRequest {
  name: string;
  description?: string | null;
  sortOrder?: number;
}

export interface UpdateServiceCategoryRequest {
  name?: string;
  description?: string | null;
  sortOrder?: number;
}

export interface ServiceItemResponse {
  id: string;
  tenantId: string;
  categoryId: string;
  name: string;
  description: string | null;
  unitPrice: number;
  unitType: string;
  estimatedDurationMinutes: number | null;
  active: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateServiceItemRequest {
  categoryId: string;
  name: string;
  description?: string | null;
  unitPrice: number;
  unitType: string;
  estimatedDurationMinutes?: number | null;
  sortOrder?: number;
}

export interface UpdateServiceItemRequest {
  name?: string;
  description?: string | null;
  unitPrice?: number;
  unitType?: string;
  estimatedDurationMinutes?: number | null;
  sortOrder?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  cursor: string | null;
  hasMore: boolean;
}

export interface ClientResponse {
  id: string;
  tenantId: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  notes: string | null;
  tags: string[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateClientRequest {
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  notes?: string | null;
  tags?: string[];
}

export interface UpdateClientRequest {
  firstName?: string;
  lastName?: string;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  notes?: string | null;
  tags?: string[];
}

export interface PropertyResponse {
  id: string;
  tenantId: string;
  clientId: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  notes: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePropertyRequest {
  addressLine1: string;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  notes?: string | null;
}

export interface UpdatePropertyRequest {
  addressLine1?: string;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  notes?: string | null;
}

export interface TimelineEvent {
  id: string;
  eventName: string;
  label: string;
  subjectType: string;
  subjectId: string;
  principalId: string;
  createdAt: string;
}

export interface LoginAccount {
  tenantId: string;
  tenantName: string;
  userId: string;
  fullName: string;
  role: string;
}

export interface LoginResponse {
  accounts: LoginAccount[];
}

interface CognitoLookupResponse {
  accounts: Array<{
    cognitoUsername: string;
    tenantId: string;
    tenantName: string;
    fullName: string;
    role: string;
  }>;
}

export const apiClient = {
  localLogin: (email: string) =>
    publicRequest<LoginResponse>('POST', '/v1/auth/local/login', { email }),

  cognitoLookup: async (email: string): Promise<LoginResponse> => {
    const raw = await publicRequest<CognitoLookupResponse>('POST', '/v1/auth/cognito/lookup', { email });
    // Map cognitoUsername → userId so downstream code uses a unified LoginAccount shape
    return {
      accounts: raw.accounts.map((a) => ({
        tenantId: a.tenantId,
        tenantName: a.tenantName,
        userId: a.cognitoUsername,
        fullName: a.fullName,
        role: a.role,
      })),
    };
  },

  createTenant: (input: CreateTenantRequest) =>
    request<CreateTenantResponse>('POST', '/v1/tenants', input),

  getTenantMe: () => request<TenantResponse>('GET', '/v1/tenants/me'),

  getUserMe: () => request<UserResponse>('GET', '/v1/users/me'),

  getBusinessSettings: () =>
    request<BusinessSettingsResponse | null>('GET', '/v1/tenants/me/settings'),

  upsertBusinessSettings: (input: UpsertBusinessSettingsRequest) =>
    request<BusinessSettingsResponse>('PUT', '/v1/tenants/me/settings', input),

  // Service Categories
  listServiceCategories: (includeInactive?: boolean) =>
    request<ServiceCategoryResponse[]>('GET', `/v1/services/categories${includeInactive ? '?includeInactive=true' : ''}`),

  createServiceCategory: (input: CreateServiceCategoryRequest) =>
    request<ServiceCategoryResponse>('POST', '/v1/services/categories', input),

  updateServiceCategory: (id: string, input: UpdateServiceCategoryRequest) =>
    request<ServiceCategoryResponse>('PUT', `/v1/services/categories/${id}`, input),

  deactivateServiceCategory: (id: string) =>
    request<void>('DELETE', `/v1/services/categories/${id}`),

  // Service Items
  listServiceItems: (categoryId?: string, includeInactive?: boolean) => {
    const params = new URLSearchParams();
    if (categoryId) params.set('categoryId', categoryId);
    if (includeInactive) params.set('includeInactive', 'true');
    const qs = params.toString();
    return request<ServiceItemResponse[]>('GET', `/v1/services${qs ? `?${qs}` : ''}`);
  },

  createServiceItem: (input: CreateServiceItemRequest) =>
    request<ServiceItemResponse>('POST', '/v1/services', input),

  updateServiceItem: (id: string, input: UpdateServiceItemRequest) =>
    request<ServiceItemResponse>('PUT', `/v1/services/${id}`, input),

  deactivateServiceItem: (id: string) =>
    request<void>('DELETE', `/v1/services/${id}`),

  // Clients
  listClients: (params?: { limit?: number; cursor?: string; search?: string; includeInactive?: boolean }) => {
    const qs = new URLSearchParams();
    if (params?.limit) qs.set('limit', String(params.limit));
    if (params?.cursor) qs.set('cursor', params.cursor);
    if (params?.search) qs.set('search', params.search);
    if (params?.includeInactive) qs.set('includeInactive', 'true');
    const q = qs.toString();
    return request<PaginatedResponse<ClientResponse>>('GET', `/v1/clients${q ? `?${q}` : ''}`);
  },

  getClient: (id: string) =>
    request<ClientResponse>('GET', `/v1/clients/${id}`),

  createClient: (input: CreateClientRequest) =>
    request<ClientResponse>('POST', '/v1/clients', input),

  updateClient: (id: string, input: UpdateClientRequest) =>
    request<ClientResponse>('PUT', `/v1/clients/${id}`, input),

  deactivateClient: (id: string) =>
    request<void>('DELETE', `/v1/clients/${id}`),

  countClients: () =>
    request<{ count: number }>('GET', '/v1/clients/count'),

  // Properties
  listProperties: (clientId: string, includeInactive?: boolean) =>
    request<PropertyResponse[]>('GET', `/v1/clients/${clientId}/properties${includeInactive ? '?includeInactive=true' : ''}`),

  createProperty: (clientId: string, input: CreatePropertyRequest) =>
    request<PropertyResponse>('POST', `/v1/clients/${clientId}/properties`, input),

  updateProperty: (id: string, input: UpdatePropertyRequest) =>
    request<PropertyResponse>('PUT', `/v1/properties/${id}`, input),

  deactivateProperty: (id: string) =>
    request<void>('DELETE', `/v1/properties/${id}`),

  // Requests (public)
  submitPublicRequest: (slug: string, input: PublicRequestPayload) =>
    publicRequest<PublicRequestResponse>('POST', `/v1/public/requests/${slug}`, input),

  // Requests (authenticated)
  listRequests: (params?: { limit?: number; cursor?: string; search?: string; status?: string }) => {
    const qs = new URLSearchParams();
    if (params?.limit) qs.set('limit', String(params.limit));
    if (params?.cursor) qs.set('cursor', params.cursor);
    if (params?.search) qs.set('search', params.search);
    if (params?.status) qs.set('status', params.status);
    const q = qs.toString();
    return request<PaginatedResponse<RequestResponse>>('GET', `/v1/requests${q ? `?${q}` : ''}`);
  },

  getRequest: (id: string) =>
    request<RequestResponse>('GET', `/v1/requests/${id}`),

  countRequests: (status?: string) => {
    const qs = status ? `?status=${status}` : '';
    return request<{ count: number }>('GET', `/v1/requests/count${qs}`);
  },

  convertRequest: (requestId: string, input: ConvertRequestPayload) =>
    request<ConvertRequestResponse>('POST', `/v1/requests/${requestId}/convert`, input),

  // Quotes
  createQuote: (input: CreateQuoteRequest) =>
    request<QuoteResponse>('POST', '/v1/quotes', input),

  listQuotes: (params?: { limit?: number; cursor?: string; search?: string; status?: string }) => {
    const qs = new URLSearchParams();
    if (params?.limit) qs.set('limit', String(params.limit));
    if (params?.cursor) qs.set('cursor', params.cursor);
    if (params?.search) qs.set('search', params.search);
    if (params?.status) qs.set('status', params.status);
    const q = qs.toString();
    return request<PaginatedResponse<QuoteResponse>>('GET', `/v1/quotes${q ? `?${q}` : ''}`);
  },

  getQuote: (id: string) =>
    request<QuoteResponse>('GET', `/v1/quotes/${id}`),

  updateQuote: (id: string, input: UpdateQuoteRequest) =>
    request<QuoteResponse>('PUT', `/v1/quotes/${id}`, input),

  countQuotes: (status?: string) => {
    const qs = status ? `?status=${status}` : '';
    return request<{ count: number }>('GET', `/v1/quotes/count${qs}`);
  },

  sendQuote: (id: string, input?: { expiresInDays?: number }) =>
    request<SendQuoteResponse>('POST', `/v1/quotes/${id}/send`, input),

  // External quote view (no auth)
  getPublicQuote: (token: string) =>
    publicRequest<PublicQuoteViewResponse>('GET', `/v1/ext/quotes/${token}`),

  approveQuote: (token: string) =>
    publicRequest<QuoteRespondResponse>('POST', `/v1/ext/quotes/${token}/approve`),

  declineQuote: (token: string) =>
    publicRequest<QuoteRespondResponse>('POST', `/v1/ext/quotes/${token}/decline`),

  // Timeline
  getClientTimeline: (clientId: string, params?: { limit?: number; cursor?: string; exclude?: string }) => {
    const qs = new URLSearchParams();
    if (params?.limit) qs.set('limit', String(params.limit));
    if (params?.cursor) qs.set('cursor', params.cursor);
    if (params?.exclude) qs.set('exclude', params.exclude);
    const q = qs.toString();
    return request<PaginatedResponse<TimelineEvent>>('GET', `/v1/clients/${clientId}/timeline${q ? `?${q}` : ''}`);
  },
};

// Public request (no auth headers)
async function publicRequest<T>(method: string, path: string, body?: unknown): Promise<T> {
  const correlationId = crypto.randomUUID();

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      'X-Correlation-Id': correlationId,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const err: ApiError = await res.json().catch(() => ({
      error: { code: 'UNKNOWN', message: res.statusText },
    }));
    throw new ApiClientError(res.status, err.error.code, err.error.message);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}

export interface PublicRequestPayload {
  clientName: string;
  clientEmail: string;
  clientPhone?: string | null;
  description: string;
  website?: string; // honeypot
}

export interface PublicRequestResponse {
  id: string;
  status: string;
  createdAt: string;
}

export interface RequestResponse {
  id: string;
  tenantId: string;
  source: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string | null;
  description: string;
  status: string;
  assignedUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface QuoteLineItemResponse {
  serviceItemId: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface QuoteResponse {
  id: string;
  tenantId: string;
  requestId: string | null;
  clientId: string;
  propertyId: string | null;
  title: string;
  lineItems: QuoteLineItemResponse[];
  subtotal: number;
  tax: number;
  total: number;
  status: string;
  sentAt: string | null;
  approvedAt: string | null;
  declinedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateQuoteRequest {
  clientId: string;
  propertyId?: string | null;
  title: string;
}

export interface UpdateQuoteRequest {
  title?: string;
  lineItems?: Array<{
    serviceItemId?: string | null;
    description: string;
    quantity: number;
    unitPrice: number;
  }>;
  tax?: number;
}

export interface ConvertRequestPayload {
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

export interface ConvertRequestResponse {
  request: RequestResponse;
  client: ClientResponse;
  property: PropertyResponse;
  quote: QuoteResponse;
  clientCreated: boolean;
}

export interface SendQuoteResponse {
  quote: QuoteResponse;
  token: string;
  link: string;
}

export interface PublicQuoteViewResponse {
  quote: {
    id: string;
    title: string;
    lineItems: QuoteLineItemResponse[];
    subtotal: number;
    tax: number;
    total: number;
    status: string;
    sentAt: string | null;
    approvedAt: string | null;
    declinedAt: string | null;
    createdAt: string;
  };
  businessName: string;
  clientName: string;
  propertyAddress: string | null;
}

export interface QuoteRespondResponse {
  quote: {
    id: string;
    status: string;
    approvedAt: string | null;
    declinedAt: string | null;
  };
}

export { ApiClientError };

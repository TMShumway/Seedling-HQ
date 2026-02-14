import type {
  TenantResponse,
  UserResponse,
  CreateTenantRequest,
  CreateTenantResponse,
  BusinessSettingsResponse,
  UpsertBusinessSettingsRequest,
  ServiceCategoryResponse,
  CreateServiceCategoryRequest,
  UpdateServiceCategoryRequest,
  ServiceItemResponse,
  CreateServiceItemRequest,
  UpdateServiceItemRequest,
  PaginatedResponse,
  ClientResponse,
  CreateClientRequest,
  UpdateClientRequest,
  PropertyResponse,
  CreatePropertyRequest,
  UpdatePropertyRequest,
  TimelineEvent,
  LoginResponse,
  LocalVerifyResponse,
  PublicRequestPayload,
  PublicRequestResponse,
  RequestResponse,
  QuoteResponse,
  CreateQuoteRequest,
  UpdateQuoteRequest,
  ConvertRequestPayload,
  ConvertRequestResponse,
  SendQuoteResponse,
  PublicQuoteViewResponse,
  QuoteRespondResponse,
  JobResponse,
  CreateJobResponse,
  VisitResponse,
  VisitWithContextResponse,
  VisitPhotoResponse,
  PresignedPostResponse,
  VisitPhotoWithUrlResponse,
  CreateUserRequest,
} from './api-types';

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
  let authHeaders: Record<string, string>;
  try {
    authHeaders = await getAuthHeaders();
  } catch (err) {
    // Token retrieval failed (e.g., refresh token expired) — trigger auth failure
    if (authProvider) {
      await authProvider.onAuthFailure();
    }
    throw err;
  }

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
    let newToken: string;
    try {
      newToken = await authProvider.forceRefresh();
    } catch {
      // Refresh token expired or revoked — session is unrecoverable
      await authProvider.onAuthFailure();
      const err: ApiError = await res.json().catch(() => ({
        error: { code: 'UNAUTHORIZED', message: res.statusText },
      }));
      throw new ApiClientError(res.status, err.error.code, err.error.message);
    }

    // Retry the request with the fresh token — network errors propagate
    // to the caller without logging out (session is still valid)
    res = await doFetch(newToken ? { Authorization: `Bearer ${newToken}` } : {});

    if (res.status === 401) {
      // Server rejected the fresh token — session is invalid
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

  localVerify: (userId: string, password: string) =>
    publicRequest<LocalVerifyResponse>('POST', '/v1/auth/local/verify', { userId, password }),

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

  // Jobs
  createJobFromQuote: (quoteId: string) =>
    request<CreateJobResponse>('POST', '/v1/jobs', { quoteId }),

  listJobs: (params?: { limit?: number; cursor?: string; search?: string; status?: string }) => {
    const qs = new URLSearchParams();
    if (params?.limit) qs.set('limit', String(params.limit));
    if (params?.cursor) qs.set('cursor', params.cursor);
    if (params?.search) qs.set('search', params.search);
    if (params?.status) qs.set('status', params.status);
    const q = qs.toString();
    return request<PaginatedResponse<JobResponse>>('GET', `/v1/jobs${q ? `?${q}` : ''}`);
  },

  getJob: (id: string) =>
    request<JobResponse>('GET', `/v1/jobs/${id}`),

  getJobByQuoteId: (quoteId: string) =>
    request<JobResponse>('GET', `/v1/jobs/by-quote/${quoteId}`),

  countJobs: (status?: string) => {
    const qs = status ? `?status=${status}` : '';
    return request<{ count: number }>('GET', `/v1/jobs/count${qs}`);
  },

  // Visits (schedule)
  listVisits: (params: { from: string; to: string; status?: string; assignedUserId?: string }) => {
    const qs = new URLSearchParams({ from: params.from, to: params.to });
    if (params.status) qs.set('status', params.status);
    if (params.assignedUserId) qs.set('assignedUserId', params.assignedUserId);
    return request<{ data: VisitWithContextResponse[] }>('GET', `/v1/visits?${qs.toString()}`);
  },

  listUnscheduledVisits: (params?: { assignedUserId?: string }) => {
    const qs = new URLSearchParams();
    if (params?.assignedUserId) qs.set('assignedUserId', params.assignedUserId);
    const q = qs.toString();
    return request<{ data: VisitWithContextResponse[] }>('GET', `/v1/visits/unscheduled${q ? `?${q}` : ''}`);
  },

  scheduleVisit: (id: string, body: { scheduledStart: string; scheduledEnd?: string }) =>
    request<{ visit: VisitResponse }>('PATCH', `/v1/visits/${id}/schedule`, body),

  assignVisit: (id: string, body: { assignedUserId: string | null }) =>
    request<{ visit: VisitResponse }>('PATCH', `/v1/visits/${id}/assign`, body),

  transitionVisitStatus: (id: string, status: string) =>
    request<{ visit: VisitResponse }>('PATCH', `/v1/visits/${id}/status`, { status }),

  updateVisitNotes: (visitId: string, notes: string | null) =>
    request<{ visit: VisitResponse }>('PATCH', `/v1/visits/${visitId}/notes`, { notes }),

  // Visit Photos
  createVisitPhoto: (visitId: string, fileName: string, contentType: string) =>
    request<{ photo: VisitPhotoResponse; uploadPost: PresignedPostResponse }>('POST', `/v1/visits/${visitId}/photos`, { fileName, contentType }),

  confirmVisitPhoto: (visitId: string, photoId: string) =>
    request<{ photo: VisitPhotoResponse }>('POST', `/v1/visits/${visitId}/photos/${photoId}/confirm`),

  listVisitPhotos: (visitId: string) =>
    request<{ data: VisitPhotoWithUrlResponse[] }>('GET', `/v1/visits/${visitId}/photos`),

  deleteVisitPhoto: (visitId: string, photoId: string) =>
    request<void>('DELETE', `/v1/visits/${visitId}/photos/${photoId}`),

  // Team
  listUsers: () =>
    request<{ users: UserResponse[] }>('GET', '/v1/users'),

  createUser: (input: CreateUserRequest) =>
    request<{ user: UserResponse }>('POST', '/v1/users', input),

  resetUserPassword: (userId: string, password: string) =>
    request<{ success: boolean }>('POST', `/v1/users/${userId}/reset-password`, { password }),

  changeMyPassword: (currentPassword: string, newPassword: string) =>
    request<{ success: boolean }>('POST', '/v1/users/me/password', { currentPassword, newPassword }),

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

export { ApiClientError };

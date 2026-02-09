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

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
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

export const apiClient = {
  createTenant: (input: CreateTenantRequest) =>
    request<CreateTenantResponse>('POST', '/v1/tenants', input),

  getTenantMe: () => request<TenantResponse>('GET', '/v1/tenants/me'),

  getUserMe: () => request<UserResponse>('GET', '/v1/users/me'),

  getBusinessSettings: () =>
    request<BusinessSettingsResponse | null>('GET', '/v1/tenants/me/settings'),

  upsertBusinessSettings: (input: UpsertBusinessSettingsRequest) =>
    request<BusinessSettingsResponse>('PUT', '/v1/tenants/me/settings', input),
};

export { ApiClientError };

/**
 * Curated type aliases from the generated OpenAPI types.
 * Import these instead of reaching into paths[...] directly.
 *
 * Regenerate with: pnpm gen
 */
import type { paths } from './api-types.gen';

// ── Helpers ──────────────────────────────────────────────────────────
type JsonResponse<P extends keyof paths, M extends keyof paths[P], S extends number> =
  paths[P][M] extends { responses: Record<S, { content: { 'application/json': infer R } }> } ? R : never;

type JsonBody<P extends keyof paths, M extends keyof paths[P]> =
  paths[P][M] extends { requestBody: { content: { 'application/json': infer B } } } ? B : never;

// ── Tenants ──────────────────────────────────────────────────────────
export type TenantResponse = JsonResponse<'/v1/tenants/me', 'get', 200>;
export type CreateTenantRequest = JsonBody<'/v1/tenants', 'post'>;
export type CreateTenantResponse = JsonResponse<'/v1/tenants', 'post', 201>;

// ── Users ────────────────────────────────────────────────────────────
export type UserResponse = JsonResponse<'/v1/users/me', 'get', 200>;
// password is required in local mode but absent in cognito mode;
// the generated schema reflects whichever AUTH_MODE was active at gen time.
export type CreateUserRequest = Omit<JsonBody<'/v1/users', 'post'>, 'password'> & { password?: string };

// ── Business Settings ────────────────────────────────────────────────
export type BusinessSettingsResponse = JsonResponse<'/v1/tenants/me/settings', 'get', 200>;
export type UpsertBusinessSettingsRequest = JsonBody<'/v1/tenants/me/settings', 'put'>;
export type DaySchedule = {
  open: string | null;
  close: string | null;
  closed: boolean;
};
export type BusinessHoursResponse = {
  monday: DaySchedule;
  tuesday: DaySchedule;
  wednesday: DaySchedule;
  thursday: DaySchedule;
  friday: DaySchedule;
  saturday: DaySchedule;
  sunday: DaySchedule;
};

// ── Service Categories ───────────────────────────────────────────────
export type ServiceCategoryResponse = JsonResponse<'/v1/services/categories/{id}', 'get', 200>;
export type CreateServiceCategoryRequest = JsonBody<'/v1/services/categories', 'post'>;
export type UpdateServiceCategoryRequest = JsonBody<'/v1/services/categories/{id}', 'put'>;

// ── Service Items ────────────────────────────────────────────────────
export type ServiceItemResponse = JsonResponse<'/v1/services/{id}', 'get', 200>;
export type CreateServiceItemRequest = JsonBody<'/v1/services', 'post'>;
export type UpdateServiceItemRequest = JsonBody<'/v1/services/{id}', 'put'>;

// ── Clients ──────────────────────────────────────────────────────────
export type ClientResponse = JsonResponse<'/v1/clients/{id}', 'get', 200>;
export type CreateClientRequest = JsonBody<'/v1/clients', 'post'>;
export type UpdateClientRequest = JsonBody<'/v1/clients/{id}', 'put'>;

// ── Pagination ───────────────────────────────────────────────────────
export interface PaginatedResponse<T> {
  data: T[];
  cursor: string | null;
  hasMore: boolean;
}

// ── Properties ───────────────────────────────────────────────────────
export type PropertyResponse = JsonResponse<'/v1/properties/{id}', 'get', 200>;
export type CreatePropertyRequest = JsonBody<'/v1/clients/{clientId}/properties', 'post'>;
export type UpdatePropertyRequest = JsonBody<'/v1/properties/{id}', 'put'>;

// ── Timeline ─────────────────────────────────────────────────────────
export type TimelineEvent = JsonResponse<'/v1/clients/{clientId}/timeline', 'get', 200>['data'][number];

// ── Auth ─────────────────────────────────────────────────────────────
export type LoginAccount = JsonResponse<'/v1/auth/local/login', 'post', 200>['accounts'][number];
export type LoginResponse = JsonResponse<'/v1/auth/local/login', 'post', 200>;
export type LocalVerifyResponse = JsonResponse<'/v1/auth/local/verify', 'post', 200>;

// ── Requests ─────────────────────────────────────────────────────────
export type PublicRequestPayload = JsonBody<'/v1/public/requests/{tenantSlug}', 'post'>;
export type PublicRequestResponse = JsonResponse<'/v1/public/requests/{tenantSlug}', 'post', 201>;
export type RequestResponse = JsonResponse<'/v1/requests/{id}', 'get', 200>;
export type ConvertRequestPayload = JsonBody<'/v1/requests/{id}/convert', 'post'>;
export type ConvertRequestResponse = JsonResponse<'/v1/requests/{id}/convert', 'post', 200>;

// ── Quotes ───────────────────────────────────────────────────────────
export type QuoteResponse = JsonResponse<'/v1/quotes/{id}', 'get', 200>;
export type QuoteLineItemResponse = QuoteResponse['lineItems'][number];
export type CreateQuoteRequest = JsonBody<'/v1/quotes', 'post'>;
export type UpdateQuoteRequest = JsonBody<'/v1/quotes/{id}', 'put'>;
export type SendQuoteResponse = JsonResponse<'/v1/quotes/{id}/send', 'post', 200>;
export type PublicQuoteViewResponse = JsonResponse<'/v1/ext/quotes/{token}', 'get', 200>;
export type QuoteRespondResponse = JsonResponse<'/v1/ext/quotes/{token}/approve', 'post', 200>;

// ── Jobs ─────────────────────────────────────────────────────────────
export type JobResponse = JsonResponse<'/v1/jobs/{id}', 'get', 200>;
export type CreateJobResponse = JsonResponse<'/v1/jobs', 'post', 200>;

// ── Visits ───────────────────────────────────────────────────────────
export type VisitResponse = JsonResponse<'/v1/visits/{id}/schedule', 'patch', 200>['visit'];
export type VisitWithContextResponse = JsonResponse<'/v1/visits', 'get', 200>['data'][number];

// ── Visit Photos ─────────────────────────────────────────────────────
export type VisitPhotoResponse = JsonResponse<'/v1/visits/{visitId}/photos/{photoId}/confirm', 'post', 200>['photo'];
export type VisitPhotoWithUrlResponse = JsonResponse<'/v1/visits/{visitId}/photos', 'get', 200>['data'][number];
export type PresignedPostResponse = JsonResponse<'/v1/visits/{visitId}/photos', 'post', 201>['uploadPost'];

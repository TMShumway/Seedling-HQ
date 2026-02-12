import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { apiClient, setAuthProvider, clearAuthProvider } from '@/lib/api-client';
import type { AuthTokenProvider } from '@/lib/api-client';

// Mock global fetch
const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('api-client 401 retry', () => {
  let provider: AuthTokenProvider;
  const mockOnAuthFailure = vi.fn();
  const mockForceRefresh = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    provider = {
      getToken: vi.fn().mockResolvedValue('initial-token'),
      forceRefresh: mockForceRefresh,
      onAuthFailure: mockOnAuthFailure,
    };
    setAuthProvider(provider);
  });

  afterEach(() => {
    clearAuthProvider();
  });

  it('retries on 401, succeeds on second attempt, no logout', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, { error: { code: 'UNAUTHORIZED', message: 'expired' } }))
      .mockResolvedValueOnce(jsonResponse(200, { id: 't1' }));
    mockForceRefresh.mockResolvedValue('refreshed-token');

    const result = await apiClient.getTenantMe();

    expect(result.id).toBe('t1');
    expect(mockForceRefresh).toHaveBeenCalledOnce();
    expect(mockOnAuthFailure).not.toHaveBeenCalled();
    // Verify retry used the refreshed token
    const retryHeaders = fetchMock.mock.calls[1][1].headers;
    expect(retryHeaders.Authorization).toBe('Bearer refreshed-token');
  });

  it('logs out when forceRefresh fails (refresh token expired)', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, { error: { code: 'UNAUTHORIZED', message: 'expired' } }));
    mockForceRefresh.mockRejectedValue(new Error('Refresh failed'));

    await expect(apiClient.getTenantMe()).rejects.toThrow();

    expect(mockForceRefresh).toHaveBeenCalledOnce();
    expect(mockOnAuthFailure).toHaveBeenCalledOnce();
  });

  it('logs out when retry returns 401 (fresh token rejected)', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, { error: { code: 'UNAUTHORIZED', message: 'expired' } }))
      .mockResolvedValueOnce(jsonResponse(401, { error: { code: 'UNAUTHORIZED', message: 'still invalid' } }));
    mockForceRefresh.mockResolvedValue('refreshed-token');

    await expect(apiClient.getTenantMe()).rejects.toThrow();

    expect(mockForceRefresh).toHaveBeenCalledOnce();
    expect(mockOnAuthFailure).toHaveBeenCalledOnce();
  });

  it('does NOT log out when retry fetch throws network error', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, { error: { code: 'UNAUTHORIZED', message: 'expired' } }))
      .mockRejectedValueOnce(new TypeError('Failed to fetch'));
    mockForceRefresh.mockResolvedValue('refreshed-token');

    await expect(apiClient.getTenantMe()).rejects.toThrow('Failed to fetch');

    expect(mockForceRefresh).toHaveBeenCalledOnce();
    expect(mockOnAuthFailure).not.toHaveBeenCalled();
  });

  it('does NOT retry 401 when no auth provider is set', async () => {
    clearAuthProvider();
    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, { error: { code: 'UNAUTHORIZED', message: 'nope' } }));

    await expect(apiClient.getTenantMe()).rejects.toThrow();

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(mockForceRefresh).not.toHaveBeenCalled();
    expect(mockOnAuthFailure).not.toHaveBeenCalled();
  });

  it('does NOT log out when retry returns non-401 error (e.g. 500)', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, { error: { code: 'UNAUTHORIZED', message: 'expired' } }))
      .mockResolvedValueOnce(jsonResponse(500, { error: { code: 'INTERNAL', message: 'Server error' } }));
    mockForceRefresh.mockResolvedValue('refreshed-token');

    await expect(apiClient.getTenantMe()).rejects.toThrow('Server error');

    expect(mockForceRefresh).toHaveBeenCalledOnce();
    expect(mockOnAuthFailure).not.toHaveBeenCalled();
  });

  it('awaits onAuthFailure when forceRefresh fails', async () => {
    let resolved = false;
    mockOnAuthFailure.mockImplementation(() =>
      new Promise<void>((resolve) => setTimeout(() => { resolved = true; resolve(); }, 10)),
    );
    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, { error: { code: 'UNAUTHORIZED', message: 'expired' } }));
    mockForceRefresh.mockRejectedValue(new Error('Refresh failed'));

    await expect(apiClient.getTenantMe()).rejects.toThrow();

    expect(mockOnAuthFailure).toHaveBeenCalledOnce();
    expect(resolved).toBe(true);
  });

  it('awaits onAuthFailure when retry returns 401', async () => {
    let resolved = false;
    mockOnAuthFailure.mockImplementation(() =>
      new Promise<void>((resolve) => setTimeout(() => { resolved = true; resolve(); }, 10)),
    );
    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, { error: { code: 'UNAUTHORIZED', message: 'expired' } }))
      .mockResolvedValueOnce(jsonResponse(401, { error: { code: 'UNAUTHORIZED', message: 'still invalid' } }));
    mockForceRefresh.mockResolvedValue('refreshed-token');

    await expect(apiClient.getTenantMe()).rejects.toThrow();

    expect(mockOnAuthFailure).toHaveBeenCalledOnce();
    expect(resolved).toBe(true);
  });
});

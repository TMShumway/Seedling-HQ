import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { VisitWithContextResponse } from '@/lib/api-client';

// Mock auth context
vi.mock('@/lib/auth/auth-context', () => ({
  useAuth: () => ({
    user: { userId: 'user-1', tenantId: 'tenant-1', role: 'owner', name: 'Test User', tenantName: 'Test Co' },
    isAuthenticated: true,
    isLoading: false,
  }),
}));

// Mock api-client
const mockUpdateVisitNotes = vi.fn();
const mockTransitionVisitStatus = vi.fn();
const mockListVisits = vi.fn();
const mockListVisitPhotos = vi.fn();
const mockCreateVisitPhoto = vi.fn();
const mockConfirmVisitPhoto = vi.fn();
const mockDeleteVisitPhoto = vi.fn();

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    listVisits: (...args: unknown[]) => mockListVisits(...args),
    updateVisitNotes: (...args: unknown[]) => mockUpdateVisitNotes(...args),
    transitionVisitStatus: (...args: unknown[]) => mockTransitionVisitStatus(...args),
    listVisitPhotos: (...args: unknown[]) => mockListVisitPhotos(...args),
    createVisitPhoto: (...args: unknown[]) => mockCreateVisitPhoto(...args),
    confirmVisitPhoto: (...args: unknown[]) => mockConfirmVisitPhoto(...args),
    deleteVisitPhoto: (...args: unknown[]) => mockDeleteVisitPhoto(...args),
  },
}));

import { TodayPage } from '@/pages/TodayPage';

function makeVisit(overrides: Partial<VisitWithContextResponse> = {}): VisitWithContextResponse {
  return {
    id: 'visit-1',
    tenantId: 'tenant-1',
    jobId: 'job-1',
    assignedUserId: 'user-1',
    scheduledStart: new Date().toISOString(),
    scheduledEnd: null,
    estimatedDurationMinutes: 60,
    status: 'started',
    notes: null,
    completedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    jobTitle: 'Lawn Mowing',
    clientName: 'John Doe',
    propertyAddress: '123 Main St',
    assignedUserName: 'Test User',
    clientPhone: '555-1234',
    clientEmail: 'john@example.com',
    ...overrides,
  };
}

function renderWithProviders(ui: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>,
  );
}

describe('TodayPage visit notes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListVisitPhotos.mockResolvedValue({ data: [] });
  });

  afterEach(() => {
    cleanup();
  });

  it('shows editable textarea for started visit', async () => {
    const visit = makeVisit({ status: 'started' });
    mockListVisits.mockResolvedValue({ data: [visit] });

    renderWithProviders(<TodayPage />);

    const textarea = await screen.findByTestId('visit-notes-input');
    expect(textarea).toBeDefined();
    expect(textarea.tagName.toLowerCase()).toBe('textarea');
    expect((textarea as HTMLTextAreaElement).disabled).toBe(false);

    // Save button should be present
    const saveBtn = screen.getByTestId('visit-notes-save');
    expect(saveBtn).toBeDefined();
    expect(saveBtn.textContent).toBe('Save Notes');
  });

  it('shows editable textarea for en_route visit', async () => {
    const visit = makeVisit({ status: 'en_route' });
    mockListVisits.mockResolvedValue({ data: [visit] });

    renderWithProviders(<TodayPage />);

    const textarea = await screen.findByTestId('visit-notes-input');
    expect(textarea).toBeDefined();
    expect((textarea as HTMLTextAreaElement).disabled).toBe(false);
  });

  it('shows read-only notes for completed visit with notes', async () => {
    const visit = makeVisit({ status: 'completed', notes: 'All done!', completedAt: new Date().toISOString() });
    mockListVisits.mockResolvedValue({ data: [visit] });

    renderWithProviders(<TodayPage />);

    const display = await screen.findByTestId('visit-notes-display');
    expect(display.textContent).toBe('All done!');

    // Should NOT have textarea
    expect(screen.queryByTestId('visit-notes-input')).toBeNull();
    // Should NOT have save button
    expect(screen.queryByTestId('visit-notes-save')).toBeNull();
  });

  it('hides notes section for completed visit without notes', async () => {
    const visit = makeVisit({ status: 'completed', notes: null, completedAt: new Date().toISOString() });
    mockListVisits.mockResolvedValue({ data: [visit] });

    renderWithProviders(<TodayPage />);

    // Wait for data to load by finding the completed time indicator
    await screen.findByTestId('completed-time');

    expect(screen.queryByTestId('visit-notes-input')).toBeNull();
    expect(screen.queryByTestId('visit-notes-display')).toBeNull();
  });

  it('hides notes section for scheduled visit', async () => {
    const visit = makeVisit({ status: 'scheduled' });
    mockListVisits.mockResolvedValue({ data: [visit] });

    renderWithProviders(<TodayPage />);

    // Wait for visit card to render
    await screen.findByTestId('today-visit-card');

    expect(screen.queryByTestId('visit-notes-input')).toBeNull();
    expect(screen.queryByTestId('visit-notes-display')).toBeNull();
    expect(screen.queryByTestId('visit-notes-save')).toBeNull();
  });

  it('hides notes section for cancelled visit', async () => {
    const visit = makeVisit({ status: 'cancelled' });
    mockListVisits.mockResolvedValue({ data: [visit] });

    renderWithProviders(<TodayPage />);

    await screen.findByTestId('today-visit-card');

    expect(screen.queryByTestId('visit-notes-input')).toBeNull();
    expect(screen.queryByTestId('visit-notes-display')).toBeNull();
  });

  it('calls updateVisitNotes on save click', async () => {
    const visit = makeVisit({ status: 'started' });
    mockListVisits.mockResolvedValue({ data: [visit] });
    mockUpdateVisitNotes.mockResolvedValue({ visit: { ...visit, notes: 'New note' } });

    renderWithProviders(<TodayPage />);

    const textarea = await screen.findByTestId('visit-notes-input');
    fireEvent.change(textarea, { target: { value: 'New note' } });

    const saveBtn = screen.getByTestId('visit-notes-save');
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(mockUpdateVisitNotes).toHaveBeenCalledWith('visit-1', 'New note');
    });
  });

  it('sends null when saving empty notes', async () => {
    const visit = makeVisit({ status: 'started', notes: 'Some notes' });
    mockListVisits.mockResolvedValue({ data: [visit] });
    mockUpdateVisitNotes.mockResolvedValue({ visit: { ...visit, notes: null } });

    renderWithProviders(<TodayPage />);

    const textarea = await screen.findByTestId('visit-notes-input');
    fireEvent.change(textarea, { target: { value: '' } });

    const saveBtn = screen.getByTestId('visit-notes-save');
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(mockUpdateVisitNotes).toHaveBeenCalledWith('visit-1', null);
    });
  });

  it('pre-fills textarea with existing notes', async () => {
    const visit = makeVisit({ status: 'started', notes: 'Existing notes' });
    mockListVisits.mockResolvedValue({ data: [visit] });

    renderWithProviders(<TodayPage />);

    const textarea = await screen.findByTestId('visit-notes-input') as HTMLTextAreaElement;
    expect(textarea.value).toBe('Existing notes');
  });
});

describe('TodayPage completion confirmation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListVisitPhotos.mockResolvedValue({ data: [] });
  });

  afterEach(() => {
    cleanup();
  });

  it('shows confirmation dialog when Complete is clicked', async () => {
    const visit = makeVisit({ status: 'started' });
    mockListVisits.mockResolvedValue({ data: [visit] });

    renderWithProviders(<TodayPage />);

    const completeBtn = await screen.findByTestId('action-complete');
    fireEvent.click(completeBtn);

    // Confirmation should appear
    const confirmSection = screen.getByTestId('confirm-complete');
    expect(confirmSection).toBeDefined();
    expect(confirmSection.textContent).toContain('Any notes or photos to add?');

    // Complete Anyway and Go Back buttons should be visible
    expect(screen.getByTestId('complete-anyway')).toBeDefined();
    expect(screen.getByTestId('cancel-complete')).toBeDefined();

    // Original Complete button should be hidden
    expect(screen.queryByTestId('action-complete')).toBeNull();
  });

  it('dismisses confirmation on Go Back', async () => {
    const visit = makeVisit({ status: 'started' });
    mockListVisits.mockResolvedValue({ data: [visit] });

    renderWithProviders(<TodayPage />);

    const completeBtn = await screen.findByTestId('action-complete');
    fireEvent.click(completeBtn);

    const goBackBtn = screen.getByTestId('cancel-complete');
    fireEvent.click(goBackBtn);

    // Confirmation should be gone
    expect(screen.queryByTestId('confirm-complete')).toBeNull();

    // Complete button should be back
    expect(screen.getByTestId('action-complete')).toBeDefined();
  });

  it('triggers mutation on Complete Anyway', async () => {
    const visit = makeVisit({ status: 'started' });
    mockListVisits.mockResolvedValue({ data: [visit] });
    mockTransitionVisitStatus.mockResolvedValue({ visit: { ...visit, status: 'completed' } });

    renderWithProviders(<TodayPage />);

    const completeBtn = await screen.findByTestId('action-complete');
    fireEvent.click(completeBtn);

    const completeAnywayBtn = screen.getByTestId('complete-anyway');
    fireEvent.click(completeAnywayBtn);

    await waitFor(() => {
      expect(mockTransitionVisitStatus).toHaveBeenCalledWith('visit-1', 'completed');
    });
  });
});

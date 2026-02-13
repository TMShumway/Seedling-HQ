import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { VisitPhotoWithUrlResponse } from '@/lib/api-client';

// Mock api-client
const mockCreateVisitPhoto = vi.fn();
const mockConfirmVisitPhoto = vi.fn();
const mockListVisitPhotos = vi.fn();
const mockDeleteVisitPhoto = vi.fn();

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    createVisitPhoto: (...args: unknown[]) => mockCreateVisitPhoto(...args),
    confirmVisitPhoto: (...args: unknown[]) => mockConfirmVisitPhoto(...args),
    listVisitPhotos: (...args: unknown[]) => mockListVisitPhotos(...args),
    deleteVisitPhoto: (...args: unknown[]) => mockDeleteVisitPhoto(...args),
  },
}));

// Mock fetch for S3 upload
const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

import { PhotoUpload } from '@/components/visits/PhotoUpload';
import { PhotoGallery } from '@/components/visits/PhotoGallery';

function makePhoto(overrides: Partial<VisitPhotoWithUrlResponse> = {}): VisitPhotoWithUrlResponse {
  return {
    id: 'photo-1',
    tenantId: 'tenant-1',
    visitId: 'visit-1',
    storageKey: 'tenants/t1/visits/v1/photos/p1.jpg',
    fileName: 'lawn-before.jpg',
    contentType: 'image/jpeg',
    sizeBytes: null,
    status: 'ready',
    createdAt: new Date().toISOString(),
    downloadUrl: 'http://localhost:4566/test-bucket/photo1.jpg?signed=true',
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

describe('PhotoUpload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders upload button', () => {
    renderWithProviders(<PhotoUpload visitId="visit-1" />);

    const btn = screen.getByTestId('photo-upload-btn');
    expect(btn).toBeDefined();
    expect(btn.textContent).toContain('Add Photo');
  });

  it('has hidden file input with correct accept types', () => {
    renderWithProviders(<PhotoUpload visitId="visit-1" />);

    const input = screen.getByTestId('photo-upload-input') as HTMLInputElement;
    expect(input.type).toBe('file');
    expect(input.accept).toBe('image/jpeg,image/png,image/heic,image/webp');
  });

  it('rejects files exceeding 10MB', async () => {
    renderWithProviders(<PhotoUpload visitId="visit-1" />);

    const input = screen.getByTestId('photo-upload-input');
    const largeFile = new File(['x'.repeat(100)], 'huge.jpg', { type: 'image/jpeg' });
    Object.defineProperty(largeFile, 'size', { value: 11_000_000 });

    fireEvent.change(input, { target: { files: [largeFile] } });

    const error = await screen.findByTestId('photo-upload-error');
    expect(error.textContent).toContain('huge.jpg: exceeds 10MB');
    expect(mockCreateVisitPhoto).not.toHaveBeenCalled();
  });

  it('rejects unsupported file types', async () => {
    renderWithProviders(<PhotoUpload visitId="visit-1" />);

    const input = screen.getByTestId('photo-upload-input');
    const pdfFile = new File(['content'], 'doc.pdf', { type: 'application/pdf' });

    fireEvent.change(input, { target: { files: [pdfFile] } });

    const error = await screen.findByTestId('photo-upload-error');
    expect(error.textContent).toContain('doc.pdf: unsupported type');
  });
});

describe('PhotoGallery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders nothing when no photos', () => {
    renderWithProviders(<PhotoGallery visitId="visit-1" photos={[]} />);
    expect(screen.queryByTestId('photo-gallery')).toBeNull();
  });

  it('renders thumbnails for photos', () => {
    const photos = [
      makePhoto({ id: 'p1', fileName: 'photo1.jpg' }),
      makePhoto({ id: 'p2', fileName: 'photo2.jpg', downloadUrl: 'http://localhost/p2.jpg' }),
    ];

    renderWithProviders(<PhotoGallery visitId="visit-1" photos={photos} />);

    const gallery = screen.getByTestId('photo-gallery');
    expect(gallery).toBeDefined();

    const thumbnails = screen.getAllByTestId('photo-thumbnail');
    expect(thumbnails).toHaveLength(2);
  });

  it('shows delete button on hover when canDelete is true', () => {
    const photos = [makePhoto()];

    renderWithProviders(<PhotoGallery visitId="visit-1" photos={photos} canDelete={true} />);

    const deleteBtn = screen.getByTestId('delete-photo-btn');
    expect(deleteBtn).toBeDefined();
  });

  it('hides delete button when canDelete is false', () => {
    const photos = [makePhoto()];

    renderWithProviders(<PhotoGallery visitId="visit-1" photos={photos} canDelete={false} />);

    expect(screen.queryByTestId('delete-photo-btn')).toBeNull();
  });

  it('shows confirmation on delete click', async () => {
    const photos = [makePhoto()];

    renderWithProviders(<PhotoGallery visitId="visit-1" photos={photos} canDelete={true} />);

    const deleteBtn = screen.getByTestId('delete-photo-btn');
    fireEvent.click(deleteBtn);

    const confirmBtn = screen.getByTestId('confirm-delete-photo');
    expect(confirmBtn).toBeDefined();
    expect(confirmBtn.textContent).toBe('Delete');

    const cancelBtn = screen.getByTestId('cancel-delete-photo');
    expect(cancelBtn).toBeDefined();
  });

  it('cancels delete confirmation', async () => {
    const photos = [makePhoto()];

    renderWithProviders(<PhotoGallery visitId="visit-1" photos={photos} canDelete={true} />);

    fireEvent.click(screen.getByTestId('delete-photo-btn'));
    fireEvent.click(screen.getByTestId('cancel-delete-photo'));

    // Confirmation should be gone
    expect(screen.queryByTestId('confirm-delete-photo')).toBeNull();
    // Delete button should be back
    expect(screen.getByTestId('delete-photo-btn')).toBeDefined();
  });

  it('calls deleteVisitPhoto on confirm', async () => {
    const photos = [makePhoto({ id: 'photo-42' })];
    mockDeleteVisitPhoto.mockResolvedValue(undefined);

    renderWithProviders(<PhotoGallery visitId="visit-1" photos={photos} canDelete={true} />);

    fireEvent.click(screen.getByTestId('delete-photo-btn'));
    fireEvent.click(screen.getByTestId('confirm-delete-photo'));

    await waitFor(() => {
      expect(mockDeleteVisitPhoto).toHaveBeenCalledWith('visit-1', 'photo-42');
    });
  });
});

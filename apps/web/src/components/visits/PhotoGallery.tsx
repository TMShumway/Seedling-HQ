import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api-client';
import type { VisitPhotoWithUrlResponse } from '@/lib/api-client';

interface PhotoGalleryProps {
  visitId: string;
  photos: VisitPhotoWithUrlResponse[];
  canDelete?: boolean;
}

export function PhotoGallery({ visitId, photos, canDelete = false }: PhotoGalleryProps) {
  const queryClient = useQueryClient();
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const deleteMutation = useMutation({
    mutationFn: (photoId: string) => apiClient.deleteVisitPhoto(visitId, photoId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['visit-photos', visitId] });
      setConfirmingId(null);
    },
  });

  if (photos.length === 0) return null;

  return (
    <div className="space-y-2" data-testid="photo-gallery">
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {photos.map((photo) => (
          <div key={photo.id} className="group relative" data-testid="photo-thumbnail">
            <a
              href={photo.downloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block overflow-hidden rounded-md border"
            >
              <img
                src={photo.downloadUrl}
                alt={photo.fileName}
                className="aspect-square w-full object-cover"
                loading="lazy"
              />
            </a>
            {canDelete && confirmingId !== photo.id && (
              <button
                className="absolute right-1 top-1 rounded-full bg-white/80 p-1 text-destructive shadow-sm transition-opacity sm:opacity-0 sm:group-hover:opacity-100"
                onClick={() => setConfirmingId(photo.id)}
                data-testid="delete-photo-btn"
                aria-label={`Delete ${photo.fileName}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
            {canDelete && confirmingId === photo.id && (
              <div className="absolute inset-0 flex items-center justify-center rounded-md bg-black/50">
                <div className="flex gap-1">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => deleteMutation.mutate(photo.id)}
                    disabled={deleteMutation.isPending}
                    data-testid="confirm-delete-photo"
                  >
                    Delete
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setConfirmingId(null)}
                    data-testid="cancel-delete-photo"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

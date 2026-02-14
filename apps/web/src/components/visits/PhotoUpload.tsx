import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api-client';

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/heic', 'image/webp'];
const MAX_SIZE_BYTES = 10_485_760; // 10MB

interface PhotoUploadProps {
  visitId: string;
}

export function PhotoUpload({ visitId }: PhotoUploadProps) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleFiles(files: FileList) {
    setError(null);
    setUploading(true);

    const validFiles: File[] = [];
    const rejected: string[] = [];

    for (const file of Array.from(files)) {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        rejected.push(`${file.name}: unsupported type`);
      } else if (file.size > MAX_SIZE_BYTES) {
        rejected.push(`${file.name}: exceeds 10MB`);
      } else {
        validFiles.push(file);
      }
    }

    if (rejected.length > 0 && validFiles.length === 0) {
      setError(rejected.join(', '));
      setUploading(false);
      return;
    }

    const failed: string[] = [...rejected];

    for (let i = 0; i < validFiles.length; i++) {
      const file = validFiles[i];
      setProgress(`Uploading ${i + 1} of ${validFiles.length}...`);

      let photoId: string | null = null;
      try {
        // 1. Create pending record + get presigned post
        const createRes = await apiClient.createVisitPhoto(visitId, file.name, file.type);
        photoId = createRes.photo.id;

        // 2. Upload to S3 via presigned POST
        const formData = new FormData();
        for (const [key, value] of Object.entries(createRes.uploadPost.fields)) {
          formData.append(key, value);
        }
        formData.append('file', file);

        const uploadRes = await fetch(createRes.uploadPost.url, {
          method: 'POST',
          body: formData,
        });

        if (!uploadRes.ok) {
          throw new Error(`Upload failed: ${uploadRes.status}`);
        }

        // 3. Confirm upload
        await apiClient.confirmVisitPhoto(visitId, photoId);
      } catch (err) {
        failed.push(file.name);
        // Best-effort cleanup of pending record
        if (photoId) {
          try {
            await apiClient.deleteVisitPhoto(visitId, photoId);
          } catch {
            // ignore cleanup failure
          }
        }
      }
    }

    setUploading(false);
    setProgress('');

    if (failed.length > 0) {
      setError(`Failed: ${failed.join(', ')}`);
    }

    // Refresh photo list
    queryClient.invalidateQueries({ queryKey: ['visit-photos', visitId] });

    // Clear file input
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  }

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/heic,image/webp"
        capture="environment"
        multiple
        className="hidden"
        data-testid="photo-upload-input"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            handleFiles(e.target.files);
          }
        }}
      />
      <Button
        variant="outline"
        size="sm"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        data-testid="photo-upload-btn"
      >
        <Camera className="mr-1.5 h-3.5 w-3.5" />
        {uploading ? progress : 'Add Photo'}
      </Button>
      {error && (
        <p className="text-xs text-destructive" data-testid="photo-upload-error">{error}</p>
      )}
    </div>
  );
}

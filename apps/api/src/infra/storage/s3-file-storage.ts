import { S3Client, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { FileStorage, PresignedPost } from '../../application/ports/file-storage.js';

const UPLOAD_EXPIRY_SECONDS = 900; // 15 minutes
const DOWNLOAD_EXPIRY_SECONDS = 3600; // 1 hour

export interface S3FileStorageOptions {
  bucket: string;
  region: string;
  endpoint?: string;
}

export class S3FileStorage implements FileStorage {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(opts: S3FileStorageOptions) {
    this.bucket = opts.bucket;
    this.client = new S3Client({
      region: opts.region,
      ...(opts.endpoint ? { endpoint: opts.endpoint, forcePathStyle: true } : {}),
    });
  }

  async generateUploadPost(key: string, contentType: string, maxSizeBytes: number): Promise<PresignedPost> {
    const { url, fields } = await createPresignedPost(this.client, {
      Bucket: this.bucket,
      Key: key,
      Expires: UPLOAD_EXPIRY_SECONDS,
      Conditions: [
        ['content-length-range', 0, maxSizeBytes],
        ['eq', '$Content-Type', contentType],
        ['eq', '$key', key],
      ],
      Fields: {
        'Content-Type': contentType,
        key,
      },
    });

    return { url, fields };
  }

  async generateDownloadUrl(key: string): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });
    return getSignedUrl(this.client, command, { expiresIn: DOWNLOAD_EXPIRY_SECONDS });
  }

  async deleteObject(key: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });
      await this.client.send(command);
    } catch {
      // Best-effort: suppress errors on delete
    }
  }
}

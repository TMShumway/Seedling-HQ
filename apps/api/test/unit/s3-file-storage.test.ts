import { describe, it, expect, vi, beforeEach } from 'vitest';
import { S3Client, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { S3FileStorage } from '../../src/infra/storage/s3-file-storage.js';

vi.mock('@aws-sdk/client-s3', () => {
  const MockS3Client = vi.fn();
  MockS3Client.prototype.send = vi.fn();
  return {
    S3Client: MockS3Client,
    DeleteObjectCommand: vi.fn(),
    GetObjectCommand: vi.fn(),
  };
});

vi.mock('@aws-sdk/s3-presigned-post', () => ({
  createPresignedPost: vi.fn(),
}));

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: vi.fn(),
}));

describe('S3FileStorage', () => {
  let storage: S3FileStorage;

  beforeEach(() => {
    vi.clearAllMocks();
    storage = new S3FileStorage({
      bucket: 'test-bucket',
      region: 'us-east-1',
    });
  });

  describe('constructor', () => {
    it('configures forcePathStyle when endpoint is set', () => {
      const localStack = new S3FileStorage({
        bucket: 'test-bucket',
        region: 'us-east-1',
        endpoint: 'http://localhost:4566',
      });
      expect(localStack).toBeDefined();
      expect(S3Client).toHaveBeenCalledWith(
        expect.objectContaining({
          endpoint: 'http://localhost:4566',
          forcePathStyle: true,
        }),
      );
    });

    it('does not set forcePathStyle without endpoint', () => {
      expect(S3Client).toHaveBeenCalledWith(
        expect.objectContaining({ region: 'us-east-1' }),
      );
      expect(S3Client).toHaveBeenCalledWith(
        expect.not.objectContaining({ forcePathStyle: true }),
      );
    });
  });

  describe('generateUploadPost', () => {
    it('calls createPresignedPost with correct conditions', async () => {
      const mockResult = {
        url: 'https://test-bucket.s3.amazonaws.com',
        fields: { key: 'test-key', 'Content-Type': 'image/jpeg' },
      };
      vi.mocked(createPresignedPost).mockResolvedValue(mockResult);

      const result = await storage.generateUploadPost('test-key', 'image/jpeg', 10_485_760);

      expect(createPresignedPost).toHaveBeenCalledWith(
        expect.any(S3Client),
        expect.objectContaining({
          Bucket: 'test-bucket',
          Key: 'test-key',
          Expires: 900,
          Conditions: [
            ['content-length-range', 0, 10_485_760],
            ['eq', '$Content-Type', 'image/jpeg'],
            ['eq', '$key', 'test-key'],
          ],
          Fields: {
            'Content-Type': 'image/jpeg',
            key: 'test-key',
          },
        }),
      );
      expect(result).toEqual({ url: mockResult.url, fields: mockResult.fields });
    });
  });

  describe('generateDownloadUrl', () => {
    it('generates a presigned GET URL', async () => {
      vi.mocked(getSignedUrl).mockResolvedValue('https://test-bucket.s3.amazonaws.com/test-key?sig=abc');

      const url = await storage.generateDownloadUrl('test-key');

      expect(GetObjectCommand).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: 'test-key',
      });
      expect(getSignedUrl).toHaveBeenCalledWith(
        expect.any(S3Client),
        expect.any(GetObjectCommand),
        { expiresIn: 3600 },
      );
      expect(url).toBe('https://test-bucket.s3.amazonaws.com/test-key?sig=abc');
    });
  });

  describe('deleteObject', () => {
    it('sends DeleteObjectCommand', async () => {
      vi.mocked(S3Client.prototype.send).mockResolvedValue({} as any);

      await storage.deleteObject('test-key');

      expect(DeleteObjectCommand).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: 'test-key',
      });
      expect(S3Client.prototype.send).toHaveBeenCalled();
    });

    it('suppresses errors on delete', async () => {
      vi.mocked(S3Client.prototype.send).mockRejectedValue(new Error('S3 error'));

      await expect(storage.deleteObject('test-key')).resolves.toBeUndefined();
    });
  });
});

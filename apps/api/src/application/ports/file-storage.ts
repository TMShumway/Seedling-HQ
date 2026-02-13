export interface PresignedPost {
  url: string;
  fields: Record<string, string>;
}

export interface FileStorage {
  generateUploadPost(key: string, contentType: string, maxSizeBytes: number): Promise<PresignedPost>;
  generateDownloadUrl(key: string): Promise<string>;
  deleteObject(key: string): Promise<void>;
}

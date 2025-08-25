export interface UploadProgress {
  stage: string;
  percentage: number;
  message?: string;
  eta?: number;
  bytesUploaded?: number;
  totalBytes?: number;
  configId?: string;
  shareUrl?: string;
}

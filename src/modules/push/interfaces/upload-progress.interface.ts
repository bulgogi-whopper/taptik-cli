export interface UploadProgress {
  phase: 'validating' | 'sanitizing' | 'uploading' | 'registering' | 'complete';
  percentage: number;
  bytesUploaded: number;
  totalBytes: number;
  eta?: number;
  message: string;
}

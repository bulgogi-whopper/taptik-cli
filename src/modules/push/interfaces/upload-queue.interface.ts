import { PushOptions } from './push-options.interface';

export interface QueuedUpload {
  id: string;
  packagePath: string;
  options: PushOptions;
  attempts: number;
  lastAttempt?: Date;
  nextRetry?: Date;
  status: 'pending' | 'uploading' | 'failed' | 'completed';
  error?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

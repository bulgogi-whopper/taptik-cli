export interface SecurityIssue {
  type: string;
  file: string;
  line: number;
  severity: string;
}

export interface PartialUploadResult {
  successful: string[];
  failed: string[];
  errors: string[];
}

export interface UploadError {
  message: string;
  code?: string;
}

export interface BatchConfig {
  id: string;
  name: string;
  size: number;
}

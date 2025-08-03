export interface BuildResult {
  outputDirectory: string;
  files: GeneratedFile[];
  manifest: BuildManifest;
  summary: BuildSummary;
}

export interface GeneratedFile {
  filename: string;
  path: string;
  size: number;
  category: string;
  checksum?: string;
}

export interface BuildManifest {
  build_id: string;
  source_platform: string;
  categories: string[];
  created_at: string;
  taptik_version: string;
  source_files: {
    local: string[];
    global: string[];
  };
  conversion_metadata: ConversionMetadata;
}

export interface ConversionMetadata {
  total_files_processed: number;
  successful_conversions: number;
  warnings: number;
  errors: number;
  processing_time_ms: number;
}

export interface BuildSummary {
  success: boolean;
  totalFiles: number;
  totalSize: number;
  categories: string[];
  warnings: string[];
  errors: string[];
  outputPath: string;
}

export interface BuildMetadata {
  buildId: string;
  platform: string;
  categories: string[];
  timestamp: Date;
  version: string;
}
export enum PackageVisibility {
  Public = 'public',
  Private = 'private',
}

export interface PushOptions {
  file: {
    buffer: Buffer;
    name: string;
    size: number;
    path: string;
  };
  visibility: PackageVisibility;
  title: string;
  description?: string;
  tags: string[];
  teamId?: string;
  version: string;
  force: boolean;
  dryRun: boolean;
}

export interface ComponentInfo {
  name: string;
  type: string;
  count: number;
}

export interface PackageMetadata {
  id: string;
  configId: string;
  name: string;
  title: string;
  description?: string;
  version: string;
  platform: string;
  isPublic: boolean;
  sanitizationLevel: 'safe' | 'warning' | 'blocked';
  checksum: string;
  storageUrl: string;
  packageSize: number;
  userId: string;
  teamId?: string;
  components: ComponentInfo[];
  autoTags: string[];
  userTags: string[];
  createdAt: Date;
  updatedAt: Date;
}
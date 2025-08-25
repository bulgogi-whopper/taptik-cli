export interface PushOptions {
  public?: boolean;
  private?: boolean;
  title?: string;
  description?: string;
  tags?: string[];
  team?: string;
  version?: string;
  force?: boolean;
  dryRun?: boolean;
}
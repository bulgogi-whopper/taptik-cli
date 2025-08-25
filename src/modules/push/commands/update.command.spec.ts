import chalk from 'chalk';
import inquirer from 'inquirer';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { PackageMetadata } from '../interfaces';

import { UpdateCommand } from './update.command';

vi.mock('inquirer', () => ({
  default: {
    prompt: vi.fn(),
  },
}));

vi.mock('chalk', () => ({
  default: {
    red: vi.fn((text: string) => text),
    green: vi.fn((text: string) => text),
    yellow: vi.fn((text: string) => text),
    cyan: vi.fn((text: string) => text),
    blue: vi.fn((text: string) => text),
    gray: vi.fn((text: string) => text),
    white: vi.fn((text: string) => text),
    bold: vi.fn((text: string) => text),
  },
  red: vi.fn((text: string) => text),
  green: vi.fn((text: string) => text),
  yellow: vi.fn((text: string) => text),
  cyan: vi.fn((text: string) => text),
  blue: vi.fn((text: string) => text),
  gray: vi.fn((text: string) => text),
  white: vi.fn((text: string) => text),
  bold: vi.fn((text: string) => text),
}));

describe('UpdateCommand', () => {
  let command: UpdateCommand;
  let mockAuthService: { getSession: any };
  let mockPackageRegistry: { getPackageByConfigId: any; updatePackage: any };

  const mockSession = {
    user: {
      id: 'test-user-id',
      email: 'test@example.com',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    accessToken: 'test-token',
    refreshToken: 'test-refresh-token',
    expiresAt: new Date(Date.now() + 3600000),
  };

  const mockPackage: PackageMetadata = {
    id: 'pkg-1',
    configId: 'config-1',
    name: 'Test Package',
    title: 'Original Title',
    platform: 'claude-code',
    version: '1.0.0',
    isPublic: true,
    userId: 'test-user-id',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-02'),
    description: 'Original description',
    userTags: ['original', 'tags'],
    sanitizationLevel: 'safe',
    checksum: 'abc123',
    storageUrl: 'https://storage.example.com/pkg-1',
    packageSize: 1024,
    components: [],
    autoTags: [],
  };

  beforeEach(async () => {
    // Reset all mocks
    vi.clearAllMocks();

    mockAuthService = {
      getSession: vi.fn(),
    };
    mockPackageRegistry = {
      getPackageByConfigId: vi.fn(),
      updatePackage: vi.fn(),
    };

    // Directly instantiate the command with mocked services
    command = new UpdateCommand(mockAuthService as any, mockPackageRegistry as any);
    
    // Mock process.exit
    vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    
    // Mock console methods
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    
    // Reset inquirer mock
    vi.mocked(inquirer.prompt).mockReset();
  });

  describe('run', () => {
    it('should update package title when specified', async () => {
      mockAuthService.getSession.mockResolvedValue(mockSession);
      mockPackageRegistry.getPackageByConfigId.mockResolvedValue(mockPackage);
      mockPackageRegistry.updatePackage.mockResolvedValue({
        ...mockPackage,
        title: 'New Title',
      });
      vi.mocked(inquirer.prompt).mockResolvedValue({ confirm: true });

      await command.run(['config-1'], { title: 'New Title' });

      expect(mockPackageRegistry.updatePackage).toHaveBeenCalledWith(
        'config-1',
        { title: 'New Title' }
      );
      expect(console.log).toHaveBeenCalledWith(
        chalk.green('✅ Package updated successfully!')
      );
    });

    it('should update package description when specified', async () => {
      mockAuthService.getSession.mockResolvedValue(mockSession);
      mockPackageRegistry.getPackageByConfigId.mockResolvedValue(mockPackage);
      mockPackageRegistry.updatePackage.mockResolvedValue({
        ...mockPackage,
        description: 'New description',
      });
      vi.mocked(inquirer.prompt).mockResolvedValue({ confirm: true });

      await command.run(['config-1'], { description: 'New description' });

      expect(mockPackageRegistry.updatePackage).toHaveBeenCalledWith(
        'config-1',
        { description: 'New description' }
      );
    });

    it('should update package tags when specified', async () => {
      mockAuthService.getSession.mockResolvedValue(mockSession);
      mockPackageRegistry.getPackageByConfigId.mockResolvedValue(mockPackage);
      mockPackageRegistry.updatePackage.mockResolvedValue({
        ...mockPackage,
        userTags: ['new', 'tags'],
      });
      vi.mocked(inquirer.prompt).mockResolvedValue({ confirm: true });

      await command.run(['config-1'], { tags: 'new, tags' });

      expect(mockPackageRegistry.updatePackage).toHaveBeenCalledWith(
        'config-1',
        { userTags: ['new', 'tags'] }
      );
    });

    it('should prompt for updates when no options provided', async () => {
      mockAuthService.getSession.mockResolvedValue(mockSession);
      mockPackageRegistry.getPackageByConfigId.mockResolvedValue(mockPackage);
      mockPackageRegistry.updatePackage.mockResolvedValue({
        ...mockPackage,
        title: 'Interactive Title',
      });
      
      vi.mocked(inquirer.prompt)
        .mockResolvedValueOnce({
          title: 'Interactive Title',
          description: mockPackage.description,
          tags: mockPackage.userTags?.join(', '),
        })
        .mockResolvedValueOnce({ confirm: true });

      await command.run(['config-1'], {});

      expect(inquirer.prompt).toHaveBeenCalledTimes(2);
      expect(mockPackageRegistry.updatePackage).toHaveBeenCalledWith(
        'config-1',
        { title: 'Interactive Title' }
      );
    });

    it('should skip confirmation when --yes flag is provided', async () => {
      mockAuthService.getSession.mockResolvedValue(mockSession);
      mockPackageRegistry.getPackageByConfigId.mockResolvedValue(mockPackage);
      mockPackageRegistry.updatePackage.mockResolvedValue({
        ...mockPackage,
        title: 'New Title',
      });

      await command.run(['config-1'], { title: 'New Title', yes: true });

      expect(inquirer.prompt).not.toHaveBeenCalled();
      expect(mockPackageRegistry.updatePackage).toHaveBeenCalled();
    });

    it('should cancel update when user declines confirmation', async () => {
      mockAuthService.getSession.mockResolvedValue(mockSession);
      mockPackageRegistry.getPackageByConfigId.mockResolvedValue(mockPackage);
      vi.mocked(inquirer.prompt).mockResolvedValue({ confirm: false });

      await command.run(['config-1'], { title: 'New Title' });

      expect(mockPackageRegistry.updatePackage).not.toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith(
        chalk.gray('Update cancelled')
      );
    });

    it('should show no changes message when nothing to update', async () => {
      mockAuthService.getSession.mockResolvedValue(mockSession);
      mockPackageRegistry.getPackageByConfigId.mockResolvedValue(mockPackage);

      await command.run(['config-1'], { title: mockPackage.title });

      expect(console.log).toHaveBeenCalledWith(
        'No changes to apply'
      );
      expect(mockPackageRegistry.updatePackage).not.toHaveBeenCalled();
    });

    it('should fail when package not found', async () => {
      mockAuthService.getSession.mockResolvedValue(mockSession);
      mockPackageRegistry.getPackageByConfigId.mockResolvedValue(null);

      await command.run(['config-1'], { title: 'New Title' });

      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should fail when user does not own the package', async () => {
      mockAuthService.getSession.mockResolvedValue(mockSession);
      mockPackageRegistry.getPackageByConfigId.mockResolvedValue({
        ...mockPackage,
        userId: 'other-user-id',
      });

      await command.run(['config-1'], { title: 'New Title' });

      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should fail when not authenticated', async () => {
      mockAuthService.getSession.mockResolvedValue(null);

      await command.run(['config-1'], { title: 'New Title' });

      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should fail when no config ID provided', async () => {
      mockAuthService.getSession.mockResolvedValue(mockSession);

      await command.run([], { title: 'New Title' });

      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should handle errors gracefully', async () => {
      mockAuthService.getSession.mockResolvedValue(mockSession);
      mockPackageRegistry.getPackageByConfigId.mockRejectedValue(
        new Error('Network error')
      );

      await command.run(['config-1'], { title: 'New Title' });

      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });

  describe('option parsers', () => {
    it('should parse title option', () => {
      expect(command.parseTitle('New Title')).toBe('New Title');
    });

    it('should parse description option', () => {
      expect(command.parseDescription('New description')).toBe('New description');
    });

    it('should parse tags option', () => {
      expect(command.parseTags('tag1, tag2')).toBe('tag1, tag2');
    });

    it('should parse yes option', () => {
      expect(command.parseYes()).toBe(true);
    });
  });
});
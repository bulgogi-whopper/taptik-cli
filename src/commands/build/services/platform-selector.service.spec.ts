import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';

import { SupportedPlatform } from '../interfaces';

import { PlatformSelectorServiceImpl } from './platform-selector.service';

// Mock inquirer prompts
vi.mock('@inquirer/prompts', () => ({
  select: vi.fn()
}));

// Mock chalk
vi.mock('chalk', () => ({
  default: {
    blue: vi.fn((text: string) => text),
    gray: vi.fn((text: string) => text),
    yellow: vi.fn((text: string) => text),
    green: vi.fn((text: string) => text)
  }
}));

// Mock console methods
const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});

describe('PlatformSelectorService', () => {
  let service: PlatformSelectorServiceImpl;
  let mockSelect: Mock;

  beforeEach(async () => {
    service = new PlatformSelectorServiceImpl();
    const inquirerModule = await import('@inquirer/prompts');
    mockSelect = vi.mocked(inquirerModule).select;
    
    // Clear all mocks
    vi.clearAllMocks();
  });

  describe('selectPlatform', () => {
    it('should display platform selection prompt with correct options', async () => {
      // Arrange
      mockSelect.mockResolvedValue(SupportedPlatform.KIRO);

      // Act
      await service.selectPlatform();

      // Assert
      expect(mockSelect).toHaveBeenCalledWith({
        message: 'Choose your source platform:',
        choices: [
          {
            name: '🎯 Kiro - AI IDE (Supported)',
            value: SupportedPlatform.KIRO,
            description: 'Build from Kiro AI IDE settings'
          },
          {
            name: '🚧 Cursor - AI Code Editor (Coming Soon)',
            value: SupportedPlatform.CURSOR,
            description: 'Support for Cursor will be available in a future release'
          },
          {
            name: '🚧 Claude Code - AI Development Environment (Coming Soon)',
            value: SupportedPlatform.CLAUDE_CODE,
            description: 'Support for Claude Code will be available in a future release'
          }
        ]
      });
    });

    it('should return Kiro platform when selected', async () => {
      // Arrange
      mockSelect.mockResolvedValue(SupportedPlatform.KIRO);

      // Act
      const result = await service.selectPlatform();

      // Assert
      expect(result).toBe(SupportedPlatform.KIRO);
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Selected platform: kiro'));
    });

    it('should display coming soon message and throw error when Cursor is selected', async () => {
      // Arrange
      mockSelect.mockResolvedValue(SupportedPlatform.CURSOR);

      // Act & Assert
      await expect(service.selectPlatform()).rejects.toThrow('Cursor platform is not yet supported');
      
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Coming Soon!'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Cursor support is currently under development'));
    });

    it('should display coming soon message and throw error when Claude Code is selected', async () => {
      // Arrange
      mockSelect.mockResolvedValue(SupportedPlatform.CLAUDE_CODE);

      // Act & Assert
      await expect(service.selectPlatform()).rejects.toThrow('Claude Code platform is not yet supported');
      
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Coming Soon!'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Claude Code support is currently under development'));
    });

    it('should display proper introduction messages', async () => {
      // Arrange
      mockSelect.mockResolvedValue(SupportedPlatform.KIRO);

      // Act
      await service.selectPlatform();

      // Assert
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Platform Selection'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Select the AI IDE platform you want to build from'));
    });

    it('should handle inquirer prompt errors gracefully', async () => {
      // Arrange
      const error = new Error('Prompt cancelled');
      mockSelect.mockRejectedValue(error);

      // Act & Assert
      await expect(service.selectPlatform()).rejects.toThrow('Prompt cancelled');
    });
  });

  describe('platform choice validation', () => {
    it('should have all supported platforms in choices', async () => {
      // Arrange
      mockSelect.mockResolvedValue(SupportedPlatform.KIRO);

      // Act
      await service.selectPlatform();

      // Assert
      const callArguments = mockSelect.mock.calls[0][0];
      const platformValues = callArguments.choices.map((choice: any) => choice.value);
      
      expect(platformValues).toContain(SupportedPlatform.KIRO);
      expect(platformValues).toContain(SupportedPlatform.CURSOR);
      expect(platformValues).toContain(SupportedPlatform.CLAUDE_CODE);
    });

    it('should mark only Kiro as supported in choice names', async () => {
      // Arrange
      mockSelect.mockResolvedValue(SupportedPlatform.KIRO);

      // Act
      await service.selectPlatform();

      // Assert
      const callArguments = mockSelect.mock.calls[0][0];
      const {choices} = callArguments;
      
      const kiroChoice = choices.find((choice: any) => choice.value === SupportedPlatform.KIRO);
      const cursorChoice = choices.find((choice: any) => choice.value === SupportedPlatform.CURSOR);
      const claudeChoice = choices.find((choice: any) => choice.value === SupportedPlatform.CLAUDE_CODE);
      
      expect(kiroChoice.name).toContain('Supported');
      expect(cursorChoice.name).toContain('Coming Soon');
      expect(claudeChoice.name).toContain('Coming Soon');
    });
  });

  describe('error scenarios', () => {
    it('should propagate unexpected errors from inquirer', async () => {
      // Arrange
      const unexpectedError = new Error('Network error');
      mockSelect.mockRejectedValue(unexpectedError);

      // Act & Assert
      await expect(service.selectPlatform()).rejects.toThrow('Network error');
    });

    it('should throw error for Cursor platform', async () => {
      // Arrange
      mockSelect.mockResolvedValue(SupportedPlatform.CURSOR);

      // Act & Assert
      await expect(service.selectPlatform()).rejects.toThrow('Cursor platform is not yet supported');
    });

    it('should throw error for Claude Code platform', async () => {
      // Arrange
      mockSelect.mockResolvedValue(SupportedPlatform.CLAUDE_CODE);

      // Act & Assert
      await expect(service.selectPlatform()).rejects.toThrow('Claude Code platform is not yet supported');
    });
  });
});
import { Test, TestingModule } from '@nestjs/testing';

import { describe, it, expect, beforeEach, vi } from 'vitest';

import { HealthCommand } from './health.command';

describe('HealthCommand', () => {
  let command: HealthCommand;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [HealthCommand],
    }).compile();

    command = module.get<HealthCommand>(HealthCommand);
  });

  describe('run', () => {
    it('should display health status in text format', async () => {
      // Arrange
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      // Act
      await command.run([], { format: 'text' });

      // Assert
      expect(consoleSpy).toHaveBeenCalledWith('🟢 Application is healthy');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringMatching(/Uptime: \d+s/),
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringMatching(/Memory: \d+MB/),
      );

      // Cleanup
      consoleSpy.mockRestore();
    });

    it('should display health status in JSON format', async () => {
      // Arrange
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      // Act
      await command.run([], { format: 'json' });

      // Assert
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('"status": "ok"'),
      );

      // Cleanup
      consoleSpy.mockRestore();
    });

    it('should be defined', () => {
      expect(command).toBeDefined();
    });
  });
});

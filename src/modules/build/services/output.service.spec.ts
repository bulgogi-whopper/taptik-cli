import { Test, TestingModule } from '@nestjs/testing';
import { OutputService } from './output.service';

describe('OutputService', () => {
  let service: OutputService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [OutputService],
    }).compile();

    service = module.get<OutputService>(OutputService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should generate timestamp in correct format', () => {
    const timestamp = service['generateTimestamp']();
    expect(timestamp).toMatch(/^\d{8}-\d{6}$/);
    
    // Verify timestamp components
    const parts = timestamp.split('-');
    expect(parts).toHaveLength(2);
    expect(parts[0]).toHaveLength(8); // YYYYMMDD
    expect(parts[1]).toHaveLength(6); // HHMMSS
  });

  it('should check directory existence', async () => {
    const exists = await service['directoryExists']('/nonexistent/path');
    expect(exists).toBe(false);
  });

  describe('createOutputDirectory', () => {
    it('should generate valid directory name format', async () => {
      // Mock the directory existence check to avoid actual file system operations
      const originalDirectoryExists = service['directoryExists'];
      service['directoryExists'] = vi.fn().mockResolvedValue(false);

      // Mock fs.mkdir to avoid actual directory creation
      const mockMkdir = vi.fn().mockResolvedValue(undefined);
      const fs = await import('node:fs');
      vi.spyOn(fs.promises, 'mkdir').mockImplementation(mockMkdir);

      const outputPath = await service.createOutputDirectory();
      
      expect(outputPath).toMatch(/taptik-build-\d{8}-\d{6}$/);
      expect(mockMkdir).toHaveBeenCalledWith(
        expect.stringMatching(/taptik-build-\d{8}-\d{6}$/),
        { recursive: true }
      );

      // Restore original method
      service['directoryExists'] = originalDirectoryExists;
    });

    it('should handle directory conflicts with incremental numbering', async () => {
      // Mock directory existence to return true for first call, false for second
      let callCount = 0;
      service['directoryExists'] = vi.fn().mockImplementation(() => {
        callCount++;
        return callCount === 1; // First call returns true (conflict), second returns false
      });

      // Mock fs.mkdir
      const mockMkdir = vi.fn().mockResolvedValue(undefined);
      const fs = await import('node:fs');
      vi.spyOn(fs.promises, 'mkdir').mockImplementation(mockMkdir);

      const outputPath = await service.createOutputDirectory();
      
      expect(outputPath).toMatch(/taptik-build-\d{8}-\d{6}-1$/);
      expect(mockMkdir).toHaveBeenCalledWith(
        expect.stringMatching(/taptik-build-\d{8}-\d{6}-1$/),
        { recursive: true }
      );
    });

    it('should throw error after too many conflict resolution attempts', async () => {
      // Mock directory existence to always return true (always conflict)
      service['directoryExists'] = vi.fn().mockResolvedValue(true);

      await expect(service.createOutputDirectory()).rejects.toThrow(
        'Unable to create unique directory after 1000 attempts'
      );
    });

    it('should handle file system errors', async () => {
      // Mock directory existence check to return false
      service['directoryExists'] = vi.fn().mockResolvedValue(false);

      // Mock fs.mkdir to throw an error
      const mockMkdir = vi.fn().mockRejectedValue(new Error('Permission denied'));
      const fs = await import('node:fs');
      vi.spyOn(fs.promises, 'mkdir').mockImplementation(mockMkdir);

      await expect(service.createOutputDirectory()).rejects.toThrow(
        'Output directory creation failed: Permission denied'
      );
    });
  });
});
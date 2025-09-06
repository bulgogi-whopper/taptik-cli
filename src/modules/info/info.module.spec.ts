import { Test, TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { InfoModule } from './info.module';
import { InfoService } from './services/info.service';
import { ListService } from './services/list.service';
import { InfoCommand } from './commands/info.command';
import { ListCommand } from './commands/list.command';

// Mock the dependencies that InfoModule imports
vi.mock('../auth/auth.module', () => ({
  AuthModule: class MockAuthModule {},
}));

vi.mock('../supabase/supabase.module', () => ({
  SupabaseModule: class MockSupabaseModule {},
}));

vi.mock('../auth/auth.service', () => ({
  AuthService: class MockAuthService {},
}));

vi.mock('../supabase/supabase.service', () => ({
  SupabaseService: class MockSupabaseService {
    getClient() {
      return {};
    }
  },
}));

describe('InfoModule', () => {
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [InfoModule],
    }).compile();
  });

  it('should be defined', () => {
    expect(module).toBeDefined();
  });

  it('should provide InfoService', () => {
    const infoService = module.get<InfoService>(InfoService);
    expect(infoService).toBeDefined();
  });

  it('should provide ListService', () => {
    const listService = module.get<ListService>(ListService);
    expect(listService).toBeDefined();
  });

  it('should provide InfoCommand', () => {
    const infoCommand = module.get<InfoCommand>(InfoCommand);
    expect(infoCommand).toBeDefined();
  });

  it('should provide ListCommand', () => {
    const listCommand = module.get<ListCommand>(ListCommand);
    expect(listCommand).toBeDefined();
  });

  it('should export InfoService', () => {
    const exports = Reflect.getMetadata('exports', InfoModule) || [];
    expect(exports).toContain(InfoService);
  });

  it('should export ListService', () => {
    const exports = Reflect.getMetadata('exports', InfoModule) || [];
    expect(exports).toContain(ListService);
  });
});
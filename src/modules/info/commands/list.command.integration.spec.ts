import { Test } from '@nestjs/testing';

import { describe, it, expect, beforeEach, vi } from 'vitest';

import { AppModule } from '../../../app.module';
import { ListService } from '../services/list.service';

describe('ListCommand Integration', () => {
  let app: any;
  let listService: ListService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(ListService)
      .useValue({
        listConfigurations: vi.fn().mockResolvedValue({
          configurations: [],
          totalCount: 0,
          hasMore: false,
        }),
        listLikedConfigurations: vi.fn().mockResolvedValue({
          configurations: [],
          totalCount: 0,
          hasMore: false,
        }),
      })
      .compile();

    app = moduleRef.createNestApplication();
    listService = moduleRef.get<ListService>(ListService);

    // Mock console to avoid output during tests
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('should be defined and discoverable', () => {
    expect(app).toBeDefined();
    expect(listService).toBeDefined();
  });

  it('should have ListService available', () => {
    expect(listService.listConfigurations).toBeDefined();
    expect(listService.listLikedConfigurations).toBeDefined();
  });
});

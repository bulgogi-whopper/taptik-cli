import { Test, TestingModule } from '@nestjs/testing';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { InteractiveService } from './interactive.service';
import { BuildPlatform, BuildCategoryName } from '../interfaces/build-config.interface';

// Mock the @inquirer/prompts module
vi.mock('@inquirer/prompts', () => ({
  select: vi.fn(),
  checkbox: vi.fn(),
}));

describe('InteractiveService', () => {
  let service: InteractiveService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [InteractiveService],
    }).compile();

    service = module.get<InteractiveService>(InteractiveService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('selectPlatform', () => {
    it('should return BuildPlatform.KIRO when user selects kiro platform', async () => {
      const { select } = await import('@inquirer/prompts');
      (select as any).mockResolvedValue(BuildPlatform.KIRO);

      const result = await service.selectPlatform();

      expect(result).toBe(BuildPlatform.KIRO);
      expect(select).toHaveBeenCalledWith({
        message: '🚀 Select a platform for your Taptik build:',
        choices: expect.arrayContaining([
          expect.objectContaining({ value: BuildPlatform.KIRO, name: 'Kiro (Ready)' })
        ]),
        default: BuildPlatform.KIRO
      });
    });

    it('should return BuildPlatform.CURSOR when user selects cursor platform', async () => {
      const { select } = await import('@inquirer/prompts');
      (select as any).mockResolvedValue(BuildPlatform.CURSOR);

      const result = await service.selectPlatform();

      expect(result).toBe(BuildPlatform.CURSOR);
    });

    it('should return BuildPlatform.CLAUDE_CODE when user selects claude-code platform', async () => {
      const { select } = await import('@inquirer/prompts');
      (select as any).mockResolvedValue(BuildPlatform.CLAUDE_CODE);

      const result = await service.selectPlatform();

      expect(result).toBe(BuildPlatform.CLAUDE_CODE);
    });

    it('should have disabled options for cursor and claude-code', async () => {
      const { select } = await import('@inquirer/prompts');
      (select as any).mockResolvedValue(BuildPlatform.KIRO);

      await service.selectPlatform();

      const selectCall = (select as any).mock.calls[0][0];
      const choices = selectCall.choices;
      
      const cursorChoice = choices.find((c: any) => c.value === BuildPlatform.CURSOR);
      const claudeCodeChoice = choices.find((c: any) => c.value === BuildPlatform.CLAUDE_CODE);
      
      expect(cursorChoice.disabled).toBe('(Coming soon)');
      expect(claudeCodeChoice.disabled).toBe('(Coming soon)');
    });
  });

  describe('selectCategories', () => {
    it('should return selected categories when user makes valid selection', async () => {
      const { checkbox } = await import('@inquirer/prompts');
      (checkbox as any).mockResolvedValue([BuildCategoryName.PERSONAL_CONTEXT, BuildCategoryName.PROJECT_CONTEXT]);
      
      const result = await service.selectCategories();

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe(BuildCategoryName.PERSONAL_CONTEXT);
      expect(result[0].enabled).toBe(true);
      expect(result[1].name).toBe(BuildCategoryName.PROJECT_CONTEXT);
      expect(result[1].enabled).toBe(true);
    });

    it('should call checkbox with correct configuration including multi-select instructions', async () => {
      const { checkbox } = await import('@inquirer/prompts');
      (checkbox as any).mockResolvedValue([BuildCategoryName.PERSONAL_CONTEXT]);

      await service.selectCategories();

      expect(checkbox).toHaveBeenCalledWith({
        message: '📁 Select categories to include in your build:',
        instructions: 'Use spacebar to select, arrow keys to navigate, \'a\' to toggle all, enter to confirm',
        choices: expect.arrayContaining([
          expect.objectContaining({ 
            value: BuildCategoryName.PERSONAL_CONTEXT,
            name: 'Personal Context'
          }),
          expect.objectContaining({ 
            value: BuildCategoryName.PROJECT_CONTEXT,
            name: 'Project Context'
          }),
          expect.objectContaining({ 
            value: BuildCategoryName.PROMPT_TEMPLATES,
            name: 'Prompt Templates'
          })
        ]),
        required: true,
        validate: expect.any(Function)
      });
    });

    it('should validate that at least one category is selected', async () => {
      const { checkbox } = await import('@inquirer/prompts');
      (checkbox as any).mockResolvedValue([BuildCategoryName.PERSONAL_CONTEXT]);

      await service.selectCategories();

      const checkboxCall = (checkbox as any).mock.calls[0][0];
      const validateFn = checkboxCall.validate;
      
      expect(validateFn([])).toBe('At least one category must be selected.');
      expect(validateFn([BuildCategoryName.PERSONAL_CONTEXT])).toBe(true);
    });

    it('should handle selection of all categories', async () => {
      const { checkbox } = await import('@inquirer/prompts');
      const allCategories = [
        BuildCategoryName.PERSONAL_CONTEXT,
        BuildCategoryName.PROJECT_CONTEXT,
        BuildCategoryName.PROMPT_TEMPLATES
      ];
      (checkbox as any).mockResolvedValue(allCategories);
      
      const result = await service.selectCategories();

      expect(result).toHaveLength(3);
      expect(result.map(cat => cat.name)).toEqual(allCategories);
      expect(result.every(cat => cat.enabled)).toBe(true);
    });

    it('should handle single category selection', async () => {
      const { checkbox } = await import('@inquirer/prompts');
      (checkbox as any).mockResolvedValue([BuildCategoryName.PROMPT_TEMPLATES]);
      
      const result = await service.selectCategories();

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe(BuildCategoryName.PROMPT_TEMPLATES);
      expect(result[0].enabled).toBe(true);
    });

    it('should include descriptions for each category choice', async () => {
      const { checkbox } = await import('@inquirer/prompts');
      (checkbox as any).mockResolvedValue([BuildCategoryName.PERSONAL_CONTEXT]);

      await service.selectCategories();

      const checkboxCall = (checkbox as any).mock.calls[0][0];
      const choices = checkboxCall.choices;
      
      expect(choices).toEqual(expect.arrayContaining([
        expect.objectContaining({
          name: 'Personal Context',
          value: BuildCategoryName.PERSONAL_CONTEXT,
          description: 'User preferences, work style, and communication settings'
        }),
        expect.objectContaining({
          name: 'Project Context',
          value: BuildCategoryName.PROJECT_CONTEXT,
          description: 'Project information, technical stack, and development guidelines'
        }),
        expect.objectContaining({
          name: 'Prompt Templates',
          value: BuildCategoryName.PROMPT_TEMPLATES,
          description: 'Reusable prompt templates for AI interactions'
        })
      ]));
    });
  });
});
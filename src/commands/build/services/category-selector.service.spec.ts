import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';

import { BuildCategory } from '../interfaces';

import { CategorySelectorServiceImpl } from './category-selector.service';

// Mock inquirer prompts
vi.mock('@inquirer/prompts', () => ({
  checkbox: vi.fn()
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

describe('CategorySelectorService', () => {
  let service: CategorySelectorServiceImpl;
  let mockCheckbox: Mock;

  beforeEach(async () => {
    service = new CategorySelectorServiceImpl();
    const inquirerModule = await import('@inquirer/prompts');
    mockCheckbox = vi.mocked(inquirerModule).checkbox;
    
    // Clear all mocks
    vi.clearAllMocks();
  });

  describe('selectCategories', () => {
    it('should display category selection prompt with correct options', async () => {
      // Arrange
      mockCheckbox.mockResolvedValue([BuildCategory.PERSONAL_CONTEXT]);

      // Act
      await service.selectCategories();

      // Assert
      expect(mockCheckbox).toHaveBeenCalledWith({
        message: 'Choose categories to include:',
        choices: [
          {
            name: '👤 Personal Context - User preferences and profile settings',
            value: BuildCategory.PERSONAL_CONTEXT,
            checked: false
          },
          {
            name: '🏗️ Project Context - Project-specific settings and configurations',
            value: BuildCategory.PROJECT_CONTEXT,
            checked: false
          },
          {
            name: '💬 Prompt Templates - AI prompt templates and snippets',
            value: BuildCategory.PROMPT_TEMPLATES,
            checked: false
          }
        ],
        validate: expect.any(Function)
      });
    });

    it('should return selected categories when valid selection is made', async () => {
      // Arrange
      const selectedCategories = [BuildCategory.PERSONAL_CONTEXT, BuildCategory.PROJECT_CONTEXT];
      mockCheckbox.mockResolvedValue(selectedCategories);

      // Act
      const result = await service.selectCategories();

      // Assert
      expect(result).toEqual(selectedCategories);
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Selected categories: personal, project'));
    });

    it('should return single category when only one is selected', async () => {
      // Arrange
      const selectedCategories = [BuildCategory.PROMPT_TEMPLATES];
      mockCheckbox.mockResolvedValue(selectedCategories);

      // Act
      const result = await service.selectCategories();

      // Assert
      expect(result).toEqual(selectedCategories);
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Selected categories: prompts'));
    });

    it('should return all categories when all are selected', async () => {
      // Arrange
      const allCategories = [
        BuildCategory.PERSONAL_CONTEXT,
        BuildCategory.PROJECT_CONTEXT,
        BuildCategory.PROMPT_TEMPLATES
      ];
      mockCheckbox.mockResolvedValue(allCategories);

      // Act
      const result = await service.selectCategories();

      // Assert
      expect(result).toEqual(allCategories);
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Selected categories: personal, project, prompts'));
    });

    it('should display proper introduction messages', async () => {
      // Arrange
      mockCheckbox.mockResolvedValue([BuildCategory.PERSONAL_CONTEXT]);

      // Act
      await service.selectCategories();

      // Assert
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Category Selection'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Select the configuration categories you want to include'));
    });

    it('should handle empty selection with helpful error message', async () => {
      // Arrange
      mockCheckbox.mockResolvedValue([]);

      // Act & Assert
      await expect(service.selectCategories()).rejects.toThrow('No categories selected. At least one category is required to proceed.');
      
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('No Categories Selected'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('You must select at least one category'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Available categories:'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Personal Context'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Project Context'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Prompt Templates'));
    });

    it('should handle inquirer prompt errors gracefully', async () => {
      // Arrange
      const error = new Error('Prompt cancelled');
      mockCheckbox.mockRejectedValue(error);

      // Act & Assert
      await expect(service.selectCategories()).rejects.toThrow('Prompt cancelled');
    });
  });

  describe('validation function', () => {
    it('should validate that at least one category is selected', async () => {
      // Arrange
      mockCheckbox.mockResolvedValue([BuildCategory.PERSONAL_CONTEXT]);

      // Act
      await service.selectCategories();

      // Assert
      const callArguments = mockCheckbox.mock.calls[0][0];
      const validateFunction = callArguments.validate;
      
      // Test validation with empty array
      expect(validateFunction([])).toBe('Please select at least one category to continue.');
      
      // Test validation with valid selection
      expect(validateFunction([{ value: BuildCategory.PERSONAL_CONTEXT }])).toBe(true);
      expect(validateFunction([{ value: BuildCategory.PERSONAL_CONTEXT }, { value: BuildCategory.PROJECT_CONTEXT }])).toBe(true);
    });
  });

  describe('category choices validation', () => {
    it('should have all build categories in choices', async () => {
      // Arrange
      mockCheckbox.mockResolvedValue([BuildCategory.PERSONAL_CONTEXT]);

      // Act
      await service.selectCategories();

      // Assert
      const callArguments = mockCheckbox.mock.calls[0][0];
      const categoryValues = callArguments.choices.map((choice: any) => choice.value);
      
      expect(categoryValues).toContain(BuildCategory.PERSONAL_CONTEXT);
      expect(categoryValues).toContain(BuildCategory.PROJECT_CONTEXT);
      expect(categoryValues).toContain(BuildCategory.PROMPT_TEMPLATES);
    });

    it('should have descriptive names for all categories', async () => {
      // Arrange
      mockCheckbox.mockResolvedValue([BuildCategory.PERSONAL_CONTEXT]);

      // Act
      await service.selectCategories();

      // Assert
      const callArguments = mockCheckbox.mock.calls[0][0];
      const {choices} = callArguments;
      
      const personalChoice = choices.find((choice: any) => choice.value === BuildCategory.PERSONAL_CONTEXT);
      const projectChoice = choices.find((choice: any) => choice.value === BuildCategory.PROJECT_CONTEXT);
      const promptChoice = choices.find((choice: any) => choice.value === BuildCategory.PROMPT_TEMPLATES);
      
      expect(personalChoice.name).toContain('Personal Context');
      expect(personalChoice.name).toContain('User preferences');
      
      expect(projectChoice.name).toContain('Project Context');
      expect(projectChoice.name).toContain('Project-specific settings');
      
      expect(promptChoice.name).toContain('Prompt Templates');
      expect(promptChoice.name).toContain('AI prompt templates');
    });

    it('should have all choices unchecked by default', async () => {
      // Arrange
      mockCheckbox.mockResolvedValue([BuildCategory.PERSONAL_CONTEXT]);

      // Act
      await service.selectCategories();

      // Assert
      const callArguments = mockCheckbox.mock.calls[0][0];
      const {choices} = callArguments;
      
      choices.forEach((choice: any) => {
        expect(choice.checked).toBe(false);
      });
    });
  });

  describe('error scenarios', () => {
    it('should propagate unexpected errors from inquirer', async () => {
      // Arrange
      const unexpectedError = new Error('Network error');
      mockCheckbox.mockRejectedValue(unexpectedError);

      // Act & Assert
      await expect(service.selectCategories()).rejects.toThrow('Network error');
    });

    it('should throw specific error for empty category selection', async () => {
      // Arrange
      mockCheckbox.mockResolvedValue([]);

      // Act & Assert
      await expect(service.selectCategories()).rejects.toThrow('No categories selected. At least one category is required to proceed.');
    });
  });

  describe('user experience', () => {
    it('should display helpful guidance when no categories are selected', async () => {
      // Arrange
      mockCheckbox.mockResolvedValue([]);

      // Act & Assert
      await expect(service.selectCategories()).rejects.toThrow();
      
      // Verify helpful messages are displayed
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('No Categories Selected'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Please run the command again'));
    });

    it('should show success message with selected categories', async () => {
      // Arrange
      const categories = [BuildCategory.PERSONAL_CONTEXT, BuildCategory.PROMPT_TEMPLATES];
      mockCheckbox.mockResolvedValue(categories);

      // Act
      await service.selectCategories();

      // Assert
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('✅ Selected categories'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('personal, prompts'));
    });
  });
});
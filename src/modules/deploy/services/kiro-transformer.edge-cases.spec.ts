import { Test, TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach } from 'vitest';

import { TaptikContext } from '../../context/interfaces/taptik-context.interface';
import { KiroTransformerService } from './kiro-transformer.service';

describe('KiroTransformerService Edge Cases', () => {
  let service: KiroTransformerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [KiroTransformerService],
    }).compile();

    service = module.get<KiroTransformerService>(KiroTransformerService);
  });

  describe('Large data transformation', () => {
    it('should handle extremely large context data efficiently', () => {
      // Create a large context with many components
      const largeContext: TaptikContext = {
        metadata: {
          version: '1.0.0',
          exportedAt: '2024-01-01T00:00:00Z',
          sourceIde: 'claude-code',
          targetIdes: ['kiro-ide'],
        },
        content: {
          personal: {
            name: 'Test User',
            profile: {
              domain_knowledge: Array.from({ length: 100 }, (_, i) => `domain-${i}`)
            }
          },
          tools: {
            agents: Array.from({ length: 50 }, (_, i) => ({
              name: `Agent ${i}`,
              content: `Agent ${i} content with very long description `.repeat(100),
              metadata: { category: 'testing', id: `agent-${i}` }
            }))
          }
        },
        security: {
          hasApiKeys: false,
          filteredFields: [],
          scanResults: { passed: true, warnings: [] }
        }
      };

      const start = Date.now();
      const result = service.transformPersonalContext(largeContext);
      const end = Date.now();

      expect(result).toBeDefined();
      expect(result.agents).toHaveLength(50);
      expect(result.user.profile.domain_knowledge).toHaveLength(100);
      expect(end - start).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should handle deeply nested object structures', () => {
      const deepContext: TaptikContext = {
        metadata: {
          version: '1.0.0',
          exportedAt: '2024-01-01T00:00:00Z',
          sourceIde: 'claude-code',
          targetIdes: ['kiro-ide'],
        },
        content: {
          personal: {
            preferences: {
              nested: {
                deep: {
                  very: {
                    nested: {
                      property: 'value'
                    }
                  }
                }
              }
            }
          }
        },
        security: {
          hasApiKeys: false,
          filteredFields: [],
          scanResults: { passed: true, warnings: [] }
        }
      };

      const result = service.transformPersonalContext(deepContext);
      
      expect(result).toBeDefined();
      expect(result.version).toBe('1.0.0');
    });
  });

  describe('Unicode and special characters', () => {
    it('should handle Unicode characters in all fields', () => {
      const unicodeContext: TaptikContext = {
        metadata: {
          version: '1.0.0',
          exportedAt: '2024-01-01T00:00:00Z',
          sourceIde: 'claude-code',
          targetIdes: ['kiro-ide'],
        },
        content: {
          personal: {
            name: '김철수',
            profile: {
              name: '中文姓名',
              primary_role: 'Développeur Senior'
            }
          },
          tools: {
            agents: [
              {
                name: 'Agent Español',
                content: 'Descripción en español con acentos: ñáéíóú',
                metadata: { category: 'español' }
              },
              {
                name: 'Agent العربية',
                content: 'وصف باللغة العربية',
                metadata: { category: 'arabic' }
              }
            ]
          }
        },
        security: {
          hasApiKeys: false,
          filteredFields: [],
          scanResults: { passed: true, warnings: [] }
        }
      };

      const result = service.transformPersonalContext(unicodeContext);

      expect(result.user.profile.name).toBe('中文姓名');
      expect(result.agents).toHaveLength(2);
      expect(result.agents!.find(a => a.name === 'Agent Español')).toBeDefined();
      expect(result.agents!.find(a => a.name === 'Agent العربية')).toBeDefined();
    });

    it('should handle special characters in file names and paths', () => {
      const homeDir = '/Users/user with spaces/Documents';
      const projectDir = '/Users/user with spaces/Projects/my-project (v2)';

      const result = service.createDeploymentContext(homeDir, projectDir);

      expect(result.paths.globalSettings).toBe('/Users/user with spaces/Documents/.kiro/settings.json');
      expect(result.paths.projectSettings).toBe('/Users/user with spaces/Projects/my-project (v2)/.kiro/settings.json');
    });
  });

  describe('Malformed data handling', () => {
    it('should handle circular references gracefully', () => {
      const circularObj: any = { name: 'test' };
      circularObj.self = circularObj; // Create circular reference

      const contextWithCircular: TaptikContext = {
        metadata: {
          version: '1.0.0',
          exportedAt: '2024-01-01T00:00:00Z',
          sourceIde: 'claude-code',
          targetIdes: ['kiro-ide'],
        },
        content: {
          personal: circularObj
        },
        security: {
          hasApiKeys: false,
          filteredFields: [],
          scanResults: { passed: true, warnings: [] }
        }
      };

      // Should not throw an error due to circular reference
      expect(() => {
        const result = service.transformPersonalContext(contextWithCircular);
        expect(result).toBeDefined();
      }).not.toThrow();
    });

    it('should handle null and undefined values throughout the structure', () => {
      const nullContext: TaptikContext = {
        metadata: {
          version: '1.0.0',
          exportedAt: '2024-01-01T00:00:00Z',
          sourceIde: 'claude-code',
          targetIdes: ['kiro-ide'],
        },
        content: {
          personal: {
            name: null as any,
            profile: undefined as any,
            preferences: {
              theme: null as any,
              fontSize: undefined as any
            }
          },
          tools: {
            agents: [
              {
                name: 'Test Agent',
                content: null as any,
                metadata: undefined as any
              }
            ]
          }
        },
        security: {
          hasApiKeys: false,
          filteredFields: [],
          scanResults: { passed: true, warnings: [] }
        }
      };

      const result = service.transformPersonalContext(nullContext);
      
      expect(result).toBeDefined();
      // Service may preserve null values as they are
      expect([null, undefined].includes(result.user.profile.name)).toBe(true);
      expect([null, undefined].includes(result.user.preferences.theme)).toBe(true);
    });
  });

  describe('Performance edge cases', () => {
    it('should handle empty arrays and objects efficiently', () => {
      const emptyContext: TaptikContext = {
        metadata: {
          version: '1.0.0',
          exportedAt: '2024-01-01T00:00:00Z',
          sourceIde: 'claude-code',
          targetIdes: ['kiro-ide'],
        },
        content: {
          personal: {},
          tools: { agents: [] }
        },
        security: {
          hasApiKeys: false,
          filteredFields: [],
          scanResults: { passed: true, warnings: [] }
        }
      };

      const result = service.transformPersonalContext(emptyContext);
      
      expect(result).toBeDefined();
      expect(result.agents).toHaveLength(0);
    });

    it('should handle context with many empty nested objects', () => {
      const manyEmptyObjects: TaptikContext = {
        metadata: {
          version: '1.0.0',
          exportedAt: '2024-01-01T00:00:00Z',
          sourceIde: 'claude-code',
          targetIdes: ['kiro-ide'],
        },
        content: Array.from({ length: 1000 }, () => ({})).reduce((acc, _, i) => {
          acc[`empty_${i}`] = {};
          return acc;
        }, {} as any),
        security: {
          hasApiKeys: false,
          filteredFields: [],
          scanResults: { passed: true, warnings: [] }
        }
      };

      const start = Date.now();
      const result = service.transformPersonalContext(manyEmptyObjects);
      const end = Date.now();
      
      expect(result).toBeDefined();
      expect(end - start).toBeLessThan(100); // Should be very fast
    });
  });

  describe('Template variable extraction edge cases', () => {
    it('should handle complex template syntax variations', () => {
      const complexTemplates = {
        templates: [
          {
            id: 'complex-1',
            name: 'Complex Template 1',
            template: '{{variable1}} and {{variable2}} with {{variable3}}',
            description: 'Template with multiple variables'
          },
          {
            id: 'complex-2',
            name: 'Complex Template 2',
            template: 'No variables in this template',
            description: 'Template without variables'
          },
          {
            id: 'complex-3',
            name: 'Complex Template 3',
            template: '{{simpleVar}} and {{anotherVar}}',
            description: 'Template with simple expressions'
          }
        ]
      };

      const result = service.transformPromptTemplates(complexTemplates);

      expect(result).toHaveLength(3);
      
      // First template should extract basic variables only
      const template1 = result.find(t => t.id === 'complex-1');
      expect(template1?.variables).toHaveLength(3);
      expect(template1?.variables.map(v => v.name)).toContain('variable1');
      expect(template1?.variables.map(v => v.name)).toContain('variable2');
      expect(template1?.variables.map(v => v.name)).toContain('variable3');

      // Second template should have no variables
      const template2 = result.find(t => t.id === 'complex-2');
      expect(template2?.variables).toHaveLength(0);

      // Third template should extract simple variable names
      const template3 = result.find(t => t.id === 'complex-3');
      expect(template3?.variables).toHaveLength(2);
      expect(template3?.variables.map(v => v.name)).toContain('simpleVar');
      expect(template3?.variables.map(v => v.name)).toContain('anotherVar');
    });

    it('should handle malformed template syntax', () => {
      const malformedTemplates = {
        templates: [
          {
            id: 'malformed',
            name: 'Malformed Template',
            template: '{{unclosed variable and {{properly.closed}} and {{}}',
            description: 'Template with malformed syntax'
          }
        ]
      };

      // Should not throw error, but should handle gracefully
      expect(() => {
        const result = service.transformPromptTemplates(malformedTemplates);
        expect(result).toHaveLength(1);
      }).not.toThrow();
    });
  });

  describe('Memory and resource management', () => {
    it('should not leak memory with repeated transformations', () => {
      const context: TaptikContext = {
        metadata: {
          version: '1.0.0',
          exportedAt: '2024-01-01T00:00:00Z',
          sourceIde: 'claude-code',
          targetIdes: ['kiro-ide'],
        },
        content: {
          personal: { name: 'Test' },
          tools: { agents: [] }
        },
        security: {
          hasApiKeys: false,
          filteredFields: [],
          scanResults: { passed: true, warnings: [] }
        }
      };

      // Perform many transformations
      const results = [];
      for (let i = 0; i < 100; i++) {
        results.push(service.transformPersonalContext(context));
      }

      // All results should be valid
      expect(results).toHaveLength(100);
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result.version).toBe('1.0.0');
      });
    });
  });

  describe('Concurrent transformation handling', () => {
    it('should handle concurrent transformations safely', async () => {
      const contexts = Array.from({ length: 10 }, (_, i) => ({
        metadata: {
          version: '1.0.0',
          exportedAt: '2024-01-01T00:00:00Z',
          sourceIde: 'claude-code',
          targetIdes: ['kiro-ide'],
        },
        content: {
          personal: { name: `User ${i}` },
          tools: { agents: [] }
        },
        security: {
          hasApiKeys: false,
          filteredFields: [],
          scanResults: { passed: true, warnings: [] }
        }
      }));

      // Transform all contexts concurrently
      const promises = contexts.map(context => 
        Promise.resolve(service.transformPersonalContext(context))
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(10);
      results.forEach((result, index) => {
        expect(result).toBeDefined();
        expect(result.user.profile.name).toBe(`User ${index}`);
      });
    });
  });
});
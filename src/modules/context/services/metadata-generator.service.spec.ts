import { Test, TestingModule } from '@nestjs/testing';

import { 
  CloudMetadata, 
  TaptikContext,
  ClaudeCodeSettings,
  ClaudeAgent,
  ClaudeCommand,
  McpServerConfig
} from '../interfaces/cloud.interface';

import { MetadataGeneratorService } from './metadata-generator.service';

describe('MetadataGeneratorService', () => {
  let service: MetadataGeneratorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MetadataGeneratorService],
    }).compile();

    service = module.get<MetadataGeneratorService>(MetadataGeneratorService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateCloudMetadata()', () => {
    describe('with various input scenarios', () => {
      it('should generate metadata for minimal configuration', async () => {
        const minimalContext: TaptikContext = {
          version: '1.0.0',
          sourceIde: 'claude-code',
          targetIdes: ['claude-code'],
          data: {
            claudeCode: {
              local: {
                settings: {}
              }
            }
          },
          metadata: {
            timestamp: new Date().toISOString(),
            exportedBy: 'test-user'
          }
        };

        const result = await service.generateCloudMetadata(minimalContext);

        expect(result).toBeDefined();
        expect(result.title).toBe('Claude Code Configuration');
        expect(result.sourceIde).toBe('claude-code');
        expect(result.targetIdes).toEqual(['claude-code']);
        expect(result.tags).toContain('claude-code');
        expect(result.componentCount).toEqual({
          agents: 0,
          commands: 0,
          mcpServers: 0,
          steeringRules: 0,
          instructions: 0
        });
        expect(result.complexityLevel).toBe('minimal');
      });

      it('should generate metadata for full configuration with all components', async () => {
        const fullContext: TaptikContext = {
          version: '1.0.0',
          sourceIde: 'claude-code',
          targetIdes: ['claude-code', 'kiro-ide'],
          data: {
            claudeCode: {
              local: {
                settings: {
                  theme: 'dark',
                  features: {
                    autocomplete: true,
                    gitIntegration: true
                  }
                },
                agents: [
                  { id: 'agent1', name: 'Code Assistant', prompt: 'Help with coding' },
                  { id: 'agent2', name: 'Test Writer', prompt: 'Write unit tests' }
                ],
                commands: [
                  { name: 'format', command: 'npm run format' },
                  { name: 'test', command: 'npm test' },
                  { name: 'build', command: 'npm run build' }
                ],
                mcpServers: {
                  servers: [
                    { name: 'file-server', protocol: 'stdio', command: 'node' },
                    { name: 'db-server', protocol: 'http', url: 'http://localhost:3000' }
                  ]
                },
                steeringRules: [
                  { pattern: '*.ts', rule: 'typescript' },
                  { pattern: '*.md', rule: 'markdown' }
                ],
                instructions: {
                  global: 'Follow TypeScript best practices',
                  local: 'Use functional programming'
                }
              },
              global: {
                settings: {
                  defaultTheme: 'light'
                }
              }
            }
          },
          metadata: {
            timestamp: new Date().toISOString(),
            exportedBy: 'test-user'
          }
        };

        const result = await service.generateCloudMetadata(fullContext);

        expect(result).toBeDefined();
        expect(result.componentCount).toEqual({
          agents: 2,
          commands: 3,
          mcpServers: 2,
          steeringRules: 2,
          instructions: 2
        });
        expect(result.complexityLevel).toBe('advanced');
        expect(result.features).toContain('git-integration');
        expect(result.features).toContain('mcp-servers');
        expect(result.features).toContain('custom-agents');
      });

      it('should handle empty configuration gracefully', async () => {
        const emptyContext: TaptikContext = {
          version: '1.0.0',
          sourceIde: 'claude-code',
          targetIdes: [],
          data: {},
          metadata: {
            timestamp: new Date().toISOString()
          }
        };

        const result = await service.generateCloudMetadata(emptyContext);

        expect(result).toBeDefined();
        expect(result.componentCount).toEqual({
          agents: 0,
          commands: 0,
          mcpServers: 0,
          steeringRules: 0,
          instructions: 0
        });
        expect(result.complexityLevel).toBe('minimal');
        expect(result.searchKeywords).toEqual(['claude-code', 'configuration']);
      });

      it('should handle configuration with only global settings', async () => {
        const globalOnlyContext: TaptikContext = {
          version: '1.0.0',
          sourceIde: 'claude-code',
          targetIdes: ['claude-code'],
          data: {
            claudeCode: {
              global: {
                settings: {
                  theme: 'dark',
                  autoSave: true
                },
                agents: [
                  { id: 'global-agent', name: 'Global Assistant', prompt: 'Global help' }
                ]
              }
            }
          },
          metadata: {
            timestamp: new Date().toISOString()
          }
        };

        const result = await service.generateCloudMetadata(globalOnlyContext);

        expect(result).toBeDefined();
        expect(result.componentCount.agents).toBe(1);
        expect(result.tags).toContain('global-settings');
      });
    });

    describe('auto-tagging algorithms', () => {
      it('should generate tags based on IDE type', async () => {
        const context: TaptikContext = {
          version: '1.0.0',
          sourceIde: 'claude-code',
          targetIdes: ['kiro-ide', 'cursor-ide'],
          data: {},
          metadata: { timestamp: new Date().toISOString() }
        };

        const result = await service.generateCloudMetadata(context);

        expect(result.tags).toContain('claude-code');
        expect(result.tags).toContain('kiro-ide');
        expect(result.tags).toContain('cursor-ide');
        expect(result.tags).toContain('multi-ide');
      });

      it('should generate tags based on features detected', async () => {
        const context: TaptikContext = {
          version: '1.0.0',
          sourceIde: 'claude-code',
          targetIdes: ['claude-code'],
          data: {
            claudeCode: {
              local: {
                settings: {
                  features: {
                    gitIntegration: true,
                    dockerSupport: true,
                    kubernetesIntegration: true
                  }
                },
                mcpServers: {
                  servers: [{ name: 'test', protocol: 'stdio' }]
                }
              }
            }
          },
          metadata: { timestamp: new Date().toISOString() }
        };

        const result = await service.generateCloudMetadata(context);

        expect(result.tags).toContain('git-integration');
        expect(result.tags).toContain('docker');
        expect(result.tags).toContain('kubernetes');
        expect(result.tags).toContain('mcp-enabled');
        expect(result.tags).toContain('devops');
      });

      it('should generate tags based on programming languages detected', async () => {
        const context: TaptikContext = {
          version: '1.0.0',
          sourceIde: 'claude-code',
          targetIdes: ['claude-code'],
          data: {
            claudeCode: {
              local: {
                steeringRules: [
                  { pattern: '*.ts', rule: 'typescript' },
                  { pattern: '*.tsx', rule: 'react' },
                  { pattern: '*.py', rule: 'python' },
                  { pattern: '*.rs', rule: 'rust' }
                ],
                commands: [
                  { name: 'test', command: 'npm test' },
                  { name: 'pytest', command: 'pytest' },
                  { name: 'cargo-test', command: 'cargo test' }
                ]
              }
            }
          },
          metadata: { timestamp: new Date().toISOString() }
        };

        const result = await service.generateCloudMetadata(context);

        expect(result.tags).toContain('typescript');
        expect(result.tags).toContain('react');
        expect(result.tags).toContain('python');
        expect(result.tags).toContain('rust');
        expect(result.tags).toContain('frontend');
        expect(result.tags).toContain('backend');
        expect(result.tags).toContain('fullstack');
      });

      it('should generate tags based on development workflow', async () => {
        const context: TaptikContext = {
          version: '1.0.0',
          sourceIde: 'claude-code',
          targetIdes: ['claude-code'],
          data: {
            claudeCode: {
              local: {
                commands: [
                  { name: 'test', command: 'npm test' },
                  { name: 'test:coverage', command: 'npm run test:coverage' },
                  { name: 'lint', command: 'eslint .' },
                  { name: 'format', command: 'prettier --write' },
                  { name: 'ci', command: 'npm run ci' },
                  { name: 'deploy', command: 'npm run deploy' }
                ],
                instructions: {
                  global: 'Follow TDD practices. Write tests first.'
                }
              }
            }
          },
          metadata: { timestamp: new Date().toISOString() }
        };

        const result = await service.generateCloudMetadata(context);

        expect(result.tags).toContain('tdd');
        expect(result.tags).toContain('testing');
        expect(result.tags).toContain('ci-cd');
        expect(result.tags).toContain('code-quality');
        expect(result.tags).toContain('automated-deployment');
      });
    });

    describe('component analysis', () => {
      it('should accurately count agents', async () => {
        const context: TaptikContext = {
          version: '1.0.0',
          sourceIde: 'claude-code',
          targetIdes: ['claude-code'],
          data: {
            claudeCode: {
              local: {
                agents: [
                  { id: '1', name: 'Agent 1', prompt: 'Prompt 1' },
                  { id: '2', name: 'Agent 2', prompt: 'Prompt 2' }
                ]
              },
              global: {
                agents: [
                  { id: '3', name: 'Agent 3', prompt: 'Prompt 3' }
                ]
              }
            }
          },
          metadata: { timestamp: new Date().toISOString() }
        };

        const result = await service.generateCloudMetadata(context);

        expect(result.componentCount.agents).toBe(3);
      });

      it('should accurately count commands', async () => {
        const context: TaptikContext = {
          version: '1.0.0',
          sourceIde: 'claude-code',
          targetIdes: ['claude-code'],
          data: {
            claudeCode: {
              local: {
                commands: [
                  { name: 'cmd1', command: 'echo 1' },
                  { name: 'cmd2', command: 'echo 2' },
                  { name: 'cmd3', command: 'echo 3' },
                  { name: 'cmd4', command: 'echo 4' }
                ]
              },
              global: {
                commands: [
                  { name: 'global-cmd', command: 'echo global' }
                ]
              }
            }
          },
          metadata: { timestamp: new Date().toISOString() }
        };

        const result = await service.generateCloudMetadata(context);

        expect(result.componentCount.commands).toBe(5);
      });

      it('should accurately count MCP servers', async () => {
        const context: TaptikContext = {
          version: '1.0.0',
          sourceIde: 'claude-code',
          targetIdes: ['claude-code'],
          data: {
            claudeCode: {
              local: {
                mcpServers: {
                  servers: [
                    { name: 'server1', protocol: 'stdio' },
                    { name: 'server2', protocol: 'http' },
                    { name: 'server3', protocol: 'ws' }
                  ]
                }
              }
            }
          },
          metadata: { timestamp: new Date().toISOString() }
        };

        const result = await service.generateCloudMetadata(context);

        expect(result.componentCount.mcpServers).toBe(3);
      });

      it('should accurately count steering rules', async () => {
        const context: TaptikContext = {
          version: '1.0.0',
          sourceIde: 'claude-code',
          targetIdes: ['claude-code'],
          data: {
            claudeCode: {
              local: {
                steeringRules: [
                  { pattern: '*.ts', rule: 'typescript' },
                  { pattern: '*.js', rule: 'javascript' }
                ]
              },
              global: {
                steeringRules: [
                  { pattern: '*.py', rule: 'python' },
                  { pattern: '*.rs', rule: 'rust' },
                  { pattern: '*.go', rule: 'golang' }
                ]
              }
            }
          },
          metadata: { timestamp: new Date().toISOString() }
        };

        const result = await service.generateCloudMetadata(context);

        expect(result.componentCount.steeringRules).toBe(5);
      });

      it('should accurately count instructions', async () => {
        const context: TaptikContext = {
          version: '1.0.0',
          sourceIde: 'claude-code',
          targetIdes: ['claude-code'],
          data: {
            claudeCode: {
              local: {
                instructions: {
                  global: 'Global instruction',
                  local: 'Local instruction'
                }
              },
              global: {
                instructions: {
                  global: 'Another global instruction'
                }
              }
            }
          },
          metadata: { timestamp: new Date().toISOString() }
        };

        const result = await service.generateCloudMetadata(context);

        expect(result.componentCount.instructions).toBe(3);
      });
    });

    describe('search keyword generation', () => {
      it('should generate keywords from configuration content', async () => {
        const context: TaptikContext = {
          version: '1.0.0',
          sourceIde: 'claude-code',
          targetIdes: ['claude-code'],
          data: {
            claudeCode: {
              local: {
                agents: [
                  { id: '1', name: 'React Developer', prompt: 'Help with React and Redux' },
                  { id: '2', name: 'Node.js Expert', prompt: 'Backend development with Express' }
                ],
                commands: [
                  { name: 'docker-build', command: 'docker build -t app .' },
                  { name: 'k8s-deploy', command: 'kubectl apply -f deployment.yaml' }
                ],
                instructions: {
                  global: 'Use TypeScript for all JavaScript projects. Follow SOLID principles.'
                }
              }
            }
          },
          metadata: { timestamp: new Date().toISOString() }
        };

        const result = await service.generateCloudMetadata(context);

        expect(result.searchKeywords).toContain('react');
        expect(result.searchKeywords).toContain('redux');
        expect(result.searchKeywords).toContain('nodejs');
        expect(result.searchKeywords).toContain('express');
        expect(result.searchKeywords).toContain('docker');
        expect(result.searchKeywords).toContain('kubernetes');
        expect(result.searchKeywords).toContain('typescript');
        expect(result.searchKeywords).toContain('solid-principles');
      });

      it('should extract technology stack keywords', async () => {
        const context: TaptikContext = {
          version: '1.0.0',
          sourceIde: 'claude-code',
          targetIdes: ['claude-code'],
          data: {
            claudeCode: {
              local: {
                commands: [
                  { name: 'start', command: 'next dev' },
                  { name: 'build', command: 'vite build' },
                  { name: 'test', command: 'jest --coverage' },
                  { name: 'e2e', command: 'cypress run' },
                  { name: 'lint', command: 'eslint . --ext .ts,.tsx' }
                ]
              }
            }
          },
          metadata: { timestamp: new Date().toISOString() }
        };

        const result = await service.generateCloudMetadata(context);

        expect(result.searchKeywords).toContain('nextjs');
        expect(result.searchKeywords).toContain('vite');
        expect(result.searchKeywords).toContain('jest');
        expect(result.searchKeywords).toContain('cypress');
        expect(result.searchKeywords).toContain('eslint');
        expect(result.searchKeywords).toContain('typescript');
      });

      it('should deduplicate and normalize keywords', async () => {
        const context: TaptikContext = {
          version: '1.0.0',
          sourceIde: 'claude-code',
          targetIdes: ['claude-code'],
          data: {
            claudeCode: {
              local: {
                agents: [
                  { id: '1', name: 'React React Developer', prompt: 'React development' }
                ],
                commands: [
                  { name: 'react-start', command: 'REACT_APP_ENV=dev npm start' }
                ],
                instructions: {
                  global: 'Use React hooks and React context'
                }
              }
            }
          },
          metadata: { timestamp: new Date().toISOString() }
        };

        const result = await service.generateCloudMetadata(context);

        const reactCount = result.searchKeywords.filter(k => k === 'react').length;
        expect(reactCount).toBe(1); // Should deduplicate
        expect(result.searchKeywords.every(k => k === k.toLowerCase())).toBe(true); // Should be lowercase
      });

      it('should limit keywords to reasonable amount', async () => {
        const context: TaptikContext = {
          version: '1.0.0',
          sourceIde: 'claude-code',
          targetIdes: ['claude-code'],
          data: {
            claudeCode: {
              local: {
                instructions: {
                  global: 'This is a very long instruction with many words that could generate too many keywords if not limited properly. ' +
                          'It includes various technologies like React, Vue, Angular, Svelte, Next.js, Nuxt.js, Gatsby, Remix, ' +
                          'Express, Fastify, Koa, Hapi, NestJS, AdonisJS, Strapi, KeystoneJS, Django, Flask, FastAPI, ' +
                          'Rails, Laravel, Spring, ASP.NET, and many more frameworks and libraries.'
                }
              }
            }
          },
          metadata: { timestamp: new Date().toISOString() }
        };

        const result = await service.generateCloudMetadata(context);

        expect(result.searchKeywords.length).toBeLessThanOrEqual(50); // Reasonable limit
        expect(result.searchKeywords.length).toBeGreaterThan(0);
      });
    });

    describe('complexity level assessment', () => {
      it('should assess minimal complexity for basic configurations', async () => {
        const context: TaptikContext = {
          version: '1.0.0',
          sourceIde: 'claude-code',
          targetIdes: ['claude-code'],
          data: {
            claudeCode: {
              local: {
                settings: { theme: 'dark' }
              }
            }
          },
          metadata: { timestamp: new Date().toISOString() }
        };

        const result = await service.generateCloudMetadata(context);

        expect(result.complexityLevel).toBe('minimal');
      });

      it('should assess basic complexity for simple configurations', async () => {
        const context: TaptikContext = {
          version: '1.0.0',
          sourceIde: 'claude-code',
          targetIdes: ['claude-code'],
          data: {
            claudeCode: {
              local: {
                settings: { theme: 'dark' },
                commands: [
                  { name: 'test', command: 'npm test' },
                  { name: 'build', command: 'npm run build' }
                ]
              }
            }
          },
          metadata: { timestamp: new Date().toISOString() }
        };

        const result = await service.generateCloudMetadata(context);

        expect(result.complexityLevel).toBe('basic');
      });

      it('should assess intermediate complexity for moderate configurations', async () => {
        const context: TaptikContext = {
          version: '1.0.0',
          sourceIde: 'claude-code',
          targetIdes: ['claude-code'],
          data: {
            claudeCode: {
              local: {
                settings: { theme: 'dark' },
                agents: [
                  { id: '1', name: 'Agent 1', prompt: 'Prompt' }
                ],
                commands: [
                  { name: 'cmd1', command: 'echo 1' },
                  { name: 'cmd2', command: 'echo 2' },
                  { name: 'cmd3', command: 'echo 3' }
                ],
                steeringRules: [
                  { pattern: '*.ts', rule: 'typescript' }
                ]
              }
            }
          },
          metadata: { timestamp: new Date().toISOString() }
        };

        const result = await service.generateCloudMetadata(context);

        expect(result.complexityLevel).toBe('intermediate');
      });

      it('should assess advanced complexity for rich configurations', async () => {
        const context: TaptikContext = {
          version: '1.0.0',
          sourceIde: 'claude-code',
          targetIdes: ['claude-code'],
          data: {
            claudeCode: {
              local: {
                settings: { theme: 'dark' },
                agents: [
                  { id: '1', name: 'Agent 1', prompt: 'Prompt' },
                  { id: '2', name: 'Agent 2', prompt: 'Prompt' },
                  { id: '3', name: 'Agent 3', prompt: 'Prompt' }
                ],
                commands: Array(8).fill(null).map((_, i) => ({
                  name: `cmd${i}`, command: `echo ${i}`
                })),
                mcpServers: {
                  servers: [
                    { name: 'server1', protocol: 'stdio' },
                    { name: 'server2', protocol: 'http' }
                  ]
                },
                steeringRules: Array(5).fill(null).map((_, i) => ({
                  pattern: `*.ext${i}`, rule: `rule${i}`
                }))
              }
            }
          },
          metadata: { timestamp: new Date().toISOString() }
        };

        const result = await service.generateCloudMetadata(context);

        expect(result.complexityLevel).toBe('advanced');
      });

      it('should assess expert complexity for very complex configurations', async () => {
        const context: TaptikContext = {
          version: '1.0.0',
          sourceIde: 'claude-code',
          targetIdes: ['claude-code', 'kiro-ide', 'cursor-ide'],
          data: {
            claudeCode: {
              local: {
                settings: { theme: 'dark' },
                agents: Array(10).fill(null).map((_, i) => ({
                  id: `${i}`, name: `Agent ${i}`, prompt: `Prompt ${i}`
                })),
                commands: Array(15).fill(null).map((_, i) => ({
                  name: `cmd${i}`, command: `echo ${i}`
                })),
                mcpServers: {
                  servers: Array(5).fill(null).map((_, i) => ({
                    name: `server${i}`, protocol: 'stdio'
                  }))
                },
                steeringRules: Array(10).fill(null).map((_, i) => ({
                  pattern: `*.ext${i}`, rule: `rule${i}`
                })),
                instructions: {
                  global: 'Complex global instructions',
                  local: 'Complex local instructions'
                }
              },
              global: {
                settings: { theme: 'light' },
                agents: Array(5).fill(null).map((_, i) => ({
                  id: `g${i}`, name: `Global Agent ${i}`, prompt: `Global Prompt ${i}`
                }))
              }
            }
          },
          metadata: { timestamp: new Date().toISOString() }
        };

        const result = await service.generateCloudMetadata(context);

        expect(result.complexityLevel).toBe('expert');
      });
    });

    describe('compatibility detection', () => {
      it('should detect IDE compatibility', async () => {
        const context: TaptikContext = {
          version: '1.0.0',
          sourceIde: 'claude-code',
          targetIdes: ['kiro-ide', 'cursor-ide'],
          data: {
            claudeCode: {
              local: {
                settings: {}
              }
            }
          },
          metadata: { timestamp: new Date().toISOString() }
        };

        const result = await service.generateCloudMetadata(context);

        expect(result.compatibility).toContain('claude-code');
        expect(result.compatibility).toContain('kiro-ide');
        expect(result.compatibility).toContain('cursor-ide');
      });

      it('should detect feature compatibility', async () => {
        const context: TaptikContext = {
          version: '1.0.0',
          sourceIde: 'claude-code',
          targetIdes: ['claude-code'],
          data: {
            claudeCode: {
              local: {
                mcpServers: {
                  servers: [{ name: 'test', protocol: 'stdio' }]
                }
              }
            }
          },
          metadata: { timestamp: new Date().toISOString() }
        };

        const result = await service.generateCloudMetadata(context);

        expect(result.features).toContain('mcp-servers');
        expect(result.compatibility).toContain('mcp-compatible');
      });

      it('should detect version compatibility', async () => {
        const context: TaptikContext = {
          version: '2.0.0',
          sourceIde: 'claude-code',
          targetIdes: ['claude-code'],
          data: {
            claudeCode: {
              local: {
                settings: {}
              }
            }
          },
          metadata: { timestamp: new Date().toISOString() }
        };

        const result = await service.generateCloudMetadata(context);

        expect(result.version).toBe('2.0.0');
        expect(result.compatibility).toContain('v2-compatible');
      });
    });
  });
});
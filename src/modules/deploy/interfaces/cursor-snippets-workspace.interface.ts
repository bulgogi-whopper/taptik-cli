/**
 * Cursor IDE snippets and workspace configuration interfaces
 * Defines structure for snippet files and workspace settings
 */

export interface CursorSnippetsConfig {
  [snippetName: string]: CursorSnippet;
}

export interface CursorSnippet {
  scope?: string | string[];
  prefix: string | string[];
  body: string | string[];
  description?: string;
  detail?: string;
  documentation?: string;
  insertFormat?: 'snippet' | 'plainText';
  isFileTemplate?: boolean;
  context?: CursorSnippetContext;
  when?: string;
  sortText?: string;
  filterText?: string;
  insertText?: string;
  range?: CursorSnippetRange;
  command?: CursorSnippetCommand;
}

export interface CursorSnippetContext {
  notIn?: string | string[];
  in?: string | string[];
}

export interface CursorSnippetRange {
  start: CursorSnippetPosition;
  end: CursorSnippetPosition;
}

export interface CursorSnippetPosition {
  line: number;
  character: number;
}

export interface CursorSnippetCommand {
  command: string;
  title?: string;
  arguments?: any[];
}

export interface CursorWorkspaceConfig {
  folders: CursorWorkspaceFolder[];
  settings?: Record<string, any>;
  extensions?: CursorWorkspaceExtensions;
  launch?: CursorWorkspaceLaunch;
  tasks?: CursorWorkspaceTasks;
  remoteAuthority?: string;
  remoteAuthorityResolver?: string;
  transient?: boolean;
  unsavedFiles?: CursorWorkspaceUnsavedFiles;
}

export interface CursorWorkspaceFolder {
  name?: string;
  path: string;
  uri?: string;
}

export interface CursorWorkspaceExtensions {
  recommendations?: string[];
  unwantedRecommendations?: string[];
}

export interface CursorWorkspaceLaunch {
  version: string;
  configurations: any[];
  compounds?: any[];
}

export interface CursorWorkspaceTasks {
  version: string;
  tasks: any[];
}

export interface CursorWorkspaceUnsavedFiles {
  [uri: string]: string;
}

// Snippet categories and templates
export interface CursorSnippetCategory {
  name: string;
  description: string;
  language: string;
  icon?: string;
  snippets: Record<string, CursorSnippet>;
}

export interface CursorSnippetLibrary {
  [language: string]: CursorSnippetCategory[];
}

export const CURSOR_SNIPPET_TEMPLATES: CursorSnippetLibrary = {
  typescript: [
    {
      name: 'TypeScript Basics',
      description: 'Basic TypeScript constructs',
      language: 'typescript',
      snippets: {
        'interface': {
          prefix: 'interface',
          body: [
            'interface ${1:InterfaceName} {',
            '\t${2:property}: ${3:type};',
            '}'
          ],
          description: 'Create a TypeScript interface',
          scope: 'typescript,typescriptreact'
        },
        'class': {
          prefix: 'class',
          body: [
            'class ${1:ClassName} {',
            '\tconstructor(${2:params}) {',
            '\t\t${3:// constructor body}',
            '\t}',
            '',
            '\t${4:method}(${5:params}): ${6:returnType} {',
            '\t\t${7:// method body}',
            '\t}',
            '}'
          ],
          description: 'Create a TypeScript class',
          scope: 'typescript,typescriptreact'
        },
        'function': {
          prefix: 'func',
          body: [
            'function ${1:functionName}(${2:params}): ${3:returnType} {',
            '\t${4:// function body}',
            '}'
          ],
          description: 'Create a TypeScript function',
          scope: 'typescript,typescriptreact'
        },
        'arrow-function': {
          prefix: 'arrow',
          body: [
            'const ${1:functionName} = (${2:params}): ${3:returnType} => {',
            '\t${4:// function body}',
            '};'
          ],
          description: 'Create a TypeScript arrow function',
          scope: 'typescript,typescriptreact'
        },
        'async-function': {
          prefix: 'async',
          body: [
            'async function ${1:functionName}(${2:params}): Promise<${3:returnType}> {',
            '\t${4:// async function body}',
            '}'
          ],
          description: 'Create an async TypeScript function',
          scope: 'typescript,typescriptreact'
        }
      }
    },
    {
      name: 'React TypeScript',
      description: 'React components with TypeScript',
      language: 'typescriptreact',
      snippets: {
        'react-component': {
          prefix: 'rfc',
          body: [
            'import React from \'react\';',
            '',
            'interface ${1:ComponentName}Props {',
            '\t${2:propName}: ${3:propType};',
            '}',
            '',
            'const ${1:ComponentName}: React.FC<${1:ComponentName}Props> = ({ ${2:propName} }) => {',
            '\treturn (',
            '\t\t<div>',
            '\t\t\t${4:// component content}',
            '\t\t</div>',
            '\t);',
            '};',
            '',
            'export default ${1:ComponentName};'
          ],
          description: 'React functional component with TypeScript',
          scope: 'typescriptreact'
        },
        'react-hook': {
          prefix: 'hook',
          body: [
            'import { useState, useEffect } from \'react\';',
            '',
            'export const use${1:HookName} = (${2:params}) => {',
            '\tconst [${3:state}, set${3/(.*)/${1:/capitalize}/}] = useState(${4:initialValue});',
            '',
            '\tuseEffect(() => {',
            '\t\t${5:// effect logic}',
            '\t}, [${6:dependencies}]);',
            '',
            '\treturn { ${3:state}, set${3/(.*)/${1:/capitalize}/} };',
            '};'
          ],
          description: 'Custom React hook',
          scope: 'typescriptreact'
        }
      }
    }
  ],
  javascript: [
    {
      name: 'JavaScript Essentials',
      description: 'Essential JavaScript snippets',
      language: 'javascript',
      snippets: {
        'function': {
          prefix: 'func',
          body: [
            'function ${1:functionName}(${2:params}) {',
            '\t${3:// function body}',
            '}'
          ],
          description: 'Create a JavaScript function',
          scope: 'javascript,javascriptreact'
        },
        'arrow-function': {
          prefix: 'arrow',
          body: [
            'const ${1:functionName} = (${2:params}) => {',
            '\t${3:// function body}',
            '};'
          ],
          description: 'Create a JavaScript arrow function',
          scope: 'javascript,javascriptreact'
        },
        'class': {
          prefix: 'class',
          body: [
            'class ${1:ClassName} {',
            '\tconstructor(${2:params}) {',
            '\t\t${3:// constructor body}',
            '\t}',
            '',
            '\t${4:method}(${5:params}) {',
            '\t\t${6:// method body}',
            '\t}',
            '}'
          ],
          description: 'Create a JavaScript class',
          scope: 'javascript,javascriptreact'
        },
        'promise': {
          prefix: 'promise',
          body: [
            'new Promise((resolve, reject) => {',
            '\t${1:// promise body}',
            '\tif (${2:condition}) {',
            '\t\tresolve(${3:value});',
            '\t} else {',
            '\t\treject(${4:error});',
            '\t}',
            '});'
          ],
          description: 'Create a Promise',
          scope: 'javascript,javascriptreact'
        },
        'async-await': {
          prefix: 'async',
          body: [
            'async function ${1:functionName}(${2:params}) {',
            '\ttry {',
            '\t\tconst ${3:result} = await ${4:asyncOperation};',
            '\t\t${5:// success handling}',
            '\t} catch (${6:error}) {',
            '\t\t${7:// error handling}',
            '\t}',
            '}'
          ],
          description: 'Async/await function',
          scope: 'javascript,javascriptreact'
        }
      }
    }
  ],
  python: [
    {
      name: 'Python Basics',
      description: 'Basic Python constructs',
      language: 'python',
      snippets: {
        'function': {
          prefix: 'def',
          body: [
            'def ${1:function_name}(${2:params}) -> ${3:return_type}:',
            '\t"""${4:Function description}',
            '\t',
            '\tArgs:',
            '\t\t${2:params}: ${5:Parameter description}',
            '\t',
            '\tReturns:',
            '\t\t${3:return_type}: ${6:Return description}',
            '\t"""',
            '\t${7:# function body}',
            '\treturn ${8:result}'
          ],
          description: 'Python function with docstring',
          scope: 'python'
        },
        'class': {
          prefix: 'class',
          body: [
            'class ${1:ClassName}:',
            '\t"""${2:Class description}"""',
            '\t',
            '\tdef __init__(self, ${3:params}) -> None:',
            '\t\t"""Initialize ${1:ClassName}',
            '\t\t',
            '\t\tArgs:',
            '\t\t\t${3:params}: ${4:Parameter description}',
            '\t\t"""',
            '\t\t${5:# initialization code}',
            '\t',
            '\tdef ${6:method_name}(self, ${7:params}) -> ${8:return_type}:',
            '\t\t"""${9:Method description}"""',
            '\t\t${10:# method body}',
            '\t\treturn ${11:result}'
          ],
          description: 'Python class with docstring',
          scope: 'python'
        },
        'if-main': {
          prefix: 'main',
          body: [
            'if __name__ == "__main__":',
            '\t${1:# main code}'
          ],
          description: 'Python main guard',
          scope: 'python'
        },
        'try-except': {
          prefix: 'try',
          body: [
            'try:',
            '\t${1:# try block}',
            'except ${2:Exception} as ${3:e}:',
            '\t${4:# exception handling}',
            'finally:',
            '\t${5:# cleanup code}'
          ],
          description: 'Try-except-finally block',
          scope: 'python'
        }
      }
    }
  ],
  html: [
    {
      name: 'HTML Essentials',
      description: 'Essential HTML snippets',
      language: 'html',
      snippets: {
        'html5': {
          prefix: '!',
          body: [
            '<!DOCTYPE html>',
            '<html lang="${1:en}">',
            '<head>',
            '\t<meta charset="UTF-8">',
            '\t<meta name="viewport" content="width=device-width, initial-scale=1.0">',
            '\t<title>${2:Document}</title>',
            '</head>',
            '<body>',
            '\t${3:<!-- body content -->}',
            '</body>',
            '</html>'
          ],
          description: 'HTML5 boilerplate',
          scope: 'html'
        },
        'div': {
          prefix: 'div',
          body: [
            '<div class="${1:className}">',
            '\t${2:content}',
            '</div>'
          ],
          description: 'HTML div element',
          scope: 'html'
        }
      }
    }
  ],
  css: [
    {
      name: 'CSS Essentials',
      description: 'Essential CSS snippets',
      language: 'css',
      snippets: {
        'flexbox': {
          prefix: 'flex',
          body: [
            'display: flex;',
            'justify-content: ${1:center};',
            'align-items: ${2:center};',
            'flex-direction: ${3:row};'
          ],
          description: 'CSS Flexbox layout',
          scope: 'css,scss,sass,less'
        },
        'grid': {
          prefix: 'grid',
          body: [
            'display: grid;',
            'grid-template-columns: ${1:repeat(auto-fit, minmax(200px, 1fr))};',
            'grid-gap: ${2:1rem};'
          ],
          description: 'CSS Grid layout',
          scope: 'css,scss,sass,less'
        }
      }
    }
  ]
};

// Snippet validation and utilities
export function validateCursorSnippetsConfig(config: CursorSnippetsConfig): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const [name, snippet] of Object.entries(config)) {
    if (!snippet.prefix) {
      errors.push(`Snippet "${name}" is missing prefix`);
    }

    if (!snippet.body) {
      errors.push(`Snippet "${name}" is missing body`);
    } else {
      // Check for common snippet issues
      const bodyStr = Array.isArray(snippet.body) ? snippet.body.join('\n') : snippet.body;
      
      // Check for unescaped dollar signs (except for snippet placeholders)
      const unescapedDollars = bodyStr.match(/(?<!\$)\$(?!\{?\d+)/g);
      if (unescapedDollars) {
        warnings.push(`Snippet "${name}" may have unescaped dollar signs`);
      }

      // Check for tab placeholders consistency
      const tabStops = bodyStr.match(/\$\{?\d+\}?/g);
      if (tabStops) {
        const tabNumbers = tabStops.map(ts => parseInt(ts.replace(/\$\{?(\d+).*/, '$1')));
        const uniqueNumbers = [...new Set(tabNumbers)].sort((a, b) => a - b);
        
        // Check if tab stops are sequential starting from 1
        const expectedSequence = Array.from({ length: uniqueNumbers.length }, (_, i) => i + 1);
        if (!arraysEqual(uniqueNumbers, expectedSequence)) {
          warnings.push(`Snippet "${name}" has non-sequential tab stops`);
        }
      }
    }

    if (snippet.scope && typeof snippet.scope === 'string') {
      const scopes = snippet.scope.split(',');
      const validScopes = [
        'typescript', 'javascript', 'typescriptreact', 'javascriptreact',
        'python', 'java', 'cpp', 'c', 'csharp', 'go', 'rust',
        'html', 'css', 'scss', 'sass', 'less',
        'json', 'yaml', 'xml', 'markdown'
      ];
      
      for (const scope of scopes) {
        if (!validScopes.includes(scope.trim())) {
          warnings.push(`Snippet "${name}" uses unknown scope: ${scope.trim()}`);
        }
      }
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

export function validateCursorWorkspaceConfig(config: CursorWorkspaceConfig): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!config.folders || !Array.isArray(config.folders) || config.folders.length === 0) {
    errors.push('Workspace must have at least one folder');
  } else {
    config.folders.forEach((folder, index) => {
      if (!folder.path) {
        errors.push(`Folder at index ${index} is missing path`);
      }
      
      // Check for relative vs absolute paths
      if (folder.path && !folder.path.startsWith('/') && !folder.path.match(/^[a-zA-Z]:/)) {
        warnings.push(`Folder "${folder.name || folder.path}" uses relative path`);
      }
    });
  }

  // Validate extensions recommendations
  if (config.extensions?.recommendations) {
    for (const rec of config.extensions.recommendations) {
      if (!isValidExtensionId(rec)) {
        errors.push(`Invalid extension ID in workspace recommendations: ${rec}`);
      }
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

export function createSnippetFromTemplate(
  name: string,
  language: string,
  template: 'function' | 'class' | 'interface' | 'component' | 'custom',
  customBody?: string[]
): CursorSnippet {
  const baseSnippet: CursorSnippet = {
    prefix: name.toLowerCase().replace(/\s+/g, '-'),
    description: `${name} snippet`,
    scope: language
  };

  switch (template) {
    case 'function':
      baseSnippet.body = [
        `function ${name}(\${1:params}) {`,
        '\t${2:// function body}',
        '}'
      ];
      break;
    case 'class':
      baseSnippet.body = [
        `class ${name} {`,
        '\tconstructor(${1:params}) {',
        '\t\t${2:// constructor body}',
        '\t}',
        '}'
      ];
      break;
    case 'interface':
      baseSnippet.body = [
        `interface ${name} {`,
        '\t${1:property}: ${2:type};',
        '}'
      ];
      break;
    case 'component':
      baseSnippet.body = [
        `const ${name} = () => {`,
        '\treturn (',
        '\t\t<div>',
        '\t\t\t${1:content}',
        '\t\t</div>',
        '\t);',
        '};'
      ];
      break;
    case 'custom':
      baseSnippet.body = customBody || ['${1:// custom snippet body}'];
      break;
  }

  return baseSnippet;
}

export function optimizeSnippetBody(body: string | string[]): string[] {
  const lines = Array.isArray(body) ? body : [body];
  
  return lines.map(line => {
    // Normalize indentation to tabs
    return line.replace(/^[ ]{2,}/gm, (match) => {
      return '\t'.repeat(Math.floor(match.length / 2));
    });
  });
}

export function extractSnippetVariables(snippet: CursorSnippet): string[] {
  const bodyStr = Array.isArray(snippet.body) ? snippet.body.join('\n') : snippet.body;
  const variables = bodyStr.match(/\$\{?\d+:?([^}]+)?\}?/g) || [];
  
  return variables.map(variable => {
    const match = variable.match(/\$\{?\d+:?([^}]+)?\}?/);
    return match?.[1] || 'placeholder';
  });
}

function arraysEqual<T>(a: T[], b: T[]): boolean {
  return a.length === b.length && a.every((val, i) => val === b[i]);
}

function isValidExtensionId(id: string): boolean {
  const extensionIdPattern = /^[a-z0-9][a-z0-9-]*\.[a-z0-9][a-z0-9-]*$/i;
  return extensionIdPattern.test(id);
}

// Workspace utilities
export function createWorkspaceFromFolders(folders: string[]): CursorWorkspaceConfig {
  return {
    folders: folders.map(folder => ({ path: folder })),
    settings: {},
    extensions: {
      recommendations: [],
      unwantedRecommendations: []
    }
  };
}

export function mergeWorkspaceSettings(
  base: CursorWorkspaceConfig,
  override: Partial<CursorWorkspaceConfig>
): CursorWorkspaceConfig {
  return {
    ...base,
    ...override,
    folders: override.folders || base.folders,
    settings: { ...base.settings, ...override.settings },
    extensions: {
      recommendations: [
        ...(base.extensions?.recommendations || []),
        ...(override.extensions?.recommendations || [])
      ],
      unwantedRecommendations: [
        ...(base.extensions?.unwantedRecommendations || []),
        ...(override.extensions?.unwantedRecommendations || [])
      ]
    }
  };
}
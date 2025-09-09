# Cursor IDE 배포 API 문서

## 개요

이 문서는 Cursor IDE 배포 기능의 프로그래밍 인터페이스를 설명합니다. 개발자가 Taptik의 Cursor IDE 배포 기능을 프로그래밍 방식으로 사용할 때 참조할 수 있습니다.

## 핵심 서비스

### CursorDeploymentService

Cursor IDE 배포의 메인 서비스입니다.

#### 메서드

##### `deployToCursor(context: TaptikContext, options: DeployOptions): Promise<DeploymentResult>`

Taptik 컨텍스트를 Cursor IDE에 배포합니다.

**매개변수:**
- `context: TaptikContext` - 배포할 Taptik 컨텍스트
- `options: DeployOptions` - 배포 옵션

**반환값:**
- `Promise<DeploymentResult>` - 배포 결과

**예시:**
```typescript
import { CursorDeploymentService } from '@/modules/deploy/services/cursor-deployment.service';

const deploymentService = new CursorDeploymentService(/* dependencies */);

const result = await deploymentService.deployToCursor(context, {
  platform: 'cursor-ide',
  components: ['settings', 'ai-prompts'],
  conflictStrategy: 'merge',
  dryRun: false,
  force: false
});

if (result.success) {
  console.log(`배포 완료: ${result.deployedComponents.length}개 컴포넌트`);
} else {
  console.error('배포 실패:', result.errors);
}
```

### CursorTransformerService

Taptik 형식을 Cursor IDE 형식으로 변환하는 서비스입니다.

#### 메서드

##### `transform(context: TaptikContext): Promise<CursorConfiguration>`

Taptik 컨텍스트를 Cursor 설정으로 변환합니다.

**매개변수:**
- `context: TaptikContext` - 변환할 Taptik 컨텍스트

**반환값:**
- `Promise<CursorConfiguration>` - 변환된 Cursor 설정

**예시:**
```typescript
import { CursorTransformerService } from '@/modules/deploy/services/cursor-transformer.service';

const transformer = new CursorTransformerService();
const cursorConfig = await transformer.transform(taptikContext);

console.log('전역 설정:', cursorConfig.globalSettings);
console.log('프로젝트 설정:', cursorConfig.projectSettings);
console.log('AI 프롬프트:', cursorConfig.aiPrompts);
```

##### `transformGlobalSettings(personalContext: TaptikPersonalContext): Promise<CursorGlobalSettings>`

개인 컨텍스트를 Cursor 전역 설정으로 변환합니다.

##### `transformProjectSettings(projectContext: TaptikProjectContext): Promise<CursorProjectSettings>`

프로젝트 컨텍스트를 Cursor 프로젝트 설정으로 변환합니다.

##### `transformAIPrompts(context: TaptikContext): Promise<CursorAIPrompts>`

AI 프롬프트를 Cursor AI 프롬프트로 변환합니다.

### CursorValidatorService

Cursor IDE 배포 전 검증을 수행하는 서비스입니다.

#### 메서드

##### `validate(context: TaptikContext): Promise<ValidationResult>`

Taptik 컨텍스트의 Cursor 호환성을 검증합니다.

**매개변수:**
- `context: TaptikContext` - 검증할 컨텍스트

**반환값:**
- `Promise<ValidationResult>` - 검증 결과

**예시:**
```typescript
import { CursorValidatorService } from '@/modules/deploy/services/cursor-validator.service';

const validator = new CursorValidatorService();
const result = await validator.validate(context);

if (result.isValid) {
  console.log('검증 통과');
  if (result.warnings.length > 0) {
    console.warn('경고:', result.warnings);
  }
} else {
  console.error('검증 실패:', result.errors);
}
```

### CursorComponentHandlerService

개별 Cursor 컴포넌트의 배포를 처리하는 서비스입니다.

#### 메서드

##### `deploy(config: CursorConfiguration, options: DeployOptions): Promise<DeploymentResult>`

Cursor 설정을 파일 시스템에 배포합니다.

##### `deploySettings(config: CursorConfiguration, options: DeployOptions): Promise<ComponentDeploymentResult>`

설정 파일을 배포합니다.

##### `deployAIPrompts(config: CursorConfiguration, options: DeployOptions): Promise<ComponentDeploymentResult>`

AI 프롬프트 파일을 배포합니다.

### CursorConflictResolverService

파일 충돌을 해결하는 서비스입니다.

#### 메서드

##### `resolveSettingsConflict(existing: any, incoming: any, strategy: ConflictStrategy): Promise<ConflictResolution>`

설정 파일 충돌을 해결합니다.

##### `resolveMarkdownConflict(existing: string, incoming: string, strategy: ConflictStrategy): Promise<ConflictResolution>`

마크다운 파일 충돌을 해결합니다.

## 데이터 타입

### TaptikContext

```typescript
interface TaptikContext {
  personalContext?: TaptikPersonalContext;
  projectContext?: TaptikProjectContext;
  promptTemplates?: Record<string, TaptikPromptTemplate>;
  metadata?: TaptikMetadata;
}
```

### TaptikPersonalContext

```typescript
interface TaptikPersonalContext {
  preferences?: {
    fontSize?: number;
    fontFamily?: string;
    theme?: string;
    autoSave?: boolean;
    // ... 기타 설정
  };
  aiSettings?: {
    defaultModel?: string;
    temperature?: number;
    maxTokens?: number;
    contextWindow?: number;
    // ... 기타 AI 설정
  };
  customPrompts?: Record<string, TaptikPrompt>;
  extensions?: string[];
}
```

### TaptikProjectContext

```typescript
interface TaptikProjectContext {
  codeStyle?: {
    rulers?: number[];
    tabSize?: number;
    insertSpaces?: boolean;
    // ... 기타 코드 스타일
  };
  searchExclude?: Record<string, boolean>;
  aiContext?: {
    includeFiles?: string[];
    excludeFiles?: string[];
    maxFileSize?: number;
  };
  languages?: string[];
  steeringDocuments?: Record<string, string>;
  prompts?: Record<string, TaptikPrompt>;
}
```

### CursorConfiguration

```typescript
interface CursorConfiguration {
  globalSettings?: CursorGlobalSettings;
  projectSettings?: CursorProjectSettings;
  extensions?: CursorExtensions;
  snippets?: CursorSnippets;
  aiPrompts?: CursorAIPrompts;
  tasks?: CursorTasks;
  launch?: CursorLaunch;
}
```

### CursorGlobalSettings

```typescript
interface CursorGlobalSettings {
  // 에디터 설정
  'editor.fontSize': number;
  'editor.fontFamily': string;
  'editor.tabSize': number;
  'editor.insertSpaces': boolean;
  'editor.wordWrap': 'on' | 'off' | 'wordWrapColumn' | 'bounded';
  'editor.lineNumbers': 'on' | 'off' | 'relative' | 'interval';
  'editor.minimap.enabled': boolean;
  'editor.formatOnSave': boolean;
  'editor.codeActionsOnSave': Record<string, boolean>;
  
  // 워크벤치 설정
  'workbench.colorTheme': string;
  'workbench.iconTheme': string;
  'workbench.startupEditor': 'none' | 'welcomePage' | 'readme' | 'newUntitledFile';
  'workbench.sideBar.location': 'left' | 'right';
  'workbench.panel.defaultLocation': 'bottom' | 'right';
  
  // AI 설정
  'cursor.ai.enabled': boolean;
  'cursor.ai.model': string;
  'cursor.ai.temperature': number;
  'cursor.ai.maxTokens': number;
  'cursor.ai.contextWindow': number;
  'cursor.ai.autoComplete': boolean;
  'cursor.ai.codeActions': boolean;
  'cursor.ai.chat': boolean;
  
  // 기타 설정
  [key: string]: any;
}
```

### DeployOptions

```typescript
interface DeployOptions {
  platform: 'cursor-ide';
  components?: CursorComponent[];
  skipComponents?: CursorComponent[];
  conflictStrategy?: ConflictStrategy;
  dryRun?: boolean;
  force?: boolean;
  validateOnly?: boolean;
  contextId?: string;
}

type CursorComponent = 'settings' | 'extensions' | 'snippets' | 'ai-prompts' | 'tasks' | 'launch';
type ConflictStrategy = 'prompt' | 'merge' | 'backup' | 'skip' | 'overwrite';
```

### DeploymentResult

```typescript
interface DeploymentResult {
  success: boolean;
  deployedComponents: string[];
  errors: ValidationError[];
  warnings: ValidationWarning[];
  summary: {
    filesDeployed: number;
    filesSkipped: number;
    conflictsResolved: number;
    backupCreated: boolean;
  };
}
```

### ValidationResult

```typescript
interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

interface ValidationError {
  code: string;
  message: string;
  severity: 'error' | 'warning';
  field?: string;
  value?: any;
}

interface ValidationWarning {
  code: string;
  message: string;
  severity: 'warning';
  field?: string;
  value?: any;
}
```

### ConflictResolution

```typescript
interface ConflictResolution {
  action: 'merge' | 'skip' | 'overwrite' | 'backup';
  mergedContent?: any;
  backupPath?: string;
  message?: string;
}
```

## 오류 코드

### CursorDeploymentErrorCode

```typescript
enum CursorDeploymentErrorCode {
  // 검증 오류
  INVALID_CONTEXT = 'CURSOR_INVALID_CONTEXT',
  MISSING_REQUIRED_FIELD = 'CURSOR_MISSING_REQUIRED_FIELD',
  INCOMPATIBLE_VERSION = 'CURSOR_INCOMPATIBLE_VERSION',
  
  // 파일 시스템 오류
  PERMISSION_DENIED = 'CURSOR_PERMISSION_DENIED',
  DISK_FULL = 'CURSOR_DISK_FULL',
  PATH_NOT_FOUND = 'CURSOR_PATH_NOT_FOUND',
  
  // 변환 오류
  TRANSFORMATION_FAILED = 'CURSOR_TRANSFORMATION_FAILED',
  DATA_LOSS_DETECTED = 'CURSOR_DATA_LOSS_DETECTED',
  
  // 보안 오류
  SECURITY_THREAT_DETECTED = 'CURSOR_SECURITY_THREAT_DETECTED',
  MALICIOUS_CONTENT = 'CURSOR_MALICIOUS_CONTENT',
  
  // 성능 오류
  TIMEOUT = 'CURSOR_TIMEOUT',
  MEMORY_LIMIT_EXCEEDED = 'CURSOR_MEMORY_LIMIT_EXCEEDED',
}
```

### CursorDeploymentError

```typescript
class CursorDeploymentError extends Error {
  constructor(
    public code: CursorDeploymentErrorCode,
    message: string,
    public details?: any,
    public recoverable: boolean = true,
  ) {
    super(message);
    this.name = 'CursorDeploymentError';
  }
}
```

## 사용 예시

### 기본 배포

```typescript
import { 
  CursorDeploymentService,
  CursorTransformerService,
  CursorValidatorService,
  CursorComponentHandlerService,
  CursorConflictResolverService
} from '@/modules/deploy/services';

// 서비스 인스턴스 생성
const transformer = new CursorTransformerService();
const validator = new CursorValidatorService();
const componentHandler = new CursorComponentHandlerService(/* dependencies */);
const conflictResolver = new CursorConflictResolverService();

const deploymentService = new CursorDeploymentService(
  transformer,
  validator,
  componentHandler,
  conflictResolver,
  /* 기타 의존성 */
);

// 배포 실행
async function deployCursorIDE(context: TaptikContext) {
  try {
    const result = await deploymentService.deployToCursor(context, {
      platform: 'cursor-ide',
      components: ['settings', 'ai-prompts'],
      conflictStrategy: 'merge',
      dryRun: false
    });

    if (result.success) {
      console.log('배포 성공:', result.summary);
    } else {
      console.error('배포 실패:', result.errors);
    }
  } catch (error) {
    if (error instanceof CursorDeploymentError) {
      console.error(`배포 오류 [${error.code}]:`, error.message);
      if (error.recoverable) {
        console.log('복구 가능한 오류입니다. 재시도를 고려하세요.');
      }
    } else {
      console.error('예상치 못한 오류:', error);
    }
  }
}
```

### 커스텀 변환

```typescript
import { CursorTransformerService } from '@/modules/deploy/services/cursor-transformer.service';

class CustomCursorTransformer extends CursorTransformerService {
  protected async transformGlobalSettings(
    personalContext: TaptikPersonalContext
  ): Promise<CursorGlobalSettings> {
    const baseSettings = await super.transformGlobalSettings(personalContext);
    
    // 커스텀 변환 로직 추가
    return {
      ...baseSettings,
      'editor.fontSize': personalContext.preferences?.fontSize || 16, // 기본값 변경
      'workbench.colorTheme': this.mapCustomTheme(personalContext.preferences?.theme),
    };
  }

  private mapCustomTheme(theme?: string): string {
    const customThemeMap = {
      'my-dark': 'Custom Dark Theme',
      'my-light': 'Custom Light Theme',
    };
    
    return customThemeMap[theme || 'dark'] || 'Default Dark+';
  }
}
```

### 검증 및 오류 처리

```typescript
import { CursorValidatorService, ValidationResult } from '@/modules/deploy/services';

async function validateAndDeploy(context: TaptikContext) {
  const validator = new CursorValidatorService();
  
  // 사전 검증
  const validationResult = await validator.validate(context);
  
  if (!validationResult.isValid) {
    console.error('검증 실패:');
    validationResult.errors.forEach(error => {
      console.error(`- [${error.code}] ${error.message}`);
    });
    return;
  }

  // 경고 확인
  if (validationResult.warnings.length > 0) {
    console.warn('검증 경고:');
    validationResult.warnings.forEach(warning => {
      console.warn(`- [${warning.code}] ${warning.message}`);
    });
    
    // 사용자 확인 (실제 구현에서는 적절한 UI 사용)
    const proceed = confirm('경고가 있습니다. 계속 진행하시겠습니까?');
    if (!proceed) return;
  }

  // 배포 진행
  // ... 배포 로직
}
```

### 충돌 해결

```typescript
import { CursorConflictResolverService, ConflictStrategy } from '@/modules/deploy/services';

async function handleConflicts(
  existingSettings: any,
  newSettings: any,
  strategy: ConflictStrategy
) {
  const conflictResolver = new CursorConflictResolverService();
  
  const resolution = await conflictResolver.resolveSettingsConflict(
    existingSettings,
    newSettings,
    strategy
  );

  switch (resolution.action) {
    case 'merge':
      console.log('설정이 병합되었습니다.');
      return resolution.mergedContent;
    
    case 'backup':
      console.log(`백업 생성됨: ${resolution.backupPath}`);
      return newSettings;
    
    case 'skip':
      console.log('기존 설정을 유지합니다.');
      return existingSettings;
    
    case 'overwrite':
      console.log('새 설정으로 덮어씁니다.');
      return newSettings;
  }
}
```

## 확장 가이드

### 새로운 컴포넌트 추가

1. **타입 정의 확장**:
```typescript
// cursor-config.interface.ts에 추가
interface CursorConfiguration {
  // 기존 속성들...
  newComponent?: NewComponentType;
}

type CursorComponent = 'settings' | 'extensions' | 'snippets' | 'ai-prompts' | 'tasks' | 'launch' | 'new-component';
```

2. **변환 로직 구현**:
```typescript
// CursorTransformerService에 메서드 추가
async transformNewComponent(context: TaptikContext): Promise<NewComponentType> {
  // 변환 로직 구현
}
```

3. **배포 로직 구현**:
```typescript
// CursorComponentHandlerService에 메서드 추가
private async deployNewComponent(
  config: CursorConfiguration,
  options: DeployOptions
): Promise<ComponentDeploymentResult> {
  // 배포 로직 구현
}
```

### 커스텀 검증 규칙 추가

```typescript
// CursorValidatorService 확장
class CustomCursorValidator extends CursorValidatorService {
  async validate(context: TaptikContext): Promise<ValidationResult> {
    const baseResult = await super.validate(context);
    
    // 커스텀 검증 로직 추가
    const customErrors = await this.validateCustomRules(context);
    
    return {
      isValid: baseResult.isValid && customErrors.length === 0,
      errors: [...baseResult.errors, ...customErrors],
      warnings: baseResult.warnings
    };
  }

  private async validateCustomRules(context: TaptikContext): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];
    
    // 커스텀 검증 로직
    if (context.personalContext?.customField && !this.isValidCustomField(context.personalContext.customField)) {
      errors.push({
        code: 'INVALID_CUSTOM_FIELD',
        message: 'Custom field validation failed',
        severity: 'error'
      });
    }
    
    return errors;
  }
}
```

이 API 문서를 통해 개발자는 Cursor IDE 배포 기능을 프로그래밍 방식으로 활용하고 필요에 따라 확장할 수 있습니다.
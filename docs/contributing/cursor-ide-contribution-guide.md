# Cursor IDE 배포 기능 기여 가이드

## 개요

이 가이드는 Taptik의 Cursor IDE 배포 기능에 기여하고자 하는 개발자들을 위한 문서입니다. 코드 구조, 개발 프로세스, 테스트 방법, 그리고 기여 방법에 대해 설명합니다.

## 시작하기

### 개발 환경 설정

1. **저장소 클론**
   ```bash
   git clone https://github.com/your-org/taptik.git
   cd taptik
   ```

2. **의존성 설치**
   ```bash
   pnpm install
   ```

3. **개발 환경 구성**
   ```bash
   # 환경 변수 설정
   cp .env.example .env
   
   # 개발용 빌드
   pnpm build:dev
   ```

4. **테스트 실행**
   ```bash
   # 전체 테스트
   pnpm test
   
   # Cursor IDE 관련 테스트만
   pnpm test src/modules/deploy/services/cursor-*
   ```

### 프로젝트 구조 이해

```
src/modules/deploy/
├── commands/
│   └── deploy.command.ts              # CLI 명령어 핸들러
├── services/
│   ├── cursor-transformer.service.ts  # 데이터 변환
│   ├── cursor-validator.service.ts    # 검증 로직
│   ├── cursor-component-handler.service.ts # 컴포넌트 배포
│   ├── cursor-conflict-resolver.service.ts # 충돌 해결
│   ├── cursor-security-scanner.service.ts  # 보안 스캔
│   ├── cursor-performance-monitor.service.ts # 성능 모니터링
│   └── cursor-audit-logger.service.ts # 감사 로깅
├── interfaces/
│   ├── cursor-config.interface.ts     # Cursor 설정 타입
│   └── deploy-options.interface.ts    # 배포 옵션 타입
├── errors/
│   └── cursor-deploy.error.ts         # Cursor 전용 오류
└── constants/
    └── cursor-paths.constants.ts      # Cursor 경로 상수
```

## 개발 가이드라인

### 코딩 스타일

1. **TypeScript 엄격 모드 사용**
   ```typescript
   // tsconfig.json에서 strict: true 설정
   interface CursorSettings {
     fontSize: number;        // 명시적 타입
     theme?: string;         // 선택적 속성 명시
   }
   ```

2. **NestJS 컨벤션 준수**
   ```typescript
   @Injectable()
   export class CursorTransformerService {
     constructor(
       private readonly logger: Logger,
       private readonly configService: ConfigService,
     ) {}
   }
   ```

3. **명명 규칙**
   - 서비스: `CursorXxxService`
   - 인터페이스: `CursorXxxInterface`
   - 오류: `CursorXxxError`
   - 상수: `CURSOR_XXX_CONSTANTS`

### 오류 처리

1. **커스텀 오류 클래스 사용**
   ```typescript
   export class CursorDeploymentError extends Error {
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

2. **오류 복구 전략 구현**
   ```typescript
   async deployWithRetry<T>(
     operation: () => Promise<T>,
     maxRetries: number = 3,
   ): Promise<T> {
     for (let attempt = 1; attempt <= maxRetries; attempt++) {
       try {
         return await operation();
       } catch (error) {
         if (attempt === maxRetries || !this.isRetryableError(error)) {
           throw error;
         }
         await this.delay(Math.pow(2, attempt) * 1000);
       }
     }
   }
   ```

### 테스트 작성

1. **단위 테스트 구조**
   ```typescript
   describe('CursorTransformerService', () => {
     let service: CursorTransformerService;
     let mockConfigService: jest.Mocked<ConfigService>;

     beforeEach(async () => {
       const module = await Test.createTestingModule({
         providers: [
           CursorTransformerService,
           {
             provide: ConfigService,
             useValue: createMockConfigService(),
           },
         ],
       }).compile();

       service = module.get<CursorTransformerService>(CursorTransformerService);
       mockConfigService = module.get(ConfigService);
     });

     describe('transformGlobalSettings', () => {
       it('should transform personal context to cursor global settings', async () => {
         // Arrange
         const personalContext = createMockPersonalContext();
         
         // Act
         const result = await service.transformGlobalSettings(personalContext);
         
         // Assert
         expect(result['editor.fontSize']).toBe(14);
         expect(result['workbench.colorTheme']).toBe('Default Dark+');
       });
     });
   });
   ```

2. **통합 테스트 작성**
   ```typescript
   describe('Cursor IDE Deployment Integration', () => {
     let app: INestApplication;
     let deploymentService: DeploymentService;

     beforeAll(async () => {
       const moduleFixture = await Test.createTestingModule({
         imports: [DeployModule],
       }).compile();

       app = moduleFixture.createNestApplication();
       await app.init();
       
       deploymentService = app.get<DeploymentService>(DeploymentService);
     });

     it('should deploy complete configuration to cursor ide', async () => {
       // 통합 테스트 로직
     });
   });
   ```

3. **E2E 테스트 작성**
   ```typescript
   describe('CLI Cursor Deployment E2E', () => {
     it('should deploy via cli command', async () => {
       const result = await execAsync('taptik deploy --platform cursor-ide --dry-run');
       expect(result.stdout).toContain('Deployment preview completed');
     });
   });
   ```

## 기능 확장 가이드

### 새로운 컴포넌트 추가

1. **타입 정의 확장**
   ```typescript
   // cursor-config.interface.ts
   export interface CursorConfiguration {
     // 기존 속성들...
     newComponent?: NewComponentConfig;
   }

   export interface NewComponentConfig {
     enabled: boolean;
     settings: Record<string, any>;
   }

   // component-types.interface.ts
   export type CursorComponent = 
     | 'settings' 
     | 'extensions' 
     | 'snippets' 
     | 'ai-prompts' 
     | 'tasks' 
     | 'launch'
     | 'new-component'; // 새 컴포넌트 추가
   ```

2. **변환 로직 구현**
   ```typescript
   // cursor-transformer.service.ts
   export class CursorTransformerService {
     async transform(context: TaptikContext): Promise<CursorConfiguration> {
       return {
         // 기존 변환들...
         newComponent: await this.transformNewComponent(context),
       };
     }

     private async transformNewComponent(
       context: TaptikContext,
     ): Promise<NewComponentConfig> {
       // 새 컴포넌트 변환 로직
       return {
         enabled: true,
         settings: this.mapNewComponentSettings(context),
       };
     }
   }
   ```

3. **배포 로직 구현**
   ```typescript
   // cursor-component-handler.service.ts
   export class CursorComponentHandlerService {
     private async deployComponent(
       component: CursorComponent,
       config: CursorConfiguration,
       options: DeployOptions,
     ): Promise<ComponentDeploymentResult> {
       switch (component) {
         // 기존 케이스들...
         case 'new-component':
           return this.deployNewComponent(config, options);
         default:
           throw new Error(`Unknown component: ${component}`);
       }
     }

     private async deployNewComponent(
       config: CursorConfiguration,
       options: DeployOptions,
     ): Promise<ComponentDeploymentResult> {
       // 새 컴포넌트 배포 로직
     }
   }
   ```

4. **검증 로직 추가**
   ```typescript
   // cursor-validator.service.ts
   export class CursorValidatorService {
     async validate(context: TaptikContext): Promise<ValidationResult> {
       const errors: ValidationError[] = [];
       const warnings: ValidationWarning[] = [];

       // 기존 검증들...
       await this.validateNewComponent(context, errors, warnings);

       return {
         isValid: errors.length === 0,
         errors,
         warnings,
       };
     }

     private async validateNewComponent(
       context: TaptikContext,
       errors: ValidationError[],
       warnings: ValidationWarning[],
     ): Promise<void> {
       // 새 컴포넌트 검증 로직
     }
   }
   ```

5. **테스트 작성**
   ```typescript
   describe('New Component', () => {
     describe('CursorTransformerService', () => {
       it('should transform new component correctly', async () => {
         // 변환 테스트
       });
     });

     describe('CursorComponentHandlerService', () => {
       it('should deploy new component successfully', async () => {
         // 배포 테스트
       });
     });

     describe('CursorValidatorService', () => {
       it('should validate new component configuration', async () => {
         // 검증 테스트
       });
     });
   });
   ```

### 새로운 변환 규칙 추가

1. **매핑 함수 구현**
   ```typescript
   // cursor-transformer.service.ts
   export class CursorTransformerService {
     private mapCustomSetting(
       taptikValue: any,
       defaultValue: any,
     ): any {
       // 커스텀 매핑 로직
       if (this.isValidTaptikValue(taptikValue)) {
         return this.convertToCursorFormat(taptikValue);
       }
       return defaultValue;
     }

     private isValidTaptikValue(value: any): boolean {
       // 유효성 검사 로직
     }

     private convertToCursorFormat(value: any): any {
       // 형식 변환 로직
     }
   }
   ```

2. **테스트 케이스 추가**
   ```typescript
   describe('Custom Setting Mapping', () => {
     it('should map valid taptik value correctly', () => {
       const result = service.mapCustomSetting('taptik-value', 'default');
       expect(result).toBe('cursor-value');
     });

     it('should use default value for invalid input', () => {
       const result = service.mapCustomSetting(null, 'default');
       expect(result).toBe('default');
     });
   });
   ```

### 새로운 검증 규칙 추가

1. **검증 메서드 구현**
   ```typescript
   // cursor-validator.service.ts
   export class CursorValidatorService {
     private async validateCustomRule(
       context: TaptikContext,
       errors: ValidationError[],
       warnings: ValidationWarning[],
     ): Promise<void> {
       const customValue = context.customField;
       
       if (!this.isValidCustomValue(customValue)) {
         errors.push({
           code: 'INVALID_CUSTOM_VALUE',
           message: 'Custom value validation failed',
           severity: 'error',
           field: 'customField',
           value: customValue,
         });
       }
     }

     private isValidCustomValue(value: any): boolean {
       // 커스텀 검증 로직
       return value && typeof value === 'string' && value.length > 0;
     }
   }
   ```

2. **오류 코드 추가**
   ```typescript
   // cursor-deploy.error.ts
   export enum CursorDeploymentErrorCode {
     // 기존 코드들...
     INVALID_CUSTOM_VALUE = 'CURSOR_INVALID_CUSTOM_VALUE',
   }
   ```

## 성능 최적화

### 캐싱 구현

```typescript
@Injectable()
export class CursorTransformerService {
  private transformationCache = new Map<string, CursorConfiguration>();

  async transform(context: TaptikContext): Promise<CursorConfiguration> {
    const cacheKey = this.generateCacheKey(context);
    
    if (this.transformationCache.has(cacheKey)) {
      return this.transformationCache.get(cacheKey)!;
    }

    const result = await this.performTransformation(context);
    this.transformationCache.set(cacheKey, result);
    
    return result;
  }

  private generateCacheKey(context: TaptikContext): string {
    return crypto
      .createHash('md5')
      .update(JSON.stringify(context))
      .digest('hex');
  }
}
```

### 병렬 처리 구현

```typescript
@Injectable()
export class CursorComponentHandlerService {
  async deployComponentsInParallel(
    components: CursorComponent[],
    config: CursorConfiguration,
    options: DeployOptions,
  ): Promise<ComponentDeploymentResult[]> {
    const independentComponents = this.getIndependentComponents(components);
    const dependentComponents = this.getDependentComponents(components);

    // 독립적인 컴포넌트들을 병렬로 처리
    const independentResults = await Promise.all(
      independentComponents.map(component =>
        this.deployComponent(component, config, options)
      )
    );

    // 의존성이 있는 컴포넌트들을 순차적으로 처리
    const dependentResults = [];
    for (const component of dependentComponents) {
      const result = await this.deployComponent(component, config, options);
      dependentResults.push(result);
    }

    return [...independentResults, ...dependentResults];
  }
}
```

## 보안 고려사항

### 입력 검증

```typescript
@Injectable()
export class CursorSecurityScannerService {
  async scanConfiguration(config: CursorConfiguration): Promise<SecurityScanResult> {
    const threats: SecurityThreat[] = [];

    // 악성 패턴 검사
    await this.scanForMaliciousPatterns(config, threats);
    
    // 민감한 데이터 검사
    await this.scanForSensitiveData(config, threats);
    
    // 경로 주입 검사
    await this.scanForPathInjection(config, threats);

    return {
      hasThreats: threats.length > 0,
      threats,
      riskLevel: this.calculateRiskLevel(threats),
    };
  }

  private async scanForMaliciousPatterns(
    config: CursorConfiguration,
    threats: SecurityThreat[],
  ): Promise<void> {
    const maliciousPatterns = [
      /rm\s+-rf/,
      /format\s+c:/,
      /del\s+\/s/,
      // 추가 패턴들...
    ];

    // 설정 내용 스캔
    const configString = JSON.stringify(config);
    for (const pattern of maliciousPatterns) {
      if (pattern.test(configString)) {
        threats.push({
          type: 'MALICIOUS_COMMAND',
          severity: 'HIGH',
          description: `Malicious pattern detected: ${pattern}`,
        });
      }
    }
  }
}
```

### 데이터 무결성

```typescript
@Injectable()
export class CursorDataIntegrityService {
  async verifyDataIntegrity(
    original: TaptikContext,
    transformed: CursorConfiguration,
  ): Promise<IntegrityCheckResult> {
    const issues: IntegrityIssue[] = [];

    // 필수 데이터 보존 확인
    await this.checkEssentialDataPreservation(original, transformed, issues);
    
    // 데이터 손실 검사
    await this.checkDataLoss(original, transformed, issues);
    
    // 타입 일관성 검사
    await this.checkTypeConsistency(transformed, issues);

    return {
      isValid: issues.length === 0,
      issues,
    };
  }
}
```

## 문서화

### API 문서 작성

```typescript
/**
 * Cursor IDE 설정으로 변환합니다.
 * 
 * @param context - 변환할 Taptik 컨텍스트
 * @returns Promise<CursorConfiguration> - 변환된 Cursor 설정
 * 
 * @example
 * ```typescript
 * const transformer = new CursorTransformerService();
 * const cursorConfig = await transformer.transform(taptikContext);
 * console.log(cursorConfig.globalSettings);
 * ```
 * 
 * @throws {CursorDeploymentError} 변환 중 오류가 발생한 경우
 */
async transform(context: TaptikContext): Promise<CursorConfiguration> {
  // 구현...
}
```

### README 업데이트

새로운 기능을 추가할 때는 관련 문서를 업데이트해야 합니다:

1. **사용자 가이드 업데이트**
   - `docs/cursor-ide-deployment-guide.md`
   - 새로운 옵션이나 컴포넌트 설명 추가

2. **API 문서 업데이트**
   - `docs/api/cursor-ide-deploy-api.md`
   - 새로운 인터페이스나 메서드 문서화

3. **트러블슈팅 가이드 업데이트**
   - `docs/cursor-ide-troubleshooting.md`
   - 새로운 오류 상황과 해결 방법 추가

## 기여 프로세스

### 1. 이슈 생성

새로운 기능이나 버그 수정을 시작하기 전에 GitHub 이슈를 생성하세요:

```markdown
## 기능 요청: 새로운 Cursor 컴포넌트 지원

### 설명
Cursor IDE의 새로운 워크스페이스 설정 컴포넌트를 지원하고 싶습니다.

### 제안된 구현
- [ ] 새로운 인터페이스 정의
- [ ] 변환 로직 구현
- [ ] 배포 로직 구현
- [ ] 테스트 작성

### 추가 컨텍스트
Cursor IDE v1.2.0에서 새로 추가된 기능입니다.
```

### 2. 브랜치 생성

```bash
git checkout -b feature/cursor-workspace-component
```

### 3. 개발 및 테스트

```bash
# 개발
# ... 코드 작성 ...

# 테스트 실행
pnpm test src/modules/deploy/services/cursor-*

# 린트 검사
pnpm lint

# 타입 검사
pnpm type-check
```

### 4. 커밋 및 푸시

```bash
# 커밋 (gitmoji 사용)
git add .
git commit -m "✨ Add cursor workspace component support"

# 푸시
git push origin feature/cursor-workspace-component
```

### 5. Pull Request 생성

```markdown
## 새로운 Cursor 워크스페이스 컴포넌트 지원

### 변경사항
- [ ] CursorConfiguration 인터페이스에 workspace 속성 추가
- [ ] CursorTransformerService에 변환 로직 구현
- [ ] CursorComponentHandlerService에 배포 로직 구현
- [ ] 포괄적인 테스트 작성
- [ ] 문서 업데이트

### 테스트
- [ ] 단위 테스트 통과
- [ ] 통합 테스트 통과
- [ ] E2E 테스트 통과

### 체크리스트
- [ ] 코드 스타일 가이드 준수
- [ ] 타입 안전성 확보
- [ ] 오류 처리 구현
- [ ] 문서 업데이트
- [ ] 테스트 커버리지 80% 이상

### 관련 이슈
Closes #123
```

### 6. 코드 리뷰

- 리뷰어의 피드백에 적극적으로 응답
- 요청된 변경사항 반영
- 테스트 및 문서 업데이트

### 7. 머지 후 정리

```bash
# 로컬 브랜치 정리
git checkout main
git pull origin main
git branch -d feature/cursor-workspace-component
```

## 품질 보증

### 코드 품질 체크리스트

- [ ] TypeScript 엄격 모드 준수
- [ ] ESLint 규칙 통과
- [ ] Prettier 포맷팅 적용
- [ ] 단위 테스트 커버리지 80% 이상
- [ ] 통합 테스트 작성
- [ ] 오류 처리 구현
- [ ] 로깅 추가
- [ ] 문서화 완료

### 성능 체크리스트

- [ ] 불필요한 동기 작업 제거
- [ ] 적절한 캐싱 구현
- [ ] 메모리 누수 방지
- [ ] 대용량 파일 처리 최적화
- [ ] 병렬 처리 활용

### 보안 체크리스트

- [ ] 입력 검증 구현
- [ ] 민감한 데이터 보호
- [ ] 경로 주입 방지
- [ ] 권한 검사 구현
- [ ] 감사 로깅 추가

## 도움 받기

### 커뮤니티 리소스

- **GitHub Discussions**: 일반적인 질문과 토론
- **GitHub Issues**: 버그 리포트와 기능 요청
- **Discord**: 실시간 개발자 채팅
- **Documentation**: 포괄적인 개발 가이드

### 멘토링

새로운 기여자를 위한 멘토링 프로그램:

1. **온보딩 세션**: 프로젝트 구조와 개발 프로세스 소개
2. **페어 프로그래밍**: 경험 있는 개발자와 함께 작업
3. **코드 리뷰**: 상세한 피드백과 개선 제안
4. **정기 체크인**: 진행 상황 확인과 지원

기여에 관심이 있으시면 언제든지 연락해 주세요. 여러분의 참여를 환영합니다!
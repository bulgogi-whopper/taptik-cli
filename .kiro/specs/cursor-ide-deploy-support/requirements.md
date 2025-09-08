# 요구사항 문서

## 소개

이 명세서는 기존 `taptik deploy` 명령어에 Cursor IDE 지원을 추가하기 위한 요구사항을 정의합니다. 현재 deploy 명령어는 Claude Code만을 대상 플랫폼으로 지원하고 있습니다. 이 개선사항은 배포 기능을 확장하여 Cursor IDE를 지원하며, 사용자가 Taptik 설정을 Cursor IDE 환경에 배포할 수 있도록 합니다.

`deploy` 명령어는 Supabase에서 Taptik 공통 형식 설정을 가져와서(`build` 명령어로 생성됨) 대상 IDE별 형식으로 변환합니다. Cursor IDE의 경우, TaptikPersonalContext, TaptikProjectContext, TaptikPromptTemplates를 Cursor의 디렉토리 구조와 파일 형식으로 변환하는 작업이 포함됩니다.

이 기능은 기존 배포 아키텍처를 기반으로 하며 Cursor별 배포 로직, 검증, 컴포넌트 매핑을 추가하면서 Claude Code 배포와의 하위 호환성을 유지합니다.

## 아키텍처 컨텍스트

### 데이터 흐름

1. `build` 명령어: 로컬 IDE 설정 → Taptik 공통 형식 → Supabase
2. `deploy` 명령어: Supabase → Taptik 공통 형식 → 대상 IDE 설정

### Taptik 공통 형식 구조

- **TaptikPersonalContext**: 사용자 선호도, 전역 설정
- **TaptikProjectContext**: 프로젝트별 설정, 스티어링 문서, 스펙
- **TaptikPromptTemplates**: AI 프롬프트 및 템플릿

## Cursor IDE 특정 아키텍처

### Cursor IDE 디렉토리 구조

```
~/.cursor/                        # 전역 Cursor 설정
├── settings.json                 # 전역 IDE 설정
├── keybindings.json             # 키보드 단축키 설정
├── snippets/                     # 코드 스니펫
│   ├── javascript.json          # JavaScript 스니펫
│   ├── typescript.json          # TypeScript 스니펫
│   └── python.json              # Python 스니펫
├── extensions/                   # 확장 프로그램 설정
│   ├── extensions.json          # 설치된 확장 프로그램 목록
│   └── settings/                # 확장별 설정
│       ├── copilot.json         # GitHub Copilot 설정
│       ├── prettier.json        # Prettier 설정
│       └── eslint.json          # ESLint 설정
└── ai/                          # AI 관련 설정
    ├── prompts/                 # 사용자 정의 프롬프트
    │   ├── code-review.md       # 코드 리뷰 프롬프트
    │   ├── refactor.md          # 리팩토링 프롬프트
    │   └── debug.md             # 디버깅 프롬프트
    ├── models.json              # AI 모델 설정
    └── context.json             # AI 컨텍스트 설정

.cursor/                          # 프로젝트별 설정
├── settings.json                 # 프로젝트 설정
├── launch.json                   # 디버그 설정
├── tasks.json                    # 작업 설정
├── extensions.json               # 권장 확장 프로그램
├── ai/                          # 프로젝트 AI 설정
│   ├── context.json             # 프로젝트 컨텍스트
│   ├── prompts/                 # 프로젝트별 프롬프트
│   │   ├── architecture.md      # 아키텍처 가이드
│   │   ├── coding-style.md      # 코딩 스타일 가이드
│   │   └── testing.md           # 테스팅 가이드
│   └── rules/                   # AI 규칙
│       ├── code-standards.md    # 코드 표준
│       ├── review-checklist.md  # 리뷰 체크리스트
│       └── security.md          # 보안 가이드라인
└── workspace.code-workspace      # 워크스페이스 설정
```

### Cursor IDE 설정 스키마

```typescript
// ~/.cursor/settings.json (전역 설정)
interface CursorGlobalSettings {
  // 에디터 설정
  "editor.fontSize": number;
  "editor.fontFamily": string;
  "editor.tabSize": number;
  "editor.insertSpaces": boolean;
  "editor.wordWrap": "on" | "off" | "wordWrapColumn" | "bounded";
  "editor.lineNumbers": "on" | "off" | "relative" | "interval";
  "editor.minimap.enabled": boolean;
  "editor.formatOnSave": boolean;
  "editor.codeActionsOnSave": Record<string, boolean>;
  
  // 워크벤치 설정
  "workbench.colorTheme": string;
  "workbench.iconTheme": string;
  "workbench.startupEditor": "none" | "welcomePage" | "readme" | "newUntitledFile";
  "workbench.sideBar.location": "left" | "right";
  "workbench.panel.defaultLocation": "bottom" | "right";
  
  // 파일 설정
  "files.autoSave": "off" | "afterDelay" | "onFocusChange" | "onWindowChange";
  "files.autoSaveDelay": number;
  "files.exclude": Record<string, boolean>;
  "files.watcherExclude": Record<string, boolean>;
  
  // 터미널 설정
  "terminal.integrated.shell.osx": string;
  "terminal.integrated.shell.linux": string;
  "terminal.integrated.shell.windows": string;
  "terminal.integrated.fontSize": number;
  "terminal.integrated.fontFamily": string;
  
  // AI 설정
  "cursor.ai.enabled": boolean;
  "cursor.ai.model": string;
  "cursor.ai.temperature": number;
  "cursor.ai.maxTokens": number;
  "cursor.ai.contextWindow": number;
  "cursor.ai.autoComplete": boolean;
  "cursor.ai.codeActions": boolean;
  "cursor.ai.chat": boolean;
  
  // 확장 프로그램 설정
  "extensions.autoUpdate": boolean;
  "extensions.autoCheckUpdates": boolean;
  "extensions.ignoreRecommendations": boolean;
  
  // 보안 설정
  "security.workspace.trust.enabled": boolean;
  "security.workspace.trust.startupPrompt": "always" | "once" | "never";
  "security.workspace.trust.banner": "always" | "untilDismissed" | "never";
}

// .cursor/settings.json (프로젝트 설정)
interface CursorProjectSettings {
  // 프로젝트별 에디터 설정
  "editor.rulers": number[];
  "editor.detectIndentation": boolean;
  "editor.trimAutoWhitespace": boolean;
  
  // 언어별 설정
  "[typescript]": {
    "editor.defaultFormatter": string;
    "editor.formatOnSave": boolean;
    "editor.codeActionsOnSave": Record<string, boolean>;
  };
  "[javascript]": {
    "editor.defaultFormatter": string;
    "editor.formatOnSave": boolean;
  };
  "[python]": {
    "editor.defaultFormatter": string;
    "python.defaultInterpreterPath": string;
  };
  
  // 검색 설정
  "search.exclude": Record<string, boolean>;
  "search.useIgnoreFiles": boolean;
  "search.useGlobalIgnoreFiles": boolean;
  
  // AI 프로젝트 설정
  "cursor.ai.projectContext": {
    "includeFiles": string[];
    "excludeFiles": string[];
    "maxFileSize": number;
    "followSymlinks": boolean;
  };
  "cursor.ai.rules": string[]; // 규칙 파일 경로들
  "cursor.ai.prompts": string[]; // 프롬프트 파일 경로들
}

// AI 컨텍스트 설정
interface CursorAIContext {
  version: string;
  project: {
    name: string;
    description: string;
    type: string;
    languages: string[];
    frameworks: string[];
  };
  context: {
    files: {
      include: string[];
      exclude: string[];
      maxSize: number;
    };
    directories: {
      include: string[];
      exclude: string[];
    };
    patterns: {
      important: string[]; // 중요한 파일 패턴
      ignore: string[]; // 무시할 파일 패턴
    };
  };
  rules: {
    coding: string[]; // 코딩 규칙 파일들
    architecture: string[]; // 아키텍처 규칙 파일들
    testing: string[]; // 테스팅 규칙 파일들
    security: string[]; // 보안 규칙 파일들
  };
  prompts: {
    system: string; // 시스템 프롬프트
    templates: Record<string, string>; // 템플릿 프롬프트들
  };
}

// 확장 프로그램 설정
interface CursorExtensions {
  recommendations: string[]; // 권장 확장 프로그램
  unwantedRecommendations: string[]; // 권장하지 않는 확장 프로그램
}

// 작업 설정
interface CursorTasks {
  version: string;
  tasks: Array<{
    label: string;
    type: string;
    command: string;
    args?: string[];
    group?: "build" | "test" | "clean";
    presentation?: {
      echo?: boolean;
      reveal?: "always" | "silent" | "never";
      focus?: boolean;
      panel?: "shared" | "dedicated" | "new";
    };
    problemMatcher?: string | string[];
    runOptions?: {
      runOn?: "default" | "folderOpen";
    };
  }>;
}

// 디버그 설정
interface CursorLaunch {
  version: string;
  configurations: Array<{
    name: string;
    type: string;
    request: "launch" | "attach";
    program?: string;
    args?: string[];
    cwd?: string;
    env?: Record<string, string>;
    console?: "internalConsole" | "integratedTerminal" | "externalTerminal";
    preLaunchTask?: string;
    postDebugTask?: string;
  }>;
}
```

### Cursor IDE 고유 기능 및 제약사항

- **AI 우선 설계**: 코드 생성, 리팩토링, 디버깅을 위한 깊은 AI 통합
- **컨텍스트 인식**: 프로젝트 전체 컨텍스트를 이해하는 AI 어시스턴트
- **실시간 협업**: AI와의 실시간 코드 협업 기능
- **스마트 자동완성**: 컨텍스트 기반 지능형 코드 완성
- **코드 액션**: AI 기반 코드 개선 제안 및 자동 적용
- **채팅 인터페이스**: 코드에 대한 자연어 질의응답

### 플랫폼별 제약사항

- **파일 크기 제한**: 개별 파일 최대 100MB, 전체 프로젝트 컨텍스트 최대 1GB
- **AI 모델 제한**: 동시에 최대 3개의 AI 모델 사용 가능
- **컨텍스트 윈도우**: AI 컨텍스트 윈도우 크기에 따른 파일 포함 제한
- **확장 프로그램**: 최대 100개의 확장 프로그램 설치 가능
- **워크스페이스**: 단일 워크스페이스당 최대 50개의 폴더

## 요구사항

### 요구사항 1

**사용자 스토리:** Cursor IDE를 사용하는 개발자로서, Taptik 설정을 Cursor IDE에 배포하고 싶습니다. 그래야 다른 머신에서도 개발 환경 설정을 동기화할 수 있습니다.

#### 승인 기준

1. `taptik deploy --platform cursor-ide`를 실행할 때 시스템은 설정을 Cursor IDE 디렉토리에 배포해야 합니다
2. 플랫폼 플래그 없이 `taptik deploy`를 실행할 때 시스템은 하위 호환성을 위해 Claude Code를 기본값으로 해야 합니다
3. `--platform cursor-ide`를 지정할 때 시스템은 Cursor IDE 호환성을 위한 설정 검증을 해야 합니다
4. Cursor IDE 배포가 성공적으로 완료될 때 시스템은 배포된 컴포넌트와 함께 성공 메시지를 표시해야 합니다
5. Cursor IDE 배포가 실패할 때 시스템은 오류 메시지를 표시하고 백업이 생성된 경우 롤백을 시도해야 합니다

### 요구사항 2

**사용자 스토리:** Cursor IDE 사용자로서, deploy 명령어가 Cursor별 컴포넌트를 처리하기를 원합니다. 그래야 모든 Cursor IDE 설정이 적절히 배포됩니다.

#### 승인 기준

1. Cursor IDE에 배포할 때 시스템은 다음 컴포넌트 유형을 지원해야 합니다: settings, extensions, snippets, ai-prompts, tasks, launch
2. settings 컴포넌트를 배포할 때 시스템은 `~/.cursor/settings.json` (전역) 및 `.cursor/settings.json` (프로젝트)에 작성해야 합니다
3. extensions 컴포넌트를 배포할 때 시스템은 확장 프로그램 파일을 `~/.cursor/extensions/` 및 `.cursor/extensions.json`에 작성해야 합니다
4. snippets 컴포넌트를 배포할 때 시스템은 스니펫 파일을 `~/.cursor/snippets/` 디렉토리에 작성해야 합니다
5. ai-prompts 컴포넌트를 배포할 때 시스템은 AI 프롬프트 파일을 `.cursor/ai/prompts/` 및 `.cursor/ai/rules/` 디렉토리에 작성해야 합니다
6. tasks 컴포넌트를 배포할 때 시스템은 작업 설정을 `.cursor/tasks.json`에 작성해야 합니다
7. launch 컴포넌트를 배포할 때 시스템은 디버그 설정을 `.cursor/launch.json`에 작성해야 합니다

### 요구사항 3

**사용자 스토리:** 사용자로서, deploy 명령어가 배포 전에 Cursor IDE 설정을 검증하기를 원합니다. 그래야 호환성 문제를 조기에 발견할 수 있습니다.

#### 승인 기준

1. Cursor IDE에 배포할 때 시스템은 설정이 Cursor 호환 데이터를 포함하는지 검증해야 합니다
2. 검증에서 필수 Cursor 컴포넌트가 누락된 것을 감지할 때 시스템은 경고를 표시하지만 배포를 계속해야 합니다
3. 검증에서 호환되지 않는 데이터 구조를 감지할 때 시스템은 오류를 표시하고 배포를 중단해야 합니다
4. Cursor 플랫폼과 함께 `--validate-only` 플래그를 사용할 때 시스템은 배포 없이 검증만 수행해야 합니다
5. 검증이 통과할 때 시스템은 배포를 진행해야 합니다
6. 검증이 실패할 때 시스템은 수정 제안과 함께 상세한 오류 메시지를 표시해야 합니다

### 요구사항 4

**사용자 스토리:** 개발자로서, Cursor IDE와 함께 기존 deploy 명령어 옵션을 사용하고 싶습니다. 그래야 익숙한 배포 워크플로우를 활용할 수 있습니다.

#### 승인 기준

1. Cursor 플랫폼과 함께 `--dry-run`을 사용할 때 시스템은 변경 없이 배포될 내용을 미리보기해야 합니다
2. `--components` 플래그를 사용할 때 시스템은 지정된 Cursor 컴포넌트만 배포해야 합니다
3. `--skip-components` 플래그를 사용할 때 시스템은 배포 중 지정된 Cursor 컴포넌트를 건너뛰어야 합니다
4. `--conflict-strategy`를 사용할 때 시스템은 Cursor 파일 충돌에 전략을 적용해야 합니다
5. `--force` 플래그를 사용할 때 시스템은 확인 프롬프트 없이 배포해야 합니다
6. `--context-id`를 사용할 때 시스템은 지정된 설정을 Cursor IDE에 배포해야 합니다

### 요구사항 5

**사용자 스토리:** Cursor IDE 사용자로서, 시스템이 파일 충돌을 지능적으로 처리하기를 원합니다. 그래야 기존 Cursor 설정이 적절할 때 보존됩니다.

#### 승인 기준

1. 기존 Cursor 설치에 배포할 때 시스템은 파일 충돌을 감지해야 합니다
2. 충돌 전략이 "prompt"일 때 시스템은 각 충돌을 어떻게 처리할지 사용자에게 물어봐야 합니다
3. 충돌 전략이 "merge"일 때 시스템은 Cursor 설정 파일을 지능적으로 병합해야 합니다
4. 충돌 전략이 "backup"일 때 시스템은 Cursor 파일을 덮어쓰기 전에 백업을 생성해야 합니다
5. 충돌 전략이 "skip"일 때 시스템은 충돌하는 파일을 건너뛰고 다른 파일들을 계속 처리해야 합니다
6. 충돌 전략이 "overwrite"일 때 시스템은 기존 Cursor 파일을 새 파일로 교체해야 합니다

### 요구사항 6

**사용자 스토리:** 사용자로서, Cursor 배포에 대한 포괄적인 오류 처리를 원합니다. 그래야 배포 실패로부터 복구할 수 있습니다.

#### 승인 기준

1. Cursor 배포가 실패할 때 시스템은 오류 코드와 함께 상세한 오류 메시지를 제공해야 합니다
2. 부분 완료 후 배포가 실패할 때 시스템은 자동 롤백을 시도해야 합니다
3. 롤백이 성공할 때 시스템은 이전 Cursor 설정 상태를 복원해야 합니다
4. 롤백이 실패할 때 시스템은 수동 복구 지침을 제공해야 합니다
5. 배포에서 권한 오류가 발생할 때 시스템은 적절한 수정 방법을 제안해야 합니다
6. 배포에서 누락된 디렉토리가 발생할 때 시스템은 자동으로 생성해야 합니다

### 요구사항 7

**사용자 스토리:** 개발자로서, Cursor 배포가 기존 보안 및 성능 기능과 통합되기를 원합니다. 그래야 동일한 수준의 안전성과 효율성을 유지할 수 있습니다.

#### 승인 기준

1. Cursor IDE에 배포할 때 시스템은 Cursor별 컴포넌트에 대한 보안 스캔을 수행해야 합니다
2. 보안 스캔에서 악성 패턴을 감지할 때 시스템은 배포를 차단하고 경고를 표시해야 합니다
3. 대용량 Cursor 설정을 배포할 때 시스템은 스트리밍 최적화를 사용해야 합니다
4. 배포가 완료될 때 시스템은 Cursor 배포에 대한 성능 보고서를 생성해야 합니다
5. 배포가 백업을 생성할 때 시스템은 백업 매니페스트에 Cursor별 파일을 포함해야 합니다
6. 감사 로깅이 활성화될 때 시스템은 모든 Cursor 배포 활동을 로그해야 합니다

### 요구사항 8

**사용자 스토리:** 사용자로서, Cursor 배포 옵션에 대한 명확한 문서와 도움말을 원합니다. 그래야 새로운 기능을 어떻게 사용하는지 이해할 수 있습니다.

#### 승인 기준

1. `taptik deploy --help`를 실행할 때 시스템은 Cursor를 지원되는 플랫폼 옵션으로 표시해야 합니다
2. `taptik deploy --platform cursor-ide --help`를 실행할 때 시스템은 Cursor별 배포 도움말을 표시해야 합니다
3. 배포가 실패할 때 시스템은 다음 단계와 함께 도움이 되는 오류 메시지를 제공해야 합니다
4. 잘못된 Cursor 컴포넌트 이름을 사용할 때 시스템은 유효한 컴포넌트 이름을 제안해야 합니다
5. 배포가 성공할 때 시스템은 Cursor IDE에 배포된 내용의 요약을 표시해야 합니다

### 요구사항 9

**사용자 스토리:** 개발자로서, 적절한 Taptik 공통 형식에서 Cursor IDE로의 데이터 변환을 원합니다. 그래야 설정이 정확하게 변환되고 적용됩니다.

#### 승인 기준

1. TaptikPersonalContext를 변환할 때 시스템은 사용자 선호도를 `~/.cursor/settings.json`과 개인 AI 프롬프트에 매핑해야 합니다
2. TaptikProjectContext를 변환할 때 시스템은 프로젝트 설정을 `.cursor/settings.json`, AI 규칙을 `.cursor/ai/rules/`, 프롬프트를 `.cursor/ai/prompts/`에 매핑해야 합니다
3. TaptikPromptTemplates를 변환할 때 시스템은 프롬프트를 `.cursor/ai/prompts/` 또는 적절한 Cursor 프롬프트 위치에 매핑해야 합니다
4. 변환에서 필수 필드가 누락될 때 시스템은 합리적인 기본값을 사용하고 경고를 로그해야 합니다
5. 변환에서 호환되지 않는 데이터 유형을 감지할 때 시스템은 호환 가능한 형식으로 변환하거나 경고와 함께 건너뛰어야 합니다
6. 변환이 완료될 때 시스템은 모든 필수 데이터가 보존되었는지 검증해야 합니다

### 요구사항 10

**사용자 스토리:** Cursor IDE 사용자로서, 시스템이 Cursor별 컴포넌트 구조를 적절히 처리하기를 원합니다. 그래야 IDE 설정이 올바르게 작동합니다.

#### 승인 기준

1. settings 컴포넌트를 배포할 때 시스템은 전역 및 프로젝트 설정을 적절한 JSON 구조로 생성해야 합니다
2. extensions 컴포넌트를 배포할 때 시스템은 `extensions.json`에 권장 확장 프로그램 목록을 생성해야 합니다
3. snippets 컴포넌트를 배포할 때 시스템은 언어별 스니펫 파일을 `~/.cursor/snippets/` 디렉토리에 생성해야 합니다
4. ai-prompts 컴포넌트를 배포할 때 시스템은 프롬프트 및 규칙 파일을 적절한 마크다운 형식으로 생성해야 합니다
5. tasks 컴포넌트를 배포할 때 시스템은 기존 작업과 병합하면서 사용자 사용자 정의를 보존해야 합니다
6. Cursor 디렉토리를 생성할 때 시스템은 적절한 권한과 소유권을 보장해야 합니다

### 요구사항 11

**사용자 스토리:** 사용자로서, Cursor 배포에 대한 강력한 데이터 검증 및 변환을 원합니다. 그래야 배포된 설정의 무결성을 신뢰할 수 있습니다.

#### 승인 기준

1. Supabase에서 가져올 때 시스템은 Taptik 공통 형식 스키마 준수를 검증해야 합니다
2. Cursor 형식으로 변환할 때 시스템은 필수 Cursor 컴포넌트 필드 존재를 검증해야 합니다
3. 스키마 위반을 감지할 때 시스템은 필드 수준 정보와 함께 상세한 오류 메시지를 제공해야 합니다
4. 검증에서 경고가 발생할 때 시스템은 배포를 계속하지만 모든 경고를 로그해야 합니다
5. 데이터 변환에서 정보가 손실될 때 시스템은 잠재적 데이터 손실에 대해 사용자에게 경고해야 합니다
6. 검증이 성공적으로 완료될 때 시스템은 데이터 무결성에 대한 확신을 가지고 진행해야 합니다

### 요구사항 12

**사용자 스토리:** 개발자로서, 기존 Cursor IDE 설치와의 원활한 통합을 원합니다. 그래야 현재 설정이 보존되고 향상됩니다.

#### 승인 기준

1. 기존 `.cursor/` 디렉토리에 배포할 때 시스템은 현재 Cursor 설정 구조를 감지하고 분석해야 합니다
2. 기존 설정과 병합할 때 시스템은 사용자별 사용자 정의 및 로컬 수정사항을 보존해야 합니다
3. 충돌하는 AI 프롬프트를 만날 때 시스템은 내용 분석을 기반으로 지능적인 병합 옵션을 제공해야 합니다
4. 기존 작업을 업데이트할 때 시스템은 작업 설정 및 로컬 수정사항을 보존해야 합니다
5. 기존 확장 프로그램과 통합할 때 시스템은 기능 중복을 피하고 설정을 병합해야 합니다
6. 배포가 완료될 때 시스템은 기존 Cursor 기능이 그대로 유지되는지 확인해야 합니다

### 요구사항 13

**사용자 스토리:** 사용자로서, 복잡한 Cursor 배포에 대한 포괄적인 오류 처리 및 복구를 원합니다. 그래야 배포 문제로부터 복구할 수 있습니다.

#### 승인 기준

1. Supabase 가져오기가 실패할 때 시스템은 지수 백오프로 재시도하고 가능한 경우 오프라인 옵션을 제공해야 합니다
2. 특정 컴포넌트에 대한 변환이 실패할 때 시스템은 다른 컴포넌트를 계속하고 부분 성공을 보고해야 합니다
3. 파일 시스템 작업이 실패할 때 시스템은 상세한 권한 및 경로 안내를 제공해야 합니다
4. 배포가 중단될 때 시스템은 배포 상태를 유지하고 재개를 허용해야 합니다
5. 롤백이 트리거될 때 시스템은 무결성 검증과 함께 모든 Cursor 컴포넌트를 이전 상태로 복원해야 합니다
6. 복구가 불가능할 때 시스템은 단계별 수동 복구 지침을 제공해야 합니다

### 요구사항 14

**사용자 스토리:** 개발자로서, 플랫폼별 컴포넌트 호환성 매핑을 원합니다. 그래야 설정이 다른 IDE 간에 어떻게 변환되는지 이해할 수 있습니다.

#### 승인 기준

1. Cursor IDE에 배포할 때 시스템은 Claude Code 'settings' 컴포넌트를 Cursor 'settings' 컴포넌트에 직접 매핑해야 합니다
2. Cursor IDE에 배포할 때 시스템은 Claude Code 'agents' 컴포넌트를 형식 변환과 함께 Cursor 'ai-prompts' 컴포넌트에 매핑해야 합니다
3. Cursor IDE에 배포할 때 시스템은 Claude Code 'commands' 컴포넌트를 기능 매핑과 함께 Cursor 'tasks' 컴포넌트에 매핑해야 합니다
4. Cursor IDE에 배포할 때 시스템은 Claude Code 'project' 컴포넌트를 Cursor 'ai-prompts' 및 'settings' 컴포넌트에 매핑해야 합니다
5. Cursor별 컴포넌트(snippets, extensions, launch)를 만날 때 시스템은 적절한 Cursor 위치에 배포해야 합니다
6. 컴포넌트가 호환되지 않을 때 시스템은 명확한 매핑 안내와 대안 제안을 제공해야 합니다

### 요구사항 15

**사용자 스토리:** 사용자로서, 대용량 Cursor 배포에 대한 성능 최적화를 원합니다. 그래야 설정 크기에 관계없이 배포 경험이 효율적입니다.

#### 승인 기준

1. 대용량 설정(>10MB)을 배포할 때 시스템은 메모리 사용량을 최소화하기 위해 스트리밍 처리를 사용해야 합니다
2. 여러 컴포넌트를 처리할 때 시스템은 안전한 경우 병렬 변환을 수행해야 합니다
3. 여러 파일을 작성할 때 시스템은 최적의 I/O 성능을 위해 파일 작업을 배치해야 합니다
4. 배포에 많은 작은 파일이 포함될 때 시스템은 파일시스템 효율성을 위해 최적화해야 합니다
5. 네트워크 작업이 느릴 때 시스템은 진행률 표시기와 예상 완료 시간을 제공해야 합니다
6. 배포가 완료될 때 시스템은 성능 메트릭과 최적화 제안을 보고해야 합니다

### 요구사항 16

**사용자 스토리:** 사용자로서, 양방향 호환성 지원을 원합니다. 그래야 다른 IDE 환경 간의 동기화를 유지할 수 있습니다.

#### 승인 기준

1. Taptik 형식에서 배포할 때 시스템은 역변환에 필요한 메타데이터를 보존해야 합니다
2. Cursor 설정이 나중에 수정될 때 시스템은 build 명령어를 통해 Taptik 형식으로 다시 빌드하는 것을 지원해야 합니다
3. 양방향에서 변경이 발생할 때 시스템은 충돌을 감지하고 해결 옵션을 제공해야 합니다
4. 반복적으로 배포할 때 시스템은 전체 교체보다는 증분 업데이트를 위해 최적화해야 합니다
5. 변경사항을 추적할 때 시스템은 변환 및 배포의 감사 추적을 유지해야 합니다
6. 동기화 충돌이 발생할 때 시스템은 상세한 diff 보기와 병합 지원을 제공해야 합니다

### 요구사항 17

**사용자 스토리:** 개발자로서, 구체적인 예제와 함께 구체적인 데이터 변환 규칙을 원합니다. 그래야 Claude Code 설정이 Cursor IDE 형식으로 어떻게 변환되는지 정확히 이해할 수 있습니다.

#### 승인 기준

1. Claude Code 설정을 변환할 때 시스템은 다음과 같이 매핑해야 합니다:
   - `permissions: string[]` → `cursorSettings.security.workspace.trust.enabled: boolean`
   - `environmentVariables: Record<string,string>` → `cursorSettings.terminal.integrated.env.*: Record<string,string>`
   - `statusLine.enabled: boolean` → `cursorSettings.workbench.statusBar.visible: boolean`
   - `fontSize: number` → `cursorSettings.editor.fontSize: number`
   - `theme: string` → `cursorSettings.workbench.colorTheme: string`

2. Claude Code 에이전트를 변환할 때 시스템은 다음과 같이 매핑해야 합니다:
   - 에이전트 마크다운 내용 → `.cursor/ai/prompts/{agent-name}.md`
   - 에이전트 메타데이터 → `.cursor/ai/context.json`의 프롬프트 템플릿 항목
   - 에이전트 기능 → Cursor AI 컨텍스트 규칙 및 설정

3. Claude Code 명령어를 변환할 때 시스템은 다음과 같이 매핑해야 합니다:
   - 명령어 내용 → `.cursor/tasks.json`의 작업 설정
   - 명령어 권한 → 작업 실행 권한 및 종속성
   - 명령어 트리거 → 작업 조건 및 파일 패턴

4. 프로젝트 설정을 변환할 때 시스템은 다음과 같이 매핑해야 합니다:
   - 프로젝트 지침 → `.cursor/ai/rules/project-context.md`
   - AI 설정 → `.cursor/ai/context.json`
   - 사용자 정의 설정 → `.cursor/settings.json` 프로젝트별 섹션

5. 변환에서 AI 프롬프트를 생성할 때 시스템은 다음을 생성해야 합니다:
   - `architecture.md` 프로젝트 구조 패턴에서
   - `coding-style.md` 개발 가이드라인에서
   - `testing.md` 테스팅 설정에서
   - `security.md` 보안 설정에서

6. 변환에서 데이터 손실 시나리오를 만날 때 시스템은 주석에 원본 데이터를 보존하고 마이그레이션 경고를 제공해야 합니다
# Cursor IDE 설정 매핑 참조

## 개요

이 문서는 Taptik 공통 형식에서 Cursor IDE 형식으로의 상세한 설정 매핑을 제공합니다. 개발자와 고급 사용자가 설정 변환 과정을 이해하고 커스터마이징할 때 참조할 수 있습니다.

## 전역 설정 매핑

### 에디터 설정

| Taptik 경로 | Cursor 설정 키 | 기본값 | 설명 |
|-------------|----------------|--------|------|
| `personalContext.preferences.fontSize` | `editor.fontSize` | `14` | 에디터 폰트 크기 |
| `personalContext.preferences.fontFamily` | `editor.fontFamily` | `"Consolas"` | 에디터 폰트 패밀리 |
| `personalContext.preferences.tabSize` | `editor.tabSize` | `2` | 탭 크기 |
| `personalContext.preferences.insertSpaces` | `editor.insertSpaces` | `true` | 탭 대신 스페이스 사용 |
| `personalContext.preferences.wordWrap` | `editor.wordWrap` | `"on"` | 자동 줄바꿈 |
| `personalContext.preferences.minimap` | `editor.minimap.enabled` | `true` | 미니맵 표시 |
| `personalContext.preferences.formatOnSave` | `editor.formatOnSave` | `true` | 저장 시 자동 포맷팅 |

### 워크벤치 설정

| Taptik 경로 | Cursor 설정 키 | 변환 규칙 | 설명 |
|-------------|----------------|-----------|------|
| `personalContext.preferences.theme` | `workbench.colorTheme` | 테마 매핑 함수 적용 | 색상 테마 |
| `personalContext.preferences.iconTheme` | `workbench.iconTheme` | `"vs-seti"` (기본값) | 아이콘 테마 |
| `personalContext.preferences.sidebarLocation` | `workbench.sideBar.location` | `"left"` | 사이드바 위치 |

#### 테마 매핑 규칙

```typescript
const themeMapping = {
  'dark': 'Default Dark+',
  'light': 'Default Light+',
  'high-contrast': 'Default High Contrast',
  'claude-dark': 'Default Dark+',
  'claude-light': 'Default Light+',
  // 기타 테마는 그대로 전달
};
```

### 파일 설정

| Taptik 경로 | Cursor 설정 키 | 변환 로직 | 설명 |
|-------------|----------------|-----------|------|
| `personalContext.preferences.autoSave` | `files.autoSave` | `true` → `"afterDelay"`, `false` → `"off"` | 자동 저장 |
| `personalContext.preferences.excludeFiles` | `files.exclude` | 객체 그대로 전달 | 제외할 파일 패턴 |

### AI 설정

| Taptik 경로 | Cursor 설정 키 | 유효 범위 | 설명 |
|-------------|----------------|-----------|------|
| `personalContext.aiSettings.defaultModel` | `cursor.ai.model` | 문자열 | 기본 AI 모델 |
| `personalContext.aiSettings.temperature` | `cursor.ai.temperature` | `0.0 - 2.0` | AI 온도 설정 |
| `personalContext.aiSettings.maxTokens` | `cursor.ai.maxTokens` | `1 - 32000` | 최대 토큰 수 |
| `personalContext.aiSettings.contextWindow` | `cursor.ai.contextWindow` | `1000 - 32000` | 컨텍스트 윈도우 크기 |
| `personalContext.aiSettings.autoComplete` | `cursor.ai.autoComplete` | `boolean` | 자동 완성 활성화 |
| `personalContext.aiSettings.codeActions` | `cursor.ai.codeActions` | `boolean` | 코드 액션 활성화 |
| `personalContext.aiSettings.chat` | `cursor.ai.chat` | `boolean` | AI 채팅 활성화 |

## 프로젝트 설정 매핑

### 에디터 프로젝트 설정

| Taptik 경로 | Cursor 설정 키 | 기본값 | 설명 |
|-------------|----------------|--------|------|
| `projectContext.codeStyle.rulers` | `editor.rulers` | `[80, 120]` | 코드 가이드라인 |
| `projectContext.codeStyle.detectIndentation` | `editor.detectIndentation` | `true` | 들여쓰기 자동 감지 |
| `projectContext.codeStyle.trimWhitespace` | `editor.trimAutoWhitespace` | `true` | 자동 공백 제거 |

### 검색 설정

| Taptik 경로 | Cursor 설정 키 | 기본값 | 설명 |
|-------------|----------------|--------|------|
| `projectContext.searchExclude` | `search.exclude` | 기본 제외 패턴 | 검색 제외 패턴 |
| - | `search.useIgnoreFiles` | `true` | .gitignore 파일 사용 |
| - | `search.useGlobalIgnoreFiles` | `true` | 전역 ignore 파일 사용 |

#### 기본 검색 제외 패턴

```json
{
  "**/node_modules": true,
  "**/dist": true,
  "**/.git": true,
  "**/coverage": true,
  "**/.nyc_output": true
}
```

### AI 프로젝트 설정

| Taptik 경로 | Cursor 설정 키 | 설명 |
|-------------|----------------|------|
| `projectContext.aiContext.includeFiles` | `cursor.ai.projectContext.includeFiles` | AI 컨텍스트에 포함할 파일 패턴 |
| `projectContext.aiContext.excludeFiles` | `cursor.ai.projectContext.excludeFiles` | AI 컨텍스트에서 제외할 파일 패턴 |
| `projectContext.aiContext.maxFileSize` | `cursor.ai.projectContext.maxFileSize` | 최대 파일 크기 (바이트) |
| - | `cursor.ai.projectContext.followSymlinks` | `false` | 심볼릭 링크 따라가기 |

## 언어별 설정 매핑

### TypeScript/JavaScript

| Taptik 설정 | Cursor 설정 | 값 |
|-------------|-------------|-----|
| `projectContext.languages.typescript.formatter` | `[typescript].editor.defaultFormatter` | `"esbenp.prettier-vscode"` |
| `projectContext.languages.typescript.organizeImports` | `[typescript].editor.codeActionsOnSave.source.organizeImports` | `true` |
| `projectContext.languages.typescript.quoteStyle` | `[typescript].typescript.preferences.quoteStyle` | `"single"` |

### Python

| Taptik 설정 | Cursor 설정 | 값 |
|-------------|-------------|-----|
| `projectContext.languages.python.formatter` | `[python].editor.defaultFormatter` | `"ms-python.black-formatter"` |
| `projectContext.languages.python.interpreterPath` | `[python].python.defaultInterpreterPath` | 설정값 또는 `"python"` |
| `projectContext.languages.python.linting` | `[python].python.linting.enabled` | `true` |

### JSON

| Taptik 설정 | Cursor 설정 | 값 |
|-------------|-------------|-----|
| - | `[json].editor.defaultFormatter` | `"vscode.json-language-features"` |
| - | `[json].editor.formatOnSave` | `true` |

## AI 프롬프트 매핑

### 프롬프트 파일 구조

| Taptik 프롬프트 유형 | Cursor 파일 위치 | 파일명 규칙 |
|---------------------|------------------|-------------|
| 개인 프롬프트 | `~/.cursor/ai/prompts/` | `{프롬프트명}.md` |
| 프로젝트 프롬프트 | `.cursor/ai/prompts/` | `{프롬프트명}.md` |
| 스티어링 문서 | `.cursor/ai/rules/` | `{규칙명}.md` |

### 자동 생성되는 규칙 파일

| 규칙 파일 | 생성 조건 | 내용 |
|-----------|-----------|------|
| `architecture.md` | 프로젝트 구조 정보 존재 | 아키텍처 가이드라인 |
| `coding-style.md` | 코딩 스타일 설정 존재 | 코딩 스타일 규칙 |
| `testing.md` | 테스트 설정 존재 | 테스팅 가이드라인 |
| `security.md` | 보안 설정 존재 | 보안 가이드라인 |

### AI 컨텍스트 설정 생성

```typescript
// .cursor/ai/context.json 구조
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
      important: string[];
      ignore: string[];
    };
  };
  rules: {
    coding: string[];
    architecture: string[];
    testing: string[];
    security: string[];
  };
  prompts: {
    system: string;
    templates: Record<string, string>;
  };
}
```

## 확장 프로그램 매핑

### 호환성 매핑

| Claude Code 확장 | Cursor 대체/호환 확장 | 상태 |
|------------------|----------------------|------|
| `github.copilot` | 내장 AI 기능 | 제외 (충돌 방지) |
| `tabnine.tabnine-vscode` | 내장 AI 기능 | 제외 (충돌 방지) |
| `ms-vscode.vscode-typescript-next` | 내장 TypeScript 지원 | 제외 |
| `esbenp.prettier-vscode` | `esbenp.prettier-vscode` | 호환 |
| `ms-python.python` | `ms-python.python` | 호환 |

### 확장 프로그램 파일 구조

```json
// .cursor/extensions.json
{
  "recommendations": [
    "esbenp.prettier-vscode",
    "ms-python.python",
    "bradlc.vscode-tailwindcss"
  ],
  "unwantedRecommendations": [
    "github.copilot",
    "tabnine.tabnine-vscode"
  ]
}
```

## 스니펫 매핑

### 언어별 스니펫 파일

| 언어 | 파일 위치 | 형식 |
|------|-----------|------|
| TypeScript | `~/.cursor/snippets/typescript.json` | VSCode 스니펫 형식 |
| JavaScript | `~/.cursor/snippets/javascript.json` | VSCode 스니펫 형식 |
| Python | `~/.cursor/snippets/python.json` | VSCode 스니펫 형식 |
| JSON | `~/.cursor/snippets/json.json` | VSCode 스니펫 형식 |

### 스니펫 변환 규칙

```typescript
// Taptik 스니펫 → Cursor 스니펫 변환
interface TaptikSnippet {
  name: string;
  prefix: string;
  body: string[];
  description: string;
  scope?: string;
}

interface CursorSnippet {
  prefix: string;
  body: string[];
  description: string;
}

// 변환 로직: scope 정보는 파일명으로, name은 키로 사용
```

## 작업 및 디버그 설정 매핑

### 작업 설정 매핑

| Taptik 명령어 속성 | Cursor 작업 속성 | 변환 규칙 |
|-------------------|------------------|-----------|
| `command.name` | `label` | 그대로 사용 |
| `command.script` | `command` | 스크립트 명령어 추출 |
| `command.args` | `args` | 배열로 변환 |
| `command.cwd` | `options.cwd` | 작업 디렉토리 |
| `command.env` | `options.env` | 환경 변수 |

### 디버그 설정 매핑

| Taptik 디버그 속성 | Cursor 디버그 속성 | 기본값 |
|-------------------|-------------------|--------|
| `debug.name` | `name` | 설정명 |
| `debug.type` | `type` | `"node"` (기본) |
| `debug.program` | `program` | 진입점 파일 |
| `debug.args` | `args` | 실행 인수 |
| `debug.env` | `env` | 환경 변수 |
| `debug.console` | `console` | `"integratedTerminal"` |

## 데이터 변환 규칙

### 타입 변환

| Taptik 타입 | Cursor 타입 | 변환 규칙 |
|-------------|-------------|-----------|
| `string` | `string` | 그대로 전달 |
| `number` | `number` | 범위 검증 후 전달 |
| `boolean` | `boolean` | 그대로 전달 |
| `string[]` | `string[]` | 배열 그대로 전달 |
| `object` | `object` | 깊은 복사 후 전달 |

### 기본값 처리

1. **Taptik 값이 존재하는 경우**: Taptik 값 사용
2. **Taptik 값이 null/undefined인 경우**: Cursor 기본값 사용
3. **유효하지 않은 값인 경우**: 기본값 사용 후 경고 로그

### 검증 규칙

| 설정 유형 | 검증 규칙 | 실패 시 동작 |
|-----------|-----------|--------------|
| AI 온도 | `0.0 ≤ value ≤ 2.0` | 기본값(0.7) 사용 |
| 토큰 수 | `1 ≤ value ≤ 32000` | 경고 후 그대로 사용 |
| 폰트 크기 | `8 ≤ value ≤ 72` | 기본값(14) 사용 |
| 파일 경로 | 유효한 경로 형식 | 오류 발생 |

## 오류 처리 및 복구

### 변환 오류 처리

| 오류 유형 | 처리 방법 | 사용자 알림 |
|-----------|-----------|-------------|
| 필수 필드 누락 | 기본값 사용 | 경고 메시지 |
| 타입 불일치 | 타입 변환 시도 | 경고 메시지 |
| 범위 초과 | 유효 범위로 조정 | 경고 메시지 |
| 변환 불가능 | 해당 설정 건너뛰기 | 오류 메시지 |

### 데이터 손실 방지

1. **원본 데이터 보존**: 주석으로 원본 값 기록
2. **변환 로그**: 모든 변환 과정 기록
3. **백업 생성**: 기존 설정 자동 백업
4. **롤백 지원**: 변환 실패 시 자동 롤백

## 커스터마이징 가이드

### 매핑 규칙 수정

개발자는 다음 파일을 수정하여 매핑 규칙을 커스터마이징할 수 있습니다:

- `src/modules/deploy/services/cursor-transformer.service.ts`
- `src/modules/deploy/interfaces/cursor-config.interface.ts`

### 새로운 설정 추가

1. **인터페이스 확장**: `CursorConfiguration` 인터페이스에 새 속성 추가
2. **변환 로직 구현**: `CursorTransformerService`에 변환 메서드 추가
3. **검증 규칙 추가**: `CursorValidatorService`에 검증 로직 추가
4. **테스트 작성**: 새로운 매핑에 대한 단위 테스트 작성

### 호환성 확장

새로운 IDE나 도구와의 호환성을 추가하려면:

1. 새로운 변환 서비스 생성
2. 플랫폼별 인터페이스 정의
3. 배포 서비스에 새 플랫폼 추가
4. CLI 명령어에 새 플랫폼 옵션 추가

이 참조 문서를 통해 Cursor IDE 배포 기능의 내부 동작을 이해하고 필요에 따라 커스터마이징할 수 있습니다.
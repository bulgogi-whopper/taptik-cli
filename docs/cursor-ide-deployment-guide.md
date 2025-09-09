# Cursor IDE 배포 가이드

## 개요

Taptik의 Cursor IDE 배포 기능을 사용하면 Supabase에 저장된 Taptik 공통 형식 설정을 Cursor IDE 환경에 배포할 수 있습니다. 이 가이드는 Cursor IDE 배포 기능의 사용법과 설정 매핑에 대해 설명합니다.

## 시작하기

### 전제 조건

- Taptik CLI가 설치되어 있어야 합니다
- Supabase에 설정이 업로드되어 있어야 합니다 (`taptik build` 명령어 사용)
- Cursor IDE가 설치되어 있어야 합니다

### 기본 사용법

```bash
# Cursor IDE에 설정 배포
taptik deploy --platform cursor-ide

# 특정 컨텍스트 ID로 배포
taptik deploy --platform cursor-ide --context-id your-context-id

# 드라이런 모드로 미리보기
taptik deploy --platform cursor-ide --dry-run
```

## 명령어 옵션

### 기본 옵션

| 옵션 | 설명 | 예시 |
|------|------|------|
| `--platform cursor-ide` | Cursor IDE를 대상 플랫폼으로 지정 | `--platform cursor-ide` |
| `--context-id <id>` | 특정 컨텍스트 ID 지정 | `--context-id abc-123` |
| `--dry-run` | 실제 배포 없이 미리보기 | `--dry-run` |
| `--force` | 확인 프롬프트 없이 강제 배포 | `--force` |

### 컴포넌트 선택

```bash
# 특정 컴포넌트만 배포
taptik deploy --platform cursor-ide --components settings,ai-prompts

# 특정 컴포넌트 제외
taptik deploy --platform cursor-ide --skip-components extensions,snippets
```

지원되는 컴포넌트:
- `settings`: IDE 설정 파일
- `extensions`: 확장 프로그램 권장 목록
- `snippets`: 코드 스니펫
- `ai-prompts`: AI 프롬프트 및 규칙
- `tasks`: 작업 설정
- `launch`: 디버그 설정

### 충돌 해결 전략

```bash
# 충돌 시 사용자에게 확인
taptik deploy --platform cursor-ide --conflict-strategy prompt

# 기존 파일과 병합
taptik deploy --platform cursor-ide --conflict-strategy merge

# 백업 후 덮어쓰기
taptik deploy --platform cursor-ide --conflict-strategy backup

# 충돌하는 파일 건너뛰기
taptik deploy --platform cursor-ide --conflict-strategy skip

# 기존 파일 덮어쓰기
taptik deploy --platform cursor-ide --conflict-strategy overwrite
```

## 설정 매핑

### 전역 설정 매핑

Taptik 개인 컨텍스트의 설정이 Cursor IDE 전역 설정(`~/.cursor/settings.json`)으로 매핑됩니다:

| Taptik 설정 | Cursor 설정 | 설명 |
|-------------|-------------|------|
| `preferences.fontSize` | `editor.fontSize` | 에디터 폰트 크기 |
| `preferences.theme` | `workbench.colorTheme` | 테마 설정 |
| `preferences.autoSave` | `files.autoSave` | 자동 저장 설정 |
| `aiSettings.defaultModel` | `cursor.ai.model` | 기본 AI 모델 |
| `aiSettings.temperature` | `cursor.ai.temperature` | AI 온도 설정 |
| `aiSettings.maxTokens` | `cursor.ai.maxTokens` | 최대 토큰 수 |

### 프로젝트 설정 매핑

Taptik 프로젝트 컨텍스트의 설정이 프로젝트별 설정(`.cursor/settings.json`)으로 매핑됩니다:

| Taptik 설정 | Cursor 설정 | 설명 |
|-------------|-------------|------|
| `codeStyle.rulers` | `editor.rulers` | 코드 가이드라인 |
| `searchExclude` | `search.exclude` | 검색 제외 패턴 |
| `aiContext.includeFiles` | `cursor.ai.projectContext.includeFiles` | AI 컨텍스트 포함 파일 |
| `aiContext.excludeFiles` | `cursor.ai.projectContext.excludeFiles` | AI 컨텍스트 제외 파일 |

### AI 프롬프트 매핑

| Taptik 프롬프트 | Cursor 위치 | 설명 |
|-----------------|-------------|------|
| 개인 프롬프트 | `~/.cursor/ai/prompts/` | 사용자 정의 프롬프트 |
| 프로젝트 프롬프트 | `.cursor/ai/prompts/` | 프로젝트별 프롬프트 |
| 스티어링 문서 | `.cursor/ai/rules/` | AI 규칙 및 가이드라인 |

## 사용 예시

### 기본 배포

```bash
# 1. 설정 빌드 (Supabase에 업로드)
taptik build --source claude-code

# 2. Cursor IDE에 배포
taptik deploy --platform cursor-ide

# 출력 예시:
# ✓ Supabase에서 설정을 가져왔습니다
# ✓ Cursor IDE 호환성 검증 완료
# ✓ 설정 변환 완료
# ✓ 6개 컴포넌트 배포 완료
#   - settings: ~/.cursor/settings.json, .cursor/settings.json
#   - ai-prompts: .cursor/ai/prompts/, .cursor/ai/rules/
#   - extensions: .cursor/extensions.json
#   - snippets: ~/.cursor/snippets/
#   - tasks: .cursor/tasks.json
#   - launch: .cursor/launch.json
```

### 선택적 배포

```bash
# AI 프롬프트와 설정만 배포
taptik deploy --platform cursor-ide --components settings,ai-prompts

# 출력 예시:
# ✓ 2개 컴포넌트 배포 완료
#   - settings: 설정 파일 업데이트됨
#   - ai-prompts: 5개 프롬프트, 4개 규칙 파일 생성됨
```

### 충돌 해결

```bash
# 기존 설정과 병합
taptik deploy --platform cursor-ide --conflict-strategy merge

# 출력 예시:
# ⚠ 충돌 감지: ~/.cursor/settings.json
# ✓ 설정 병합 완료 (기존 사용자 정의 보존)
# ✓ 백업 생성: ~/.cursor/settings.json.backup.20240108-143022
```

## 배포된 파일 구조

배포 후 다음과 같은 파일 구조가 생성됩니다:

```
~/.cursor/                          # 전역 Cursor 설정
├── settings.json                   # 전역 IDE 설정
├── snippets/                       # 코드 스니펫
│   ├── typescript.json
│   ├── javascript.json
│   └── python.json
└── ai/                            # AI 관련 설정
    └── prompts/                   # 개인 프롬프트
        ├── code-review.md
        └── refactor.md

.cursor/                            # 프로젝트별 설정
├── settings.json                   # 프로젝트 설정
├── extensions.json                 # 권장 확장 프로그램
├── tasks.json                      # 작업 설정
├── launch.json                     # 디버그 설정
└── ai/                            # 프로젝트 AI 설정
    ├── context.json               # AI 컨텍스트 설정
    ├── prompts/                   # 프로젝트 프롬프트
    │   ├── architecture.md
    │   ├── coding-style.md
    │   └── testing.md
    └── rules/                     # AI 규칙
        ├── code-standards.md
        ├── review-checklist.md
        └── security.md
```

## 고급 기능

### 검증 전용 모드

배포하기 전에 설정의 유효성을 확인할 수 있습니다:

```bash
taptik deploy --platform cursor-ide --validate-only

# 출력 예시:
# ✓ 기본 구조 검증 통과
# ⚠ 경고: AI 토큰 제한이 권장값을 초과합니다 (35000 > 32000)
# ⚠ 경고: 일부 확장 프로그램이 Cursor와 호환되지 않을 수 있습니다
# ✓ 전체 검증 완료 (2개 경고)
```

### 성능 모니터링

대용량 설정 배포 시 성능 정보를 확인할 수 있습니다:

```bash
taptik deploy --platform cursor-ide --verbose

# 출력 예시:
# 📊 성능 보고서:
#   - 총 처리 시간: 2.3초
#   - 변환 시간: 0.8초
#   - 파일 작성 시간: 1.2초
#   - 처리된 파일: 23개
#   - 메모리 사용량: 45MB
```

## 다음 단계

- [트러블슈팅 가이드](cursor-ide-troubleshooting.md)에서 일반적인 문제 해결 방법을 확인하세요
- [설정 매핑 참조](cursor-ide-mapping-reference.md)에서 상세한 매핑 정보를 확인하세요
- [API 문서](../api/deploy-api.md)에서 프로그래밍 방식 사용법을 확인하세요
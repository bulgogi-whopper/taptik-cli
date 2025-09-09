# Cursor IDE 배포 트러블슈팅 가이드

## 일반적인 문제 및 해결 방법

### 1. 권한 관련 오류

#### 문제: "Permission denied" 오류

```
Error: EACCES: permission denied, open '~/.cursor/settings.json'
```

**원인**: Cursor 설정 파일에 대한 쓰기 권한이 없습니다.

**해결 방법**:

1. **macOS/Linux**:
   ```bash
   # 파일 권한 확인
   ls -la ~/.cursor/settings.json
   
   # 권한 수정
   chmod 644 ~/.cursor/settings.json
   
   # 디렉토리 권한 확인
   chmod 755 ~/.cursor
   ```

2. **Windows**:
   ```cmd
   # 관리자 권한으로 실행하거나 파일 속성에서 권한 수정
   ```

3. **Cursor가 실행 중인 경우**:
   ```bash
   # Cursor IDE를 완전히 종료한 후 다시 시도
   ```

#### 문제: "Cannot create directory" 오류

**해결 방법**:
```bash
# 필요한 디렉토리 수동 생성
mkdir -p ~/.cursor/ai/prompts
mkdir -p ~/.cursor/snippets
mkdir -p .cursor/ai/rules
```

### 2. 설정 검증 오류

#### 문제: "Invalid context" 오류

```
Error: CURSOR_INVALID_CONTEXT - Taptik context is required
```

**원인**: Supabase에서 설정을 가져올 수 없거나 설정이 손상되었습니다.

**해결 방법**:

1. **컨텍스트 ID 확인**:
   ```bash
   # 사용 가능한 컨텍스트 목록 확인
   taptik list
   
   # 특정 컨텍스트 ID로 재시도
   taptik deploy --platform cursor-ide --context-id your-context-id
   ```

2. **설정 재빌드**:
   ```bash
   # 설정을 다시 빌드하여 Supabase에 업로드
   taptik build --source claude-code
   ```

#### 문제: "Incompatible version" 경고

```
Warning: Context version is missing or incompatible
```

**해결 방법**:
```bash
# 최신 버전으로 설정 재빌드
taptik build --source claude-code --force
```

### 3. 변환 관련 오류

#### 문제: "Transformation failed" 오류

```
Error: CURSOR_TRANSFORMATION_FAILED - Failed to transform configuration
```

**해결 방법**:

1. **개별 컴포넌트 배포**:
   ```bash
   # 문제가 있는 컴포넌트 식별을 위해 개별 배포
   taptik deploy --platform cursor-ide --components settings
   taptik deploy --platform cursor-ide --components ai-prompts
   ```

2. **검증 전용 모드 사용**:
   ```bash
   # 구체적인 오류 정보 확인
   taptik deploy --platform cursor-ide --validate-only
   ```

#### 문제: AI 설정 범위 초과 경고

```
Warning: Token limit exceeds Cursor recommended maximum (35000 > 32000)
```

**해결 방법**:
- 경고이므로 배포는 계속되지만, AI 성능에 영향을 줄 수 있습니다
- 필요시 AI 설정에서 토큰 제한을 조정하세요

### 4. 파일 충돌 문제

#### 문제: 기존 설정이 덮어써짐

**예방 방법**:
```bash
# 백업 전략 사용
taptik deploy --platform cursor-ide --conflict-strategy backup

# 또는 병합 전략 사용
taptik deploy --platform cursor-ide --conflict-strategy merge
```

**복구 방법**:
```bash
# 백업 파일에서 복원 (자동 생성된 백업 파일명 확인)
cp ~/.cursor/settings.json.backup.20240108-143022 ~/.cursor/settings.json
```

#### 문제: 설정 병합 시 예상과 다른 결과

**해결 방법**:
1. **수동 병합**:
   ```bash
   # 충돌하는 파일 건너뛰고 수동으로 병합
   taptik deploy --platform cursor-ide --conflict-strategy skip
   ```

2. **개별 설정 확인**:
   ```bash
   # 드라이런으로 변경사항 미리보기
   taptik deploy --platform cursor-ide --dry-run
   ```

### 5. 성능 관련 문제

#### 문제: 배포가 너무 느림

**해결 방법**:

1. **대용량 파일 확인**:
   ```bash
   # 파일 크기 확인
   taptik deploy --platform cursor-ide --verbose
   ```

2. **불필요한 컴포넌트 제외**:
   ```bash
   # 필요한 컴포넌트만 배포
   taptik deploy --platform cursor-ide --components settings,ai-prompts
   ```

#### 문제: 메모리 부족 오류

```
Error: CURSOR_MEMORY_LIMIT_EXCEEDED - Memory limit exceeded during processing
```

**해결 방법**:
```bash
# 컴포넌트를 나누어 배포
taptik deploy --platform cursor-ide --components settings
taptik deploy --platform cursor-ide --components ai-prompts
taptik deploy --platform cursor-ide --components extensions,snippets
```

### 6. Cursor IDE 특정 문제

#### 문제: AI 프롬프트가 인식되지 않음

**확인 사항**:
1. 파일 위치 확인:
   ```bash
   ls -la .cursor/ai/prompts/
   ls -la .cursor/ai/rules/
   ```

2. 파일 형식 확인:
   - 프롬프트 파일은 `.md` 확장자여야 함
   - UTF-8 인코딩이어야 함

3. Cursor IDE 재시작:
   ```bash
   # Cursor IDE를 완전히 종료하고 재시작
   ```

#### 문제: 확장 프로그램 권장이 표시되지 않음

**해결 방법**:
1. 파일 확인:
   ```bash
   cat .cursor/extensions.json
   ```

2. 올바른 형식인지 확인:
   ```json
   {
     "recommendations": [
       "esbenp.prettier-vscode",
       "ms-python.python"
     ]
   }
   ```

### 7. 네트워크 관련 문제

#### 문제: Supabase 연결 실패

```
Error: Failed to fetch configuration from Supabase
```

**해결 방법**:

1. **네트워크 연결 확인**:
   ```bash
   # 인터넷 연결 확인
   ping supabase.com
   ```

2. **인증 상태 확인**:
   ```bash
   # 로그인 상태 확인
   taptik auth whoami
   
   # 필요시 재로그인
   taptik auth login
   ```

3. **프록시 설정 확인**:
   ```bash
   # 프록시 환경에서는 환경 변수 설정
   export HTTP_PROXY=http://proxy.company.com:8080
   export HTTPS_PROXY=http://proxy.company.com:8080
   ```

## 디버깅 도구

### 1. 상세 로그 활성화

```bash
# 상세한 디버그 정보 출력
taptik deploy --platform cursor-ide --verbose

# 또는 환경 변수 설정
DEBUG=taptik:* taptik deploy --platform cursor-ide
```

### 2. 설정 검증

```bash
# 배포 전 검증
taptik deploy --platform cursor-ide --validate-only

# 드라이런으로 변경사항 미리보기
taptik deploy --platform cursor-ide --dry-run
```

### 3. 로그 파일 확인

```bash
# 로그 파일 위치 (OS별로 다름)
# macOS: ~/Library/Logs/taptik/
# Linux: ~/.local/share/taptik/logs/
# Windows: %APPDATA%/taptik/logs/

tail -f ~/.local/share/taptik/logs/deploy.log
```

## 지원 요청

문제가 해결되지 않는 경우 다음 정보와 함께 지원을 요청하세요:

### 필수 정보

1. **시스템 정보**:
   ```bash
   taptik --version
   node --version
   npm --version
   ```

2. **오류 메시지**: 전체 오류 스택 트레이스

3. **실행 명령어**: 사용한 정확한 명령어

4. **환경 정보**:
   - 운영체제 및 버전
   - Cursor IDE 버전
   - 네트워크 환경 (프록시 사용 여부 등)

### 로그 수집

```bash
# 디버그 모드로 실행하여 상세 로그 수집
DEBUG=taptik:* taptik deploy --platform cursor-ide --verbose > debug.log 2>&1
```

### 설정 정보 (민감한 정보 제외)

```bash
# 설정 구조 확인 (민감한 정보는 마스킹됨)
taptik config show --masked
```

## 자주 묻는 질문 (FAQ)

### Q: 배포 후 Cursor IDE에서 설정이 적용되지 않아요

**A**: Cursor IDE를 완전히 재시작해보세요. 일부 설정은 재시작 후에 적용됩니다.

### Q: 기존 Cursor 설정을 잃어버릴까 걱정돼요

**A**: `--conflict-strategy backup` 옵션을 사용하면 기존 설정이 자동으로 백업됩니다.

### Q: 특정 설정만 배포할 수 있나요?

**A**: 네, `--components` 옵션으로 원하는 컴포넌트만 선택할 수 있습니다.

### Q: 배포를 취소하거나 되돌릴 수 있나요?

**A**: 백업이 생성된 경우 백업 파일에서 복원할 수 있습니다. 자동 롤백 기능도 제공됩니다.

### Q: 팀에서 같은 설정을 공유하려면 어떻게 해야 하나요?

**A**: 같은 컨텍스트 ID를 사용하여 팀원들이 동일한 설정을 배포할 수 있습니다.
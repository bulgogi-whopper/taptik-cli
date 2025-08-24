---
inclusion: always
---

# Taptik Cloud Platform 확장 PRD

## 클라우드 기능 개요

Taptik 플랫폼에 Supabase 기반의 클라우드 기능을 추가하여 사용자들이 설정을 자동으로 클라우드에 업로드하고, 다른 사용자들의 설정을 검색하고 가져올 수 있는 커뮤니티 기능을 제공합니다.

## 새로운 기능 요구사항

### 1. 사용자 인증 및 계정 관리

#### 1.1 Supabase Auth 통합

- **이메일/패스워드 인증**: 기본 회원가입 및 로그인
- **OAuth 지원**: GitHub, Google 계정으로 로그인
- **익명 사용자 지원**: 로그인 없이 공개 설정 다운로드 가능
- **프로필 관리**: 사용자명, 아바타, 소개 설정

#### 1.2 사용자 프로필 구조

```sql
-- 사용자 프로필 테이블
CREATE TABLE profiles (
    id uuid references auth.users not null primary key,
    username text unique not null,
    full_name text,
    avatar_url text,
    bio text,
    website text,
    github_username text,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);
```

### 2. 클라우드 설정 저장소

#### 2.1 Supabase Storage 구조

```
taptik-configs/ (Bucket)
├── public/                 # 공개 설정들
│   ├── claude-code/
│   ├── kiro-ide/
│   └── cursor-ide/
└── private/                # 비공개 설정들
    ├── user_uuid/
    │   ├── claude-code/
    │   ├── kiro-ide/
    │   └── cursor-ide/
```

#### 2.2 설정 메타데이터 테이블

```sql
-- 설정 패키지 메타데이터
CREATE TABLE config_packages (
    id uuid default uuid_generate_v4() primary key,
    user_id uuid references auth.users not null,
    title text not null,
    description text,
    source_ide text not null, -- 'claude-code', 'kiro-ide', 'cursor-ide'
    target_ides text[] not null,
    tags text[],
    is_public boolean default false,
    file_path text not null, -- Storage 파일 경로
    file_size bigint,
    download_count integer default 0,
    like_count integer default 0,
    version text default '1.0.0',
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);

-- 설정 좋아요 테이블
CREATE TABLE config_likes (
    id uuid default uuid_generate_v4() primary key,
    user_id uuid references auth.users not null,
    config_id uuid references config_packages not null,
    created_at timestamp with time zone default now(),
    unique(user_id, config_id)
);

-- 설정 다운로드 로그
CREATE TABLE config_downloads (
    id uuid default uuid_generate_v4() primary key,
    user_id uuid references auth.users,
    config_id uuid references config_packages not null,
    downloaded_at timestamp with time zone default now()
);
```

### 3. 확장된 CLI 명령어

#### 3.1 인증 관련 명령어

```bash
# 로그인
taptik auth login
taptik auth login --provider=github
taptik auth logout

# 사용자 정보
taptik auth whoami
taptik auth profile --update
```

#### 3.2 클라우드 업로드/다운로드 명령어

```bash
# 클라우드로 업로드 (export와 동시에)
taptik export --ide=claude-code --upload --public
taptik export --ide=claude-code --upload --private --title="My Dev Setup"

# 수동 업로드
taptik upload my-settings.taptik --public --title="Team Standard" --tags=team,frontend

# 클라우드에서 검색
taptik search --ide=claude-code --tags=frontend
taptik search --user=johndoe --ide=kiro-ide

# 클라우드에서 다운로드
taptik download <config-id> --output=downloaded-config.taptik
taptik install <config-id> --target=kiro-ide

# 즐겨찾기
taptik like <config-id>
taptik unlike <config-id>
taptik list liked
```

#### 3.3 커뮤니티 명령어

```bash
# 인기 설정 조회
taptik trending --ide=claude-code --period=week
taptik featured

# 사용자 팔로우 (선택사항)
taptik follow @username
taptik unfollow @username
taptik followers
taptik following
```

### 4. 웹 인터페이스 설계

#### 4.1 주요 페이지 구조

```
https://taptik.dev/
├── /                       # 랜딩 페이지
├── /explore               # 설정 탐색 페이지
├── /search               # 검색 페이지
├── /config/:id          # 설정 상세 페이지
├── /user/:username      # 사용자 프로필
├── /dashboard          # 내 설정 관리
├── /upload             # 설정 업로드
└── /docs              # 문서 페이지
```

#### 4.2 핵심 UI 컴포넌트

- **설정 카드**: 썸네일, 제목, 설명, 태그, 통계
- **검색 필터**: IDE별, 태그별, 인기도별 필터링
- **미리보기 모달**: 설정 내용 미리보기
- **댓글 시스템**: 설정에 대한 피드백 (Phase 3)
- **평점 시스템**: 5점 만점 평가 (Phase 3)

### 5. 보안 및 프라이버시

#### 5.1 Row Level Security 정책

```sql
-- 프로필 RLS 정책
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "프로필은 모든 사용자가 조회 가능" ON profiles
    FOR SELECT USING (true);

CREATE POLICY "사용자는 자신의 프로필만 수정 가능" ON profiles
    FOR ALL USING (auth.uid() = id);

-- 설정 패키지 RLS 정책
ALTER TABLE config_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "공개 설정은 모든 사용자가 조회 가능" ON config_packages
    FOR SELECT USING (is_public = true);

CREATE POLICY "사용자는 자신의 모든 설정 조회 가능" ON config_packages
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "사용자는 자신의 설정만 관리 가능" ON config_packages
    FOR ALL USING (auth.uid() = user_id);
```

#### 5.2 민감한 정보 필터링

- **API 키 마스킹**: 업로드 시 자동으로 민감한 정보 제거
- **화이트리스트 기반**: 안전한 설정만 공유 허용
- **사용자 동의**: 업로드 전 민감한 정보에 대한 경고

### 6. 자동 업로드 설정

#### 6.1 설정 파일

```yaml
# ~/.taptik/config.yaml
cloud:
  enabled: true
  auto_upload: true
  default_visibility: private # private, public
  auto_tags:
    - 'auto-backup'
    - 'personal'

upload_filters:
  exclude_patterns:
    - '*.key'
    - '*token*'
    - '*secret*'
    - '*password*'

notifications:
  upload_success: true
  download_available: true
```

#### 6.2 자동 업로드 로직

```bash
# export 시 자동 클라우드 업로드
taptik export --ide=claude-code --output=backup.taptik
# → 자동으로 클라우드에 업로드됨 (설정에 따라)

# 업로드 확인 메시지
"✓ 설정이 성공적으로 추출되었습니다: backup.taptik"
"🌥️  클라우드에 자동 업로드되었습니다 (비공개)"
"🔗 공유 링크: https://taptik.dev/config/abc-123"
```

### 7. API 엔드포인트 설계

#### 7.1 RESTful API 구조

```
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/profile

POST /api/configs              # 설정 업로드
GET  /api/configs              # 설정 목록 (필터링 지원)
GET  /api/configs/:id          # 특정 설정 조회
PUT  /api/configs/:id          # 설정 정보 수정
DELETE /api/configs/:id        # 설정 삭제

POST /api/configs/:id/like     # 좋아요
DELETE /api/configs/:id/like   # 좋아요 취소
POST /api/configs/:id/download # 다운로드 (통계용)

GET  /api/search               # 설정 검색
GET  /api/trending             # 인기 설정
GET  /api/users/:username      # 사용자 프로필 조회
```

### 8. Supabase Edge Functions

#### 8.1 설정 업로드 전처리

```javascript
// functions/upload-config/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  // 파일 업로드 시 민감한 정보 필터링
  // 썸네일 생성
  // 메타데이터 추출
  // 바이러스 검사 (선택사항)
});
```

#### 8.2 검색 및 추천 시스템

```javascript
// functions/search-configs/index.ts
serve(async (req) => {
  // 전문 검색 (Full-text search)
  // 태그 기반 필터링
  // 인기도/관련성 점수 계산
  // 개인화된 추천 (Phase 3)
});
```

### 9. 새로운 사용자 워크플로우

#### 9.1 설정 공유 워크플로우

1. **로그인**: `taptik auth login`
2. **설정 추출 및 업로드**: `taptik export --ide=claude-code --upload --public --title="Frontend Setup"`
3. **웹에서 확인**: 업로드된 설정을 웹에서 관리
4. **공유**: URL이나 설정 ID로 다른 사용자와 공유

#### 9.2 설정 발견 및 적용 워크플로우

1. **검색**: `taptik search --ide=claude-code --tags=frontend`
2. **미리보기**: 웹 또는 CLI에서 설정 내용 확인
3. **다운로드**: `taptik install <config-id> --target=kiro-ide`
4. **피드백**: 웹에서 좋아요나 댓글 남기기

### 10. 성능 및 확장성

#### 10.1 CDN 및 캐싱

- **Supabase CDN**: 전 세계 285개 도시에서 파일 서빙
- **이미지 최적화**: 자동 썸네일 생성 및 압축
- **메타데이터 캐싱**: Redis를 통한 검색 결과 캐싱

#### 10.2 파일 크기 제한

- **무료 사용자**: 패키지당 최대 50MB
- **프리미엄 사용자**: 패키지당 최대 500MB (향후)
- **압축 최적화**: 자동 압축으로 파일 크기 최소화

### 11. 개발 단계별 계획 업데이트

#### Phase 1.5 - 클라우드 기본 기능 (3-4주)

- Supabase 프로젝트 설정 및 인증 구현
- 기본 업로드/다운로드 CLI 명령어
- 간단한 웹 검색 인터페이스
- RLS 정책 및 보안 설정

#### Phase 2.5 - 커뮤니티 기능 (2-3주)

- 고급 검색 및 필터링
- 좋아요 및 통계 기능
- 사용자 프로필 페이지
- 자동 업로드 옵션

#### Phase 3.5 - 소셜 기능 (4-5주)

- 댓글 및 평점 시스템
- 팔로우/팔로워 기능
- 개인화된 추천 알고리즘
- 알림 시스템

### 12. 비즈니스 모델 고려사항

#### 12.1 프리미엄 기능 (향후)

- **무제한 저장 공간**: 프리미엄 사용자
- **팀 콜라보레이션**: 팀 내 설정 공유 및 관리
- **우선 지원**: 빠른 고객 지원
- **고급 분석**: 설정 사용 통계 및 인사이트

#### 12.2 API 사용량 제한

- **무료 사용자**: 월 1,000회 API 호출
- **등록 사용자**: 월 10,000회 API 호출
- **프리미엄**: 무제한 API 호출

이 확장된 PRD를 통해 Taptik은 단순한 설정 마이그레이션 도구를 넘어서 IDE 설정을 공유하고 발견할 수 있는 커뮤니티 플랫폼으로 발전할 수 있습니다.

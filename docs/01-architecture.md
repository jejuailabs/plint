# 01. 시스템 아키텍처

## 1. 전체 구조도 (텍스트)

```
[사용자 브라우저]
      │
      ▼
[OpenAI Sites / Cloudflare — Vinext App Router]
   ├─ (marketing) 랜딩페이지 — 정적/ISR
   ├─ (dashboard) 로그인 사용자 영역 — SSR
   ├─ (admin) 어드민 — SSR + role 가드
   └─ /api/*  Route Handlers
      │
      ├──▶ [Supabase]
      │      ├─ Auth (Google OAuth)
      │      ├─ Postgres (사용자/구독/분석결과/결제/API로그/공지)
      │      ├─ Storage (매스모델 썸네일, PDF 리포트)
      │      └─ Row Level Security
      │
      ├──▶ [요청 시 외부 API] (주소, 건축HUB, 실거래, 기상 등)
      ├──▶ [Supabase PostGIS 공간 웨어하우스] (지적, 용도지역, 건물, 도로, DEM, 위험지도)
      │
      ├──▶ [SketchUp MCP 서버] — 3D 매스모델 생성 (별도 프로세스/서버)
      │
      ├──▶ [Claude API + MCP 레이어] — 자연어 질의 → 파이프라인 실행
      │
      └──▶ [포트원(PortOne) V2] — 결제/구독 웹훅
```

## 2. 배포 환경

| 환경 | 브랜치 | 용도 |
|---|---|---|
| Production | `main` | OpenAI Sites 실서비스 배포 |
| Staging | `develop` | QA용 별도 Site/Supabase 프로젝트 |
| Preview | 기타 작업 브랜치 | 로컬/프리뷰 검증 |

- Site와 Supabase 프로젝트는 Prod/Staging 분리 운영을 원칙으로 한다. 초기에는 단일 Supabase 프로젝트로 시작할 수 있으나 환경별 키와 데이터는 혼합하지 않는다.
- SketchUp MCP와 대용량 공간 ETL은 Cloudflare 요청 수명 안에서 구동하지 않는다. 별도 워커/VM에서 처리하고 앱은 HTTP 작업 계약으로 호출한다.

## 3. 환경변수 (.env.example 기준)

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=                # 서버 전용, 절대 클라이언트 노출 금지

# Google OAuth (Supabase Auth 설정에 등록, 앱 코드에서는 별도 키 불필요)
# → Supabase 대시보드 > Authentication > Providers > Google 에서 설정

# 공공데이터 API
VWORLD_API_KEY=
MOLIT_API_KEY=            # 국토교통부 (건축물대장/실거래가/공시지가 공통 또는 개별)
KMA_API_KEY=               # 기상청
JUSO_API_KEY=               # 도로명주소

# SketchUp MCP
SKETCHUP_MCP_ENDPOINT=
SKETCHUP_MCP_API_KEY=

# Claude API
ANTHROPIC_API_KEY=

# 포트원(PortOne)
PORTONE_STORE_ID=
PORTONE_CHANNEL_KEY=
PORTONE_API_SECRET=
PORTONE_WEBHOOK_SECRET=

# 앱 공통
NEXT_PUBLIC_APP_URL=
```

## 4. 인증 흐름 요약

1. 사용자가 "구글로 로그인" 클릭 → Supabase Auth `signInWithOAuth({ provider: 'google' })`
2. Supabase가 Google OAuth 처리 후 세션 발급, `/auth/callback` 라우트로 리다이렉트
3. 콜백 라우트에서 세션 확인 → `public.users` 테이블에 최초 로그인 시 row 생성(트리거 또는 콜백 코드)
4. 이후 요청은 Supabase 세션 쿠키 기반, 서버 컴포넌트에서 `createServerClient`로 세션 확인
5. `role` 컬럼(`user` / `admin`)에 따라 `(admin)` 라우트 그룹 접근 제어 (미들웨어에서 1차 가드, 서버 컴포넌트에서 2차 검증)

세부 스펙은 `03-auth-admin.md` 참조.

## 5. 데이터 흐름 — 분석 요청 1건의 라이프사이클

1. 사용자가 대시보드에서 지번 입력 → `/api/analysis` POST
2. 서버에서 사용자 구독 플랜의 잔여 크레딧/한도 확인 (`02-database-schema.md`의 `usage_logs`, `subscriptions` 참조)
3. 요청 시 API와 내부 공간 웨어하우스를 결합해 Phase 1~4 파이프라인 실행 (`05-core-pipeline.md`)
4. 각 단계 결과를 `analyses` 테이블에 단계별로 저장 (진행상황 폴링 또는 SSE로 프론트에 전달)
5. 완료 시 `analyses.status = 'completed'`, 결과 요약을 대시보드에 렌더링, PDF 리포트는 Supabase Storage에 저장 후 signed URL 제공
6. `usage_logs`에 API 호출/비용 기록 → 어드민 모니터링에 반영

## 6. 결정 필요 항목 (Open Questions)

아래 항목은 이번 스펙에서 인터페이스만 정의하고, 실제 값/선택은 개발 착수 전 사용자 확인이 필요하다.

- SketchUp MCP 서버의 실제 호스팅 방식(자체 VM vs 사용자가 이미 운영 중인 서버)
- 공공데이터 API 각각의 실제 신청/승인 상태 및 키 발급 완료 여부
- Staging용 별도 Supabase 프로젝트 사용 여부

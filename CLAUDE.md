# CLAUDE.md — 지번 기반 건축 사전검토 자동화 플랫폼

이 문서는 Claude Code가 이 저장소에서 작업할 때 항상 먼저 읽어야 하는 최상위 가이드다.
세부 스펙은 `/docs` 폴더의 문서를 참조한다. 작업 종류에 따라 관련 문서를 반드시 열어보고 시작할 것.

## 0. 문서 지도 (Document Map)

| 문서 | 내용 | 언제 참조하나 |
|---|---|---|
| `docs/01-architecture.md` | 전체 시스템 구조, 기술 스택, 배포 구조 | 신규 기능 설계, 폴더 구조 판단 시 |
| `docs/02-database-schema.md` | Supabase 테이블 스키마, RLS 정책 | DB 관련 작업 전 항상 |
| `docs/03-auth-admin.md` | 구글 로그인, 권한 체계, 어드민 페이지 스펙 | 인증/어드민 화면 작업 시 |
| `docs/04-landing-page.md` | 랜딩페이지 섹션 구성, 카피, 컴포넌트 | 랜딩페이지 작업 시 |
| `docs/05-core-pipeline.md` | 4단계 분석 파이프라인(대지수집~사업성분석), 공공API, MCP 연동 | 핵심 기능(분석 엔진) 작업 시 |
| `docs/06-payment-billing.md` | 포트원(아임포트) 결제/구독 연동 | 결제 관련 작업 시 |
| `docs/07-api-routes.md` | 내부 API 라우트 명세 (REST) | API 엔드포인트 신규 작성/수정 시 |
| `docs/08-open-api-product-expansion.md` | 공공 API 전수검토, 추가 데이터와 Parcel Intelligence 확장 설계 | 외부 데이터 연동·ETL·제품 범위 결정 시 |
| `docs/09-implementation-handoff.md` | 현재 구현 상태, 불변 계약, 다음 개발 순서와 완료 기준 | 새 작업 시작 및 모델 인수인계 시 항상 |

원본 사업 기획안: `docs/00-business-plan.md` (참고용). 외부 데이터·제품 모델이 충돌하면 `docs/08-open-api-product-expansion.md`를 우선한다.

## 1. 프로젝트 개요

주소 하나를 필지 단위의 데이터·법규·시장·위험·3D 시나리오로 변환하고 의사결정 문서와 설계 파일까지 생성하는 개발검토 SaaS다. 20개 이상의 데이터 원천을 7개 인텔리전스 모듈로 통합하며, 모든 결과는 출처·기준일·계산 근거·신뢰도를 추적할 수 있어야 한다.

타깃: 건축주/디벨로퍼, 소규모 건축사사무소(1~5인), 부동산·투자 플랫폼(B2B API).

## 2. 기술 스택 (고정값 — 임의 변경 금지)

- **프론트엔드/백엔드**: Vinext 1(App Router 호환) + React 19 + TypeScript 5.9
- **배포**: OpenAI Sites / Cloudflare Worker 호환 ESM
- **DB/Auth/Storage**: Supabase (PostgreSQL + Supabase Auth + Storage)
- **인증**: 구글 OAuth (Supabase Auth 소셜 로그인)
- **결제**: 포트원(PortOne, 구 아임포트) V2
- **스타일링**: Tailwind CSS + shadcn/ui
- **상태관리**: React Server Components 우선, 클라이언트 상태는 Zustand
- **폼/검증**: 작은 폼은 React state, 도메인·API 계약은 Zod
- **3D**: Three.js + React Three Fiber + Drei
- **외부 연동**: VWorld API, 국토교통부 API(건축물대장/실거래가/공시지가), 기상청 API, 도로명주소 API, SketchUp MCP 서버
- **AI/자연어 인터페이스**: Claude API (MCP 서버를 통한 공공 API 래핑)

이 스택 외의 라이브러리를 새로 도입해야 할 경우, 먼저 이유를 설명하고 사용자 확인을 받을 것.

## 3. 폴더 구조 원칙

```
/app
  /(marketing)          # 랜딩페이지 등 공개 페이지
  /(dashboard)           # 로그인 사용자 대시보드
  /(admin)                # 어드민 전용 (role=admin 가드)
  /api                    # Route Handlers
/components
  /ui                     # shadcn 기본 컴포넌트
  /marketing
  /dashboard
  /admin
/lib
  /supabase                # 클라이언트/서버 supabase 인스턴스
  /pipeline                # 4단계 분석 파이프라인 로직
  /external-apis           # VWorld, 국토부 등 API 클라이언트
  /mcp                     # SketchUp MCP, 공공데이터 MCP 연동
  /payment                 # 포트원 연동
/supabase
  /migrations              # SQL 마이그레이션
docs/                      # 본 스펙 문서 모음
```

- Server Component가 기본. `use client`는 정말 필요한 경우(폼 인터랙션, 지도, 3D 뷰어)에만.
- 외부 API 호출은 반드시 `/lib/external-apis` 안에서만 수행하고, 컴포넌트에서 직접 fetch 금지.
- 민감한 API 키(공공데이터 인증키, 포트원 시크릿, Supabase secret/service_role)는 서버 전용 환경변수로만 관리하고 클라이언트 번들에 노출 금지.
- 정적 대용량 공간데이터는 외부 API를 요청 시마다 호출하지 않고 PostGIS/래스터에 사전 적재한다. 요청 시 API, 공간 웨어하우스, 렌더/모델 경로를 분리한다.

## 4. 개발 순서 권장

각 문서의 순서를 따르는 것을 권장한다. Claude Code는 아래 순서대로 작업 단위를 쪼개어 진행할 것.

1. `01-architecture.md` 기준으로 프로젝트 초기화 + Supabase 프로젝트 연결
2. `02-database-schema.md` 기준으로 마이그레이션 작성 및 적용
3. `03-auth-admin.md` 기준으로 구글 로그인 + 권한 가드 구현
4. `04-landing-page.md` 기준으로 마케팅 페이지 구현
5. `07-api-routes.md` + `05-core-pipeline.md` 기준으로 핵심 분석 API 구현 (외부 API는 초기엔 목업 응답으로 대체 가능 — 각 문서에 명시)
6. `06-payment-billing.md` 기준으로 구독/결제 구현
7. `03-auth-admin.md`의 어드민 섹션 기준으로 어드민 페이지 구현

## 5. 코딩 컨벤션

- 완료 전 `npm run lint` / `npm run typecheck` / `npm run test` / `npm run build` 통과 필수
- 파일명: 컴포넌트는 PascalCase (`SiteAnalysisCard.tsx`), 유틸/훅은 camelCase
- 모든 Supabase 테이블 접근은 RLS를 신뢰하되, 서버 사이드에서도 사용자 소유권 검증 로직을 중복 작성 (defense in depth)
- 에러 처리: 외부 공공 API는 장애/지연이 잦다고 가정하고 항상 timeout + fallback UI 설계
- 환경변수는 `docs/01-architecture.md`의 표를 기준으로 `.env.example`에 항상 최신 상태 유지

## 6. 하지 말아야 할 것

- DB 스키마를 `02-database-schema.md`와 다르게 임의 변경 (변경 필요 시 문서부터 수정 제안)
- 결제 연동을 포트원이 아닌 다른 PG사로 임의 변경
- 실제 인허가 심의에 쓰일 수준의 정밀 일조권 계산을 구현했다고 사용자에게 오인시키는 표현 사용 (본 플랫폼은 "사전검토용"임을 UI 카피에도 항상 명시)

## 7. 모호한 부분 처리 원칙

스펙 문서에 없는 세부사항(예: 특정 화면의 정확한 문구, 색상 값 등)을 만나면, 합리적인 기본값으로 진행하고 어떤 가정을 했는지 간단히 남길 것. 단, DB 스키마 변경/과금 정책/외부 API 키 발급 방식처럼 되돌리기 어려운 결정은 진행 전 반드시 질문할 것.

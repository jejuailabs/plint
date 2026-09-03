# 07. 내부 API 라우트 명세

Next.js App Router의 Route Handlers(`/app/api/**/route.ts`) 기준. 모든 인증 필요 라우트는 Supabase 세션 쿠키로 인증하며, 별도 표기 없으면 로그인 사용자 본인 데이터만 접근 가능하다.

## 1. 인증

| Method | Path | 설명 | 인증 |
|---|---|---|---|
| GET | `/auth/callback` | Supabase OAuth 콜백 (Route Handler, 세션 교환 후 리다이렉트) | - |
| POST | `/api/auth/onboarding` | 최초 로그인 후 segment/company_name 저장 | 로그인 |

## 2. 대지 분석 (핵심 파이프라인)

| Method | Path | 설명 | 인증 |
|---|---|---|---|
| POST | `/api/sites` | 지번 입력 → `sites` row 생성 (주소 정규화 포함) | 로그인 |
| POST | `/api/analysis` | `{ site_id }` → 분석 실행 시작 (크레딧 체크 → Phase1~4 순차 실행, 비동기) | 로그인 |
| POST | `/api/analysis/preview` | `{ address }` → 저장 없이 목업/연결 가능한 원천으로 Parcel Intelligence 미리보기 | 공개(호출 제한) |
| GET | `/api/connectors` | 데이터 커넥터 카탈로그·라이선스 검토 상태 조회(인증 방식/타임아웃 제외) | 공개 |
| GET | `/api/analysis/:id` | 분석 상태/결과 조회 (폴링용) | 로그인 (본인 소유) |
| GET | `/api/analysis/:id/stream` | SSE로 Phase 진행상황 실시간 전달 (선택 구현, 없으면 폴링으로 대체 가능) | 로그인 |
| GET | `/api/analysis/:id/report` | 완료된 분석의 PDF 리포트 signed URL 발급 | 로그인 (본인 소유) |
| GET | `/api/analyses` | 본인 분석 이력 목록 (페이지네이션) | 로그인 |

### `POST /api/analysis` 요청/응답 예시
```json
// Request
{ "site_id": "uuid" }

// Response (202 Accepted — 비동기 처리 시작)
{ "analysis_id": "uuid", "status": "pending" }
```

## 3. 구독 / 결제

| Method | Path | 설명 | 인증 |
|---|---|---|---|
| GET | `/api/plans` | 활성 플랜 목록 (랜딩/가격 페이지용, 공개) | 없음 |
| POST | `/api/billing/subscribe` | 빌링키 등록 완료 후 구독 시작 처리 | 로그인 |
| POST | `/api/billing/cancel` | 구독 해지(주기말 해지 예약) | 로그인 |
| GET | `/api/billing/subscription` | 본인 현재 구독 상태 조회 | 로그인 |
| GET | `/api/billing/payments` | 본인 결제 내역 | 로그인 |
| POST | `/api/webhooks/portone` | 포트원 웹훅 수신 | 웹훅 서명 검증 (service_role) |

## 4. 콘텐츠 (공개)

| Method | Path | 설명 | 인증 |
|---|---|---|---|
| GET | `/api/notices` | 게시된 공지사항 목록 | 없음 |
| GET | `/api/faqs` | 게시된 FAQ 목록 | 없음 |

## 5. 어드민 전용

모든 `/api/admin/**`는 `role='admin'` 검증을 서버에서 별도로 재확인한다 (미들웨어 통과와 별개로 방어적으로 재검증).

| Method | Path | 설명 |
|---|---|---|
| GET | `/api/admin/overview` | 대시보드 개요 집계 데이터 |
| GET | `/api/admin/users` | 사용자 목록(검색/필터/페이지네이션) |
| GET | `/api/admin/users/:id` | 사용자 상세(구독/결제/분석 이력 포함) |
| GET | `/api/admin/subscriptions` | 구독 현황 목록 |
| GET | `/api/admin/payments` | 결제 내역 목록 |
| GET | `/api/admin/usage` | provider별 사용량/비용/에러율 집계 |
| GET | `/api/admin/usage/health` | `api_provider_status` 조회 |
| GET/POST | `/api/admin/notices`, `/api/admin/notices/:id` | 공지사항 CRUD |
| GET/POST | `/api/admin/faqs`, `/api/admin/faqs/:id` | FAQ CRUD |

## 6. B2B API (Segment C, 추후 확장 — 이번 스펙에서는 인터페이스만 정의)

| Method | Path | 설명 |
|---|---|---|
| POST | `/api/v1/external/analysis` | API Key 인증 기반 외부 플랫폼용 분석 요청 (건당 과금) |

API Key 발급/관리 체계는 이번 스펙 범위 밖이며, 추후 별도 문서로 확장한다.

## 7. 공통 응답 규격

- 성공: `{ data: ... }`
- 실패: `{ error: { code: "string", message: "string" } }`, 적절한 HTTP status 코드 사용 (400/401/403/404/409/500)
- 목록 조회는 `{ data: [...], pagination: { page, pageSize, total } }` 형태 통일
- 분석 응답은 `meta: { requestId, generatedAt, mode, coverage }`를 포함하고 각 사실에는 원천·기준일·신뢰도를 연결한다.

## 8. 결정 필요 항목

- SSE(`/api/analysis/:id/stream`) 구현 여부 — Vercel 서버리스 환경에서의 장시간 연결 제약을 고려해 초기엔 폴링(2~3초 간격)만 구현하고 SSE는 선택적으로 추가하는 것을 권장

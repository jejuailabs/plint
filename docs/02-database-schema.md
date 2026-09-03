# 02. Supabase 데이터베이스 스키마

Claude Code는 이 문서를 기준으로 `/supabase/migrations`에 SQL 마이그레이션 파일을 순서대로 생성한다.
모든 테이블은 기본적으로 RLS(Row Level Security)를 활성화한다.

## 1. ERD 요약 (텍스트)

```
users ──< subscriptions ──< payments
  │
  ├──< sites ──< analyses ──< analysis_reports
  │
  └──< usage_logs

plans (마스터 데이터, 관리자만 수정)
notices / faqs (콘텐츠, 관리자 CRUD)
api_provider_status (외부 공공API 상태 모니터링)
connector_registry (원천별 프로토콜/쿼터/라이선스)
raw_snapshots (수집 원문과 기준일)
derived_facts (계산값과 근거 계보)
analysis_artifacts (PDF/XLSX/GLB/SKP/GeoJSON 산출물)
```

## 2. 테이블 정의

### 2.1 `users` (Supabase Auth 확장)
Supabase Auth의 `auth.users`와 1:1로 연결되는 프로필 테이블.

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid, PK, references auth.users(id) | |
| email | text | |
| display_name | text | |
| avatar_url | text | 구글 프로필 사진 |
| role | text, default 'user' | `'user'` \| `'admin'` |
| company_name | text, nullable | 건축사사무소/디벨로퍼명 |
| segment | text, nullable | `'owner'`(건축주) \| `'architect'`(건축사) \| `'platform'`(부동산플랫폼) |
| created_at | timestamptz, default now() | |
| last_login_at | timestamptz | |

RLS: 본인 row만 select/update, admin은 전체 select.

트리거: `auth.users` insert 시 `public.users`에 자동 row 생성 (Postgres function + trigger).

### 2.2 `plans` (구독 플랜 마스터)

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid, PK | |
| code | text, unique | `'basic'`, `'pro'`, `'api'` 등 |
| name | text | 표시명 |
| price_monthly | integer | 원 단위 |
| monthly_credit | integer | 월 제공 분석 크레딧(건수) |
| target_segment | text | Segment A/B/C 매핑 |
| features | jsonb | 기능 플래그 목록 |
| is_active | boolean, default true | |

RLS: 전체 공개 select(랜딩페이지 요금표 노출), 쓰기는 admin만.

### 2.3 `subscriptions`

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid, PK | |
| user_id | uuid, FK → users.id | |
| plan_id | uuid, FK → plans.id | |
| status | text | `'active'` \| `'past_due'` \| `'canceled'` \| `'trialing'` |
| portone_billing_key | text, nullable | 포트원 정기결제용 빌링키 |
| current_period_start | timestamptz | |
| current_period_end | timestamptz | |
| remaining_credit | integer | 이번 주기 잔여 분석 크레딧 |
| cancel_at_period_end | boolean, default false | |
| created_at | timestamptz, default now() | |

RLS: 본인 것만 select, insert/update는 서버(service_role) 또는 webhook 핸들러만.

### 2.4 `payments`

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid, PK | |
| user_id | uuid, FK | |
| subscription_id | uuid, FK, nullable | |
| portone_payment_id | text, unique | 포트원 결제 고유번호 |
| amount | integer | |
| status | text | `'paid'` \| `'failed'` \| `'canceled'` \| `'refunded'` |
| pg_provider | text, default 'portone' | |
| raw_payload | jsonb | 웹훅 원본(디버깅용) |
| paid_at | timestamptz, nullable | |
| created_at | timestamptz, default now() | |

RLS: 본인 것만 select, admin 전체 select. insert/update는 webhook 핸들러(service_role)만.

### 2.5 `sites` (분석 대상 대지)

지번 입력 시점의 기초 식별 정보. 동일 지번을 여러 번 분석할 수 있으므로 `sites`와 `analyses`를 분리한다.

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid, PK | |
| user_id | uuid, FK | |
| jibun_address | text | 지번 주소 원문 (예: "서울시 강남구 역삼동 123-4") |
| road_address | text, nullable | 도로명주소 변환 결과 |
| pnu_code | text, nullable | 필지고유번호(공공API 표준 키) |
| latitude | double precision, nullable | |
| longitude | double precision, nullable | |
| created_at | timestamptz, default now() | |

RLS: 본인 것만.

### 2.6 `analyses` (분석 실행 1건)

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid, PK | |
| site_id | uuid, FK → sites.id | |
| user_id | uuid, FK | |
| status | text | `'pending'` \| `'phase1'` \| `'phase2'` \| `'phase3'` \| `'phase4'` \| `'completed'` \| `'failed'` |
| phase1_result | jsonb, nullable | 대지정보 통합 객체 (`05-core-pipeline.md` 스키마 참조) |
| phase2_result | jsonb, nullable | 법규검토 결과 |
| phase3_result | jsonb, nullable | 매스모델 메타(모델 파일 URL, 썸네일 등) |
| phase4_result | jsonb, nullable | 사업성분석 결과 |
| error_message | text, nullable | |
| started_at | timestamptz | |
| completed_at | timestamptz, nullable | |
| created_at | timestamptz, default now() | |

RLS: 본인 것만 select, admin 전체 select(모니터링용). insert/update는 본인 or 서버.

### 2.7 `analysis_reports`

완료된 분석의 PDF 리포트 산출물 메타데이터.

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid, PK | |
| analysis_id | uuid, FK → analyses.id | |
| storage_path | text | Supabase Storage 경로 |
| file_size_bytes | integer, nullable | |
| created_at | timestamptz, default now() | |

RLS: 본인 analysis에 연결된 것만 select.

### 2.8 `usage_logs` (API 사용량 · 비용 로그 — 어드민 모니터링용)

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid, PK | |
| user_id | uuid, FK, nullable | |
| analysis_id | uuid, FK, nullable | |
| provider | text | `'vworld'`, `'molit_building'`, `'molit_price'`, `'kma'`, `'juso'`, `'sketchup_mcp'`, `'claude_api'`, `'portone'` 등 |
| endpoint | text | 호출 엔드포인트 요약 |
| request_count | integer, default 1 | |
| response_time_ms | integer, nullable | |
| cost_krw | numeric(10,2), nullable | 추정 비용(원) — 소스별 단가표는 어드민에서 설정 가능(추후) |
| status_code | integer, nullable | |
| created_at | timestamptz, default now() | |

RLS: admin만 select 가능, insert는 서버(service_role)만.

### 2.9 `api_provider_status` (외부 API 헬스체크)

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid, PK | |
| provider | text, unique | |
| is_healthy | boolean, default true | |
| last_checked_at | timestamptz | |
| last_error | text, nullable | |

RLS: admin만 select/update.

### 2.10 `notices` (공지사항)

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid, PK | |
| title | text | |
| content | text (markdown) | |
| is_published | boolean, default false | |
| published_at | timestamptz, nullable | |
| created_by | uuid, FK → users.id | |
| created_at | timestamptz, default now() | |
| updated_at | timestamptz, default now() | |

RLS: 공개 select는 `is_published = true`인 것만, 전체 CRUD는 admin.

### 2.11 `faqs`

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid, PK | |
| category | text | `'요금'`, `'사용법'`, `'데이터'` 등 |
| question | text | |
| answer | text (markdown) | |
| display_order | integer, default 0 | |
| is_published | boolean, default true | |
| created_at | timestamptz, default now() | |

RLS: 공개 select(published만), CRUD는 admin.

## 2.12 근거·커넥터 확장 테이블

`08-open-api-product-expansion.md`의 `Evidence`, `Fact<T>`, `ParcelIntelligence`를 영속화한다.

- `connector_registry`: dataset_id, protocol, update_cycle, license_code, commercial_use, derivative_use, health 상태
- `raw_snapshots`: provider, dataset_id, source_key(PNU 등), payload/json 또는 storage_path, observed_at, effective_at, content_hash
- `derived_facts`: analysis_id, fact_path, value_json, confidence, derivation_rule, evidence_snapshot_ids
- `analysis_artifacts`: analysis_id, kind(`pdf|xlsx|glb|skp|geojson|json`), storage_path, generation_options, created_at

모든 사용자 소유 결과 테이블은 `user_id` 또는 소유 분석으로 연결하고 RLS를 적용한다. 원천 공용 캐시는 클라이언트에 직접 노출하지 않고 서버 전용 스키마로 둔다.

## 3. 인덱스 권장

- `analyses(user_id, created_at desc)`
- `analyses(status)` — 어드민 모니터링 필터용
- `usage_logs(provider, created_at desc)`
- `usage_logs(created_at desc)` — 비용 집계 쿼리용
- `payments(user_id, created_at desc)`
- `raw_snapshots(dataset_id, source_key, effective_at desc)`
- `derived_facts(analysis_id, fact_path)`

## 4. 마이그레이션 파일 순서 (권장)

1. `0001_users_and_trigger.sql`
2. `0002_plans_subscriptions_payments.sql`
3. `0003_sites_analyses_reports.sql`
4. `0004_usage_logs_provider_status.sql`
5. `0005_notices_faqs.sql`
6. `0006_rls_policies.sql` (또는 각 파일 내에서 테이블 생성과 함께 RLS도 정의 — Claude Code 판단에 맡김)

## 5. 결정 필요 항목

- `usage_logs.cost_krw` 산정 방식(공공API는 대부분 무료이나 SketchUp MCP/Claude API 비용을 어떤 단가로 환산할지)은 실제 계약 단가 확정 후 어드민에서 설정 가능하도록 `provider_pricing`이라는 별도 설정 테이블을 추가할지 여부 — 초기엔 하드코딩 상수로 시작해도 무방.

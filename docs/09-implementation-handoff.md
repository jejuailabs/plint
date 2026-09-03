# 09. 구현 인수인계 가이드

이 문서는 2026-09-03 기준 실제 코드와 다음 개발 단계 사이의 계약이다. 이후 작업자는 `CLAUDE.md`와 이 문서를 먼저 읽고, 이미 확정된 도메인 경계를 보존한다.

## 1. 현재 동작하는 범위

- Vinext/React/TypeScript 기반 공개 랜딩페이지와 Three.js 필지 매스 뷰어
- 주소 입력 → `POST /api/analysis/preview` → 분석 워크스페이스 전체 흐름
- 필지·계획·기존 건축물·시장·수요·기후·위험의 `ParcelIntelligence` 도메인 계약
- 수익형/균형형/품질형 3개 개발 시나리오와 3D 선택 연동
- `Evidence`, `Fact<T>`, confidence, 기준일, 추정/누락 상태를 포함한 데이터 계보
- 11개 공공데이터 커넥터 매니페스트와 공개 카탈로그 API
- 공개 랜딩을 유지하는 Google OAuth 로그인, 최초 사용자 온보딩, 로그인 사용자 대시보드 진입
- 초기 Supabase/PostGIS 마이그레이션, 명시적 grants/RLS, pgTAP 정책 테스트
- 타입 검사, 단위 테스트, 린트, 프로덕션 빌드 명령

현재 외부 데이터는 결정론적 mock provider가 반환한다. 이것은 UI용 임시 JSON이 아니라 실제 커넥터가 동일한 도메인 결과를 반환하도록 만든 교체 지점이다.

## 2. 절대 깨지 말아야 할 계약

1. 화면 컴포넌트에서 공공 API를 직접 호출하지 않는다. 모든 외부 호출은 `lib/external-apis` 아래 커넥터를 통과한다.
2. 외부 API 응답 원문을 곧바로 사업 판단값으로 사용하지 않는다. raw snapshot → normalized fact → scenario 순서를 지킨다.
3. 수치·규제·위험 사실은 가능한 한 `Fact<T>`로 표현하고 evidence, confidence, effectiveAt을 유지한다.
4. `unknown`을 안전 또는 0으로 변환하지 않는다. 누락은 사용자에게 명시하고 coverage에 반영한다.
5. 법정 상한과 시나리오 가정값을 분리한다. 현재 계산기는 상한을 넘지 않는 것을 테스트한다.
6. Supabase secret key와 공공 API 키는 서버에서만 읽는다. `NEXT_PUBLIC_` 접두사는 공개 키에만 사용한다.
7. 사용자 데이터 테이블은 RLS와 서버 소유권 검사를 함께 적용한다. 관리자 판정은 `app_metadata.role`만 신뢰한다.
8. 결과는 인허가 확정값이 아니라 사전검토용이라는 문구를 유지한다.

## 3. 다음 개발 순서

### P0 — 실제 데이터 한 줄을 끝까지 연결

1. 도로명주소 검색/좌표 변환 커넥터를 구현한다.
2. PNU를 정규화하고 연속지적도 또는 토지특성 한 원천을 연결한다.
3. 응답 원문을 `private.raw_snapshots`에 저장하고 content hash로 중복 제거한다.
4. 정규화한 사실을 `derived_facts`에 저장한 뒤 기존 preview 응답 형식으로 반환한다.
5. timeout, 재시도, 쿼터 초과, 라이선스 검토 상태를 테스트한다.

### P1 — 로그인 사용자 프로젝트 저장

1. 환경변수와 Google provider를 설정하고 OAuth callback을 실제 프로젝트에서 검증한다. 랜딩(`/`)은 공개 상태를 유지한다.
2. `/api/sites`, `/api/analysis`, `/api/analyses`를 구현한다.
3. 모든 route에서 `getClaims()` 기반 사용자 확인과 명시적 소유권 검사를 추가한다.
4. 분석 상태를 pending → phase1~4 → completed/failed로 전이한다.

### P2 — 산출물과 운영

1. PDF/XLSX/GeoJSON 산출물 생성과 Storage signed URL을 구현한다.
2. 커넥터 health, latency, quota, 비용을 운영 화면에 노출한다.
3. 라이선스가 `review` 또는 `restricted`인 원천은 법무/기관 확인 전 유료 결과물에 포함하지 않는다.
4. 지역별 조례 규칙은 버전·시행일·관할을 가진 별도 rule pack으로 추가한다.

## 4. 완료 기준

작업 단위마다 아래를 모두 통과해야 한다.

```bash
npm run typecheck
npm run test
npm run lint
npm run build
```

DB 변경은 추가로 `npx supabase test db`를 통과해야 한다. 로컬 테스트에는 Docker 또는 호환 컨테이너 런타임이 필요하다.

## 5. 현재 확인된 제약

- 개발 머신에 Docker/Podman이 없어 로컬 Supabase 기동과 pgTAP 실행은 아직 검증하지 못했다. SQL 파일은 생성·정적 검토됐지만 실제 DB 적용은 연결된 Supabase 프로젝트 또는 Docker 환경에서 확인해야 한다.
- 실제 공공 API 키와 Supabase 환경변수가 비어 있어 공개 데모는 mock 모드로 동작한다.
- Three.js 번들은 의도적으로 클라이언트 지연 로딩하지만 자체 크기가 크다. 저사양 기기에서는 WebGL 미지원/감소 모션 대체 화면을 후속 추가한다.
- Vinext의 route 정적 분류 경고는 현재 빌드 도구 제한이며 API 실행 실패를 뜻하지 않는다.

## 6. 하위 모델에 맡겨도 되는 작업

이 문서의 계약을 바꾸지 않는 범위라면 다음은 하위 모델로 진행해도 된다.

- 개별 커넥터 HTTP 클라이언트와 fixture 작성
- 대시보드 CRUD 화면, loading/empty/error 상태 구현
- 보고서 템플릿과 export 포맷 추가
- 지역별 rule pack 데이터 입력과 회귀 테스트
- 반응형·접근성·카피·마이크로 인터랙션 다듬기

다음은 상위 모델 또는 별도 설계 검토를 권장한다: 도메인 스키마 변경, 수익성 산식 변경, RLS/과금/웹훅, 라이선스 정책, 데이터 원천 교체, 공간 웨어하우스 구조 변경.

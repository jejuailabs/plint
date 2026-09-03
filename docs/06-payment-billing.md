# 06. 결제 & 구독 (포트원 PortOne V2)

## 1. 결제 수단 및 정책

- PG: 포트원(PortOne, 구 아임포트) V2 API 사용
- 결제 방식: 정기결제(빌링키 발급 후 매월 자동 결제) — 카드 등록 시 빌링키 발급, 이후 매 결제 주기마다 서버에서 빌링키로 결제 요청
- 건당 과금(Segment C, B2B API 콜 단위 과금)은 이번 스펙에서는 별도 정산 체계로 분리 — 초기 MVP는 구독형 정기결제(Segment A/B)만 우선 구현하고, 건당 과금은 `usage_logs` 집계 기반 후불 인보이스 방식을 추후 설계 (본 문서에서는 방향성만 명시)

## 2. 구독 가입 플로우

1. 사용자가 `/pricing` 또는 대시보드 내 "플랜 업그레이드"에서 플랜 선택
2. 포트원 결제창(SDK) 호출 → 카드 등록 + 빌링키 발급 (`IMP.requestPay` 또는 V2 SDK의 빌링키 발급 API)
3. 프론트에서 발급된 빌링키/고객식별자를 `/api/billing/subscribe` 로 전달
4. 서버에서:
   - 포트원 서버 API로 빌링키 유효성 확인
   - 첫 결제 즉시 실행 (포트원 결제 API 호출)
   - 성공 시 `subscriptions` row 생성/갱신 (`status='active'`, `current_period_start/end` 설정, `remaining_credit = plans.monthly_credit`)
   - `payments` row 기록
5. 이후 매 결제 주기는 **포트원 정기결제 스케줄러** 또는 **자체 크론(Vercel Cron)** 으로 처리 (아래 3번 참조)

## 3. 정기 결제 갱신

두 가지 방식 중 택1 — 권장은 (A):

**(A) 포트원 예약결제(스케줄) 사용**: 최초 결제 시 다음 결제일을 포트원에 예약 등록, 포트원이 자동으로 결제 실행 후 웹훅으로 결과 통지. 서버는 웹훅만 처리하면 됨.

**(B) 자체 스케줄 작업**: 별도 스케줄러가 `/api/cron/billing`을 호출해 `current_period_end`가 도래한 활성 구독을 처리한다. 플랫폼 요청 수명과 시크릿 검증을 고려해 배포 환경에 맞는 스케줄러를 선택한다.

Claude Code는 (A)를 기본으로 구현하되, 포트원 예약결제 API 스펙 확인이 필요한 경우 (B)로 폴백 가능하도록 결제 실행 로직(`/lib/payment/execute-billing.ts`)을 두 방식 모두에서 재사용 가능한 형태로 분리한다.

## 4. 웹훅 처리 (`/api/webhooks/portone`)

포트원이 결제 성공/실패/취소 이벤트를 웹훅으로 전달. 처리 절차:

1. `PORTONE_WEBHOOK_SECRET`으로 서명 검증 (필수 — 위변조 방지)
2. 이벤트 타입별 처리:
   - `payment.paid` → `payments` row upsert(status='paid'), 해당 `subscription`의 `current_period_start/end` 갱신, `remaining_credit` 리셋
   - `payment.failed` → `payments` row(status='failed'), `subscriptions.status='past_due'`로 변경, 사용자에게 결제 실패 안내(이메일/인앱 배너는 추후, 최초 버전은 상태 저장까지)
   - `payment.canceled` / 환불 → `payments.status='refunded'`, 필요 시 구독 즉시 해지 처리
3. 웹훅은 반드시 idempotent하게 처리 (동일 `portone_payment_id` 중복 수신 시 재처리하지 않도록 unique 제약 활용)

## 5. 크레딧 차감 로직

- 분석 1건 실행(Phase 1 시작 시점) 시 `subscriptions.remaining_credit`을 1 차감 (트랜잭션으로 원자적 처리)
- `remaining_credit <= 0`이면 분석 요청 자체를 막고 "이번 달 크레딧을 모두 사용했습니다. 플랜을 업그레이드하거나 다음 결제일을 기다려주세요" 안내
- 크레딧 소진 정책(이월 여부 등)은 초기엔 "이월 없음, 매 결제주기 리셋"으로 고정

## 6. 해지/환불

- `/dashboard/billing`에서 "구독 해지" 클릭 → 즉시 해지가 아닌 `cancel_at_period_end=true` 설정, 현재 결제 주기 종료 시점에 실제 `status='canceled'`로 전환 (포트원 예약결제도 함께 취소)
- 환불 정책(부분환불 등)은 포트원 관리자 콘솔에서 수동 처리하는 것을 기본으로 하고, 앱 내 셀프서비스 환불 기능은 이번 스펙 범위 밖

## 7. 화면 목록

- `/pricing` — 요금제 비교 (랜딩페이지 요금제 섹션과 동일 데이터, 로그인 사용자는 "현재 플랜" 표시)
- `/dashboard/billing` — 현재 구독 상태, 잔여 크레딧, 결제 수단(등록된 카드 정보 마스킹 표시), 결제 내역, 해지 버튼
- 결제창 자체는 포트원 SDK가 제공하는 모달/리다이렉트 UI 사용 (커스텀 카드입력 폼 자체 구현 안 함 — PCI-DSS 부담 회피)

## 8. 결정 필요 항목

- 포트원 채널(PG사: 나이스페이먼츠/토스페이먼츠 등 포트원 하위 채널) 어떤 것으로 계약할지
- Segment C(B2B API 콜당 과금) 정산 주기 및 인보이스 발행 방식 — 이번 스펙은 구조만 열어두고 상세는 추후 별도 논의
- 결제 실패 시 사용자 알림 채널(이메일 발송 도구 — 추후 필요 시 확인)

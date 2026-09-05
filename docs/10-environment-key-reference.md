# 10. 환경변수 · API 키 역할표

> 실제 키 값은 `.env.local`에만 보관한다. 이 문서와 Git에는 키 값을 절대 넣지 않는다.
> 
> `NEXT_PUBLIC_` 접두사가 붙은 값만 브라우저로 전달될 수 있다. 데이터·AI·결제·관리 키는 모두 서버에서만 읽는다.

## 한눈에 보기

| 환경변수 | 역할 키워드 | 제품에서 하는 일 |
| --- | --- | --- |
| `NEXT_PUBLIC_APP_URL` | 배포 주소 · 콜백 | 현재 서비스 주소와 OAuth 복귀 주소의 기준값 |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 연결 | 로그인·DB·Storage가 있는 Supabase 프로젝트 주소 |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | 공개 클라이언트 키 | 브라우저의 로그인 세션·공개 Supabase 연결 |
| `SUPABASE_SECRET_KEY` | 서버 관리자 키 | 서버에서만 사용자·Storage·관리 작업 수행 |
| `SUPABASE_ACCESS_TOKEN` | CLI 관리 | 배포/마이그레이션 등 개발자 도구 인증 전용 |
| `SUPABASE_DB_PASSWORD` | DB 관리 | Supabase 데이터베이스 관리 접속 전용 |

## 주소와 공간 기준점

| 환경변수 | 역할 키워드 | 분석에서 하는 일 |
| --- | --- | --- |
| `JUSO_API_KEY` | 한글 도로명 · 지번 · 건물번호 | 사용자가 입력한 주소를 공식 표준 주소로 확정 |
| `JUSO_ENGLISH_API_KEY` | 영문 주소 | 영문 보고서·해외 공유용 공식 주소 표기 |
| `JUSO_DETAIL_ADDRESS_API_KEY` | 동 · 층 · 호 · 건물명 | 집합건물/상가 호실까지 식별해 기존 건물 분석에 연결 |
| `VWORLD_API_KEY` | 지도 · 필지 · 지적도 · 용도지역 · 항공영상 | 대상지와 주변 공간을 지도·3D 화면에 중첩 |

## 건축·토지·상권·시장 데이터

| 환경변수 | 역할 키워드 | 분석에서 하는 일 |
| --- | --- | --- |
| `DATA_GO_KR_API_KEY` | 건축물대장 · 건축인허가 · 상가업소 · 주요상권 · 제주 도시정비 · 실거래 | 공공데이터포털에서 승인받은 데이터셋을 공통 호출. 같은 키라도 데이터셋별 활용신청은 별도 필요 |
| `MOLIT_API_KEY` | 국토교통부 개별 서비스 | 공공데이터포털 공통 키로 제공되지 않는 국토교통부 전용 API 대비용 |
| `REB_API_KEY` | 가격지수 · 거래량 · 부동산 시장 | 대상지 생활권의 가격·거래·시장 흐름 비교 |
| `SGIS_CONSUMER_KEY` | 인구 · 가구 · 사업체 | SGIS 통계 API의 클라이언트 식별자 |
| `SGIS_CONSUMER_SECRET` | 통계 인증 비밀값 | SGIS 토큰 발급용 비밀값. 위 키와 한 쌍으로 사용 |
| `KMA_API_KEY` | 강수 · 폭염 · 일조 · 기후 | 기후/계절성 수요와 공사·운영 리스크 보강 |

## 생성·결제·로그인 연동

| 환경변수 | 역할 키워드 | 제품에서 하는 일 |
| --- | --- | --- |
| `SKETCHUP_MCP_ENDPOINT` | SketchUp 작업 서버 | 분석 시나리오를 실제 3D 모델링 작업으로 전달 |
| `SKETCHUP_MCP_API_KEY` | 3D 작업 인증 | 외부 SketchUp 작업 서버 인증 |
| `OPENAI_API_KEY` | AI 보고서 · 설명 | 근거 데이터에 기반한 보고서 초안·요약 생성 |
| `CLAUDE_API_KEY` | Anthropic 호환 별칭 | 현재 Anthropic 키 보관용 호환 이름 |
| `ANTHROPIC_API_KEY` | Anthropic 공식 키 | Claude 기반 보고서 초안·설명 생성. 신규 코드의 우선 이름 |
| `PORTONE_STORE_ID` | 결제 상점 | 유료 보고서 판매 주체 식별 |
| `PORTONE_CHANNEL_KEY` | 결제 채널 | PG 결제수단 연결 |
| `PORTONE_API_SECRET` | 결제 서버 인증 | 결제 상태를 서버에서 안전하게 조회 |
| `PORTONE_WEBHOOK_SECRET` | 결제 위변조 검증 | 결제 완료 웹훅의 서명 검증 |
| `GOOGLE_CLIENT_ID` | Google OAuth 식별자 | Supabase Google 로그인 또는 직접 OAuth 확장 대비 |
| `GOOGLE_CLIENT_SECRET` | Google OAuth 비밀값 | Google OAuth 서버 인증. 브라우저에 노출 금지 |

## 동작 모드

| 환경변수 | 역할 키워드 | 의미 |
| --- | --- | --- |
| `USE_MOCK_EXTERNAL_API` | 목업 · 실데이터 전환 | `true`면 테스트용 목업 응답, `false`면 구현된 실제 커넥터를 사용 |

## 운영 원칙

1. 키를 화면 코드, `NEXT_PUBLIC_` 변수, 브라우저 콘솔, Git 커밋에 넣지 않는다.
2. `DATA_GO_KR_API_KEY` 하나가 있어도 건축물대장·인허가·상가업소·주요상권 등 **각 데이터셋의 활용승인**은 별도로 확인한다.
3. `JUSO`, `VWorld`, `SGIS`는 서비스 URL/허용 도메인/운영 승인이 필요한 경우가 있으므로 `https://plint.kr` 기준으로 등록한다.
4. AI는 보고서 문장을 생성할 수 있지만 법규·가격·상권 수치를 스스로 만들어 내는 원천이 아니다. 숫자는 항상 공공/공식 데이터와 출처를 함께 저장한다.
5. 실제 외부 API 값이 화면에 나타나려면 키 입력뿐 아니라 해당 커넥터와 분석 파이프라인 연결이 완료되어야 한다.

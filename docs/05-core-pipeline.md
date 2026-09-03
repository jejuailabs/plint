# 05. 핵심 분석 파이프라인 (Phase 1~4)

`00-business-plan.md`의 Solution/Data Sources 섹션을 구현 스펙으로 구체화한 문서. `/lib/pipeline` 하위에 Phase별 모듈을 분리해 구현한다.

> 외부 데이터별 현행 서비스, REST/WFS/파일 적재 구분, 라이선스와 정규 데이터 모델은 `08-open-api-product-expansion.md`를 우선 적용한다.

## 0. 공통 원칙

- 각 Phase는 독립 함수로 구현하고, 실패 시 이전 Phase 결과는 보존한 채 `analyses.status`만 `'failed'`로, `error_message`에 실패한 Phase와 원인을 기록한다.
- 외부 공공 API는 다음 원칙으로 다룬다:
  - 모든 호출에 5~10초 timeout 설정
  - 실패 시 최대 2회 재시도(exponential backoff)
  - **개발 초기 단계에서는 실제 API 키가 없을 수 있으므로, `USE_MOCK_EXTERNAL_API=true` 환경변수로 각 provider 클라이언트가 목업 데이터를 반환하도록 구현한다.** 목업 데이터 형태는 아래 각 Phase의 응답 스키마를 그대로 따를 것.
- 모든 외부 API 호출은 `usage_logs`에 기록 (`02-database-schema.md` 참조).

## 1. Phase 1 — 대지 정보 자동 수집

### 입력
- `jibun_address` (지번 주소 문자열) 또는 `pnu_code`

### 처리
1. 도로명주소 API로 지번 → PNU/좌표 변환 (`pnu_code`가 없는 경우)
2. 동적 조회가 필요한 아래 API들을 `Promise.allSettled`로 병렬 호출하고, 지적·용도지역·건물폴리곤·도로·DEM·위험지도처럼 대용량인 공간데이터는 사전 적재된 PostGIS/래스터 저장소에 질의:
   - VWorld 지적도 API → 필지 경계 폴리곤(GeoJSON), 지목, 공부면적
   - 토지이용규제정보서비스 → 용도지역명, 건폐율/용적률 법정 한도, 중첩 규제
   - 건축물대장 API → 기존 건축물 층수/구조/용도/연면적/준공연도(없으면 나대지 처리)
   - GIS건물통합정보 + 건축물대장 → 주변 건물 풋프린트/높이를 결합해 자체 LOD1 생성
   - 사전 적재 DEM 또는 토지특성정보 폴백 → 표고, 경사도 또는 정성 지형등급
   - VWorld 항공사진 → 정사영상 썸네일 URL
   - 도로중심선 + 도시계획도로 + 지적 + 토지특성 → 인접도로 폭/등급/접도 후보와 신뢰도
   - 국토부 공시지가 API → 개별공시지가, 연도별 추이
   - 국토부 실거래가 API → 반경 내 최근 실거래 목록
   - 기상청 API → 일조시간, 일사량, 풍향/풍속(연평균 또는 최근 데이터)
3. 개별 API 실패는 전체 실패로 처리하지 않고, 해당 필드를 `null` + `warnings` 배열에 기록 후 계속 진행 (일부 데이터 누락 허용, 사용자에게 명시)

### 출력 스키마 (`analyses.phase1_result`)

```json
{
  "site": {
    "pnu_code": "string",
    "jibun_address": "string",
    "road_address": "string",
    "latitude": 37.0,
    "longitude": 127.0,
    "area_sqm": 0,
    "land_category": "대지",
    "boundary_geojson": { "...": "..." }
  },
  "zoning": {
    "zone_name": "제2종일반주거지역",
    "bcr_limit": 60,
    "far_limit": 200,
    "overlapping_regulations": ["string"]
  },
  "existing_building": {
    "exists": true,
    "floors_above": 2,
    "floors_below": 0,
    "structure": "철근콘크리트",
    "usage": "단독주택",
    "total_floor_area_sqm": 0,
    "completion_year": 1995
  },
  "surroundings": {
    "nearby_buildings_3d_url": "string",
    "elevation_m": 0,
    "slope_percent": 0,
    "aerial_image_url": "string",
    "road_width_m": 0,
    "road_grade": "string",
    "is_road_accessible": true
  },
  "land_price": {
    "official_price_per_sqm": 0,
    "history": [{ "year": 2025, "price_per_sqm": 0 }]
  },
  "nearby_transactions": [
    { "date": "2026-05", "type": "매매", "price": 0, "area_sqm": 0 }
  ],
  "climate": {
    "annual_sunlight_hours": 0,
    "solar_radiation": 0,
    "prevailing_wind_direction": "string"
  },
  "warnings": ["string"]
}
```

## 2. Phase 2 — 법규 자동 검토 (규칙 엔진)

### 입력
Phase 1 결과 (`zoning`, `site.area_sqm`, `surroundings` 등)

### 처리 로직 (규칙 엔진, 순수 함수로 구현 — 외부 API 호출 없음)
1. 건폐율 적용: `max_building_area = area_sqm * (bcr_limit / 100)`
2. 용적률 적용: `max_total_floor_area = area_sqm * (far_limit / 100)`
3. 인접대지 이격거리: 용도지역/건축물 구조 기준 최소 이격거리 규칙 테이블 적용 (국토계획법 기준값을 상수 테이블로 `/lib/pipeline/regulations/setback-rules.ts`에 정의)
4. 일조권 사선(정북방향 인접대지경계선 이격) 규칙 적용 — 표준 계산식(높이 9m 이하 1.5m, 9m 초과 부분 높이의 1/2 이상 등, 국토계획법 시행령 기준)을 상수로 정의하고 대지 형상에 단순 적용한 "개략" 결과 산출. **정밀 심의용이 아님을 결과에 항상 플래그로 표시**(`is_preliminary_only: true`)
5. 법정 주차대수: 용도/연면적 기준 표 적용
6. 위 결과를 종합해 "건물이 들어갈 수 있는 최대 매스 엔벨로프"를 층별 박스 형태로 산출 (Phase 3 입력으로 전달)

### 출력 스키마 (`analyses.phase2_result`)

```json
{
  "max_building_area_sqm": 0,
  "max_total_floor_area_sqm": 0,
  "max_floors_estimate": 0,
  "max_height_m": 0,
  "setback": {
    "boundary_setback_m": 0,
    "sunlight_setback_rule": "string",
    "is_preliminary_only": true
  },
  "required_parking_spaces": 0,
  "building_envelope": {
    "type": "stacked_boxes",
    "floors": [
      { "floor_no": 1, "footprint_geojson": { "...": "..." }, "height_m": 0 }
    ]
  },
  "applied_regulations": ["국토의 계획 및 이용에 관한 법률 시행령 제84조 등"],
  "exceptions_not_covered": ["지자체 조례 특례는 미반영"]
}
```

### 지자체 조례 예외 처리
초기 버전은 국토계획법 전국 공통 기준만 반영하고, 지자체별 조례 예외는 `regulations/local-exceptions/{시군구코드}.ts` 형태로 점진적으로 추가할 수 있는 구조로 설계 (초기엔 빈 상태로 시작, TODO 주석 명시).

## 3. Phase 3 — 3D 매스모델 자동 생성 (SketchUp MCP 연동)

### 입력
Phase 2의 `building_envelope`, Phase 1의 `boundary_geojson` / `surroundings.nearby_buildings_3d_url`

### 처리
1. Next.js 서버에서 SketchUp MCP 서버로 모델링 명령 요청 전송 (`SKETCHUP_MCP_ENDPOINT`)
2. 명령 내용: 필지 경계 임포트 → 층별 박스 매스 생성(Ruby API 지오메트리 명령) → GIS 건물 풋프린트와 높이로 생성한 주변 LOD1 컨텍스트 배치 → 기존 건물이 있는 경우 현황 모델 추가 생성
3. MCP 서버가 처리 완료 후 결과 파일(.skp 또는 변환된 .glb/썸네일 이미지)의 다운로드 URL 반환
4. 결과 파일을 Supabase Storage로 복사 저장, signed URL을 결과에 포함

### 인터페이스 (요청/응답 — MCP 서버가 별도 구현체이므로 이 형태를 계약으로 삼는다)

요청:
```json
{
  "site_boundary": { "...geojson..." },
  "building_envelope": { "...phase2 output..." },
  "context_buildings": [{ "footprint": {}, "height_m": 0 }],
  "existing_building": { "...optional..." }
}
```

응답:
```json
{
  "model_file_url": "string",
  "preview_thumbnail_url": "string",
  "glb_url": "string",
  "status": "success"
}
```

### 출력 스키마 (`analyses.phase3_result`)
```json
{
  "model_file_storage_path": "string",
  "thumbnail_storage_path": "string",
  "glb_storage_path": "string",
  "generation_time_ms": 0
}
```

### 미구현/목업 처리
SketchUp MCP 서버가 아직 준비되지 않은 개발 단계에서는 `USE_MOCK_EXTERNAL_API=true`일 때 정적 placeholder 썸네일과 더미 URL을 반환하도록 목업 처리한다.

## 4. Phase 4 — 사업성 분석 리포트

### 입력
Phase 2의 `max_total_floor_area_sqm`, Phase 1의 `nearby_transactions`, `land_price`

### 처리
1. 예상 분양/임대 수익: `max_total_floor_area_sqm * 주변_실거래_평단가` (용도별 표준 단가표 적용, `/lib/pipeline/regulations/construction-cost-table.ts`)
2. 총사업비 추정: `공사비(연면적 × 표준공사비/㎡) + 토지매입가(공시지가 또는 실거래가 기준) + 기타비용률(설계비/금융비 등 %)`
3. 수익률: `(예상수익 - 총사업비) / 총사업비 * 100`
4. 간이 IRR: 단순 현금흐름 가정(착공~준공~분양 기간을 표준값으로 가정)으로 근사 계산 — 정밀 금융모델 아님을 명시

### 출력 스키마 (`analyses.phase4_result`)
```json
{
  "expected_revenue_krw": 0,
  "estimated_total_cost_krw": 0,
  "estimated_construction_cost_krw": 0,
  "estimated_land_cost_krw": 0,
  "expected_profit_rate_percent": 0,
  "estimated_irr_percent": 0,
  "assumptions": {
    "construction_unit_cost_per_sqm": 0,
    "sale_price_per_sqm": 0,
    "project_duration_months": 0
  },
  "disclaimer": "본 사업성 분석은 표준단가 기반 개략 추정치이며 실제 사업 타당성 검토를 대체하지 않습니다."
}
```

## 5. MCP 자연어 인터페이스

`00-business-plan.md`에 명시된 "서울시 강남구 역삼동 123-4 분석해줘" 같은 자연어 입력을 지원하는 레이어. `/lib/mcp`에 다음을 구현:

1. Claude API에 사용자 자연어 입력 + 도구 정의(위 Phase 1~4 함수를 tool로 노출)를 전달
2. Claude가 지번을 파싱해 Phase 1 함수를 tool_use로 호출하도록 유도
3. 결과를 자연어 요약으로 사용자에게 반환 (대시보드 챗 UI 또는 향후 기능으로 확장 가능)

이 자연어 인터페이스는 MVP 범위에서는 "선택적 고급 기능"으로 취급하고, 기본 플로우는 폼 입력(지번 텍스트박스) 기반으로 우선 구현한다.

## 6. 결정 필요 항목

- 표준 공사비 단가표(용도별 ㎡당 단가)의 실제 출처/기준연도
- 지자체 조례 예외 반영 범위(전국 우선순위 지역 선정 필요 여부)
- SketchUp MCP 서버 자체의 개발/호스팅 주체(사내 별도 개발 vs 외부 기존 서비스 연동)

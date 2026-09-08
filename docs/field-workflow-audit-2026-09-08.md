# PLINT 현장 검토·연동 점검 (2026-09-08)

## 검증 대상과 확인 결과
애월해안로 255 / 고내리 1105-1 / PNU 5011025333111050001. VWorld 토지특성 면적 904㎡, 2026년 개별공시지가 567,600원/㎡. 기존 735㎡는 건물 연면적 기반 역산이므로 폐기. 연속지적도와 실제 주변 건물 도형으로 배치한다. 실제 실거래 API 조회는 성공하며 동일 법정동·지목·용도지역 조건에 맞는 표본이 없으면 중앙값은 미산정이다.

## 확인한 연결 오류
- 정적 지도: SATELLITE/HYBRID는 이미지 API의 허용 코드가 아님. PHOTO/PHOTO_HYBRID로 변환. 실제 해안 PNG 표시 확인.
- 토지특성: getLandCharacteristicsAttr 대신 getLandCharacteristics 사용.
- WFS: 버전 1.1.0 및 srsName EPSG:4326. 주변 건물 레이어는 lt_c_spbd.
- 실거래: 정상코드 000과 숫자형 날짜·면적에 대응. 최대 10페이지 조회, 해제·지분 거래 제외. 토지 거래를 신축 매출로 환산하지 않음.
- ASOS: 일자료 endpoint로 교정. 현 키로 활용승인 오류가 남음. 자료 누락 시 연간 합계를 0으로 표시하지 않음.
- Blender: 응답 data.status를 읽어야 함. 이전 워커는 임의 도로·주변 블록을 생성함. v3 워커는 실제 필지와 층별 면적만 사용.

## 현장 활용 기준
Autodesk Forma의 공식 안내는 초기 검토에서 현황·지형·건물 맥락, 면적과 환경분석의 결합을 설명한다. TestFit의 공식 고객 사례는 주차와 배치의 빠른 검토가 개발자·건축사에게 유용함을 보여 준다. 이를 근거로 현재 화면에 실제 경계, 확인된 주변 건물, 배치 평면, 10m 격자, 매스 폭·깊이·높이와 층별 면적을 표시했다.

이는 설계 가능 규모 확정이나 인허가 도면이 아니다. 구역별 면적과 제주 조례, 고도·경관·어항 조건, 주차대수·차량 진입과 회차, 건축선·이격·피난, 측량 지형, 침수·국가유산·지하안전과 사업성 입력은 별도 검증이 필요하다. 미구현 항목을 조회 실패나 위험 없음으로 표시하지 않는다.

자료 커버리지는 투자 신뢰도가 아니다. 주변 건물 수로 점수가 높아지지 않게 주요 항목만 집계하며 값이 null인 항목은 미확인이다.

## 보고서와 제안 이미지
저장된 보고서는 ID로 다시 열고 생성 API를 다시 호출하지 않는다. 같은 시나리오의 매스와 VWorld 3D/Cesium 화면을 캡처해 인쇄/PDF·Excel에 포함한다. 캡처는 현재 시점과 출처를 기록한다.

GPT Image 2 이미지 편집 API에 현장과 매스 두 장을 전달하고 용도·표현 방식을 선택한다. 층수는 분석의 세부설정에서 변경한다. 생성은 사용자가 버튼을 누른 경우만 요청하며 API 사용료가 발생함을 알린다. 주변 건물과 해안선 보존은 보장되지 않으므로 원본 비교 후 사용자가 포함한 이미지만 보고서에 반영한다. 생성 이미지는 현황 측량·설계도·인허가 자료와 구분한다. 실제 유료 생성 호출은 이 작업에서 실행하지 않았다.

## 운영 반영 순서
1. 테스트한 workers/blender 소스로 v3 이미지 발행 후 RunPod endpoint에 적용한다. 기존 GHCR latest 자동 발행 워크플로가 있다. 기존 워커 결과는 신규 화면에서 현황 자료로 표시하지 않는다.
2. Next.js 웹앱을 기존 Vercel/plint.kr 배포 흐름으로 반영한다. Sites 메타데이터의 chatgpt.site 주소는 plint.kr와 별도이며 Next.js 산출물을 그대로 Sites Worker로 업로드할 수 없다.
3. VWorld 도메인 등록, ASOS 활용승인, OPENAI_API_KEY 모델 권한을 운영 환경에서 확인한다.
4. 로그인 계정에서 저장 보고서 재열기와 GPU v3 렌더를 확인한다.

## 참고한 공식 자료
- https://help.autodesk.com/cloudhelp/ENU/Forma-SD-Get-Started/files/Getting_Started_SD.html
- https://aps.autodesk.com/customer-stories/testfit
- https://github.com/V-world/V-world_API_sample (WebGL 3 / GeoJSON 예제)
- https://developers.openai.com/api/docs/guides/image-generation
- https://developers.openai.com/api/docs/models/gpt-image-2
- https://www.data.go.kr/data/15059093/openapi.do

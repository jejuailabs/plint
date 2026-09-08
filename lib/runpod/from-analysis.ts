import type { AnalysisPreviewResponse } from '@/lib/domain/parcel-intelligence';
import type {
  BlenderModelingInput,
  MaterialPreset,
} from '@/lib/runpod/blender-modeling';

function inferMaterial(
  landCategory: string | null | undefined,
): MaterialPreset {
  if (!landCategory) return 'mixed';
  if (['대', '주차장'].includes(landCategory)) return 'residential';
  if (['공장용지', '창고용지'].includes(landCategory)) return 'commercial';
  if (['학교용지', '종교용지', '체육용지'].includes(landCategory))
    return 'office';
  return 'mixed';
}

export function createBlenderModelingInput(
  analysisId: string,
  preview: AnalysisPreviewResponse,
): BlenderModelingInput {
  const scenario =
    preview.data.scenarios.find(
      (candidate) => candidate.strategy === 'balanced',
    ) ?? preview.data.scenarios[0];
  const address = preview.data.identity.jibunAddress.value;
  const areaSqm = preview.data.geometry.areaSqm.value;
  const boundary = preview.data.geometry.boundary.value;

  if (!scenario)
    throw new Error('Blender 모델링에 사용할 개발 시나리오가 없습니다.');
  if (!address || !areaSqm)
    throw new Error('Blender 모델링에 필요한 주소 또는 필지 면적이 없습니다.');

  if (!scenario.massing || !boundary)
    throw new Error('실제 경계 내 배치 계산 결과가 필요합니다.');
  const landCategory = preview.data.geometry.landCategory?.value;

  return {
    analysisId,
    address,
    parcel: {
      areaSqm,
      boundary: boundary?.coordinates[0]?.map(([longitude, latitude]) => ({
        latitude,
        longitude,
      })),
    },
    context: preview.data.context
      .filter((b) => b.footprint.coordinates.length === 1)
      .map((b) => ({
        footprint: b.footprint.coordinates[0].map(([longitude, latitude]) => ({
          latitude,
          longitude,
        })),
        heightM: b.heightM.value ?? 9,
      })),
    scenario: {
      placement: scenario.massing,
      floorAreasSqm: scenario.massing.floorAreasSqm,
      id: scenario.id,
      label: scenario.name,
      floors: scenario.floors.length,
      buildingCoveragePercent: scenario.buildingCoverageRatio,
      floorAreaRatioPercent: scenario.floorAreaRatio,
      floorHeights: scenario.floors.map((f) => f.heightM),
    },
    material: inferMaterial(landCategory),
    renderAngles: ['birdseye', 'perspective', 'front'],
  };
}

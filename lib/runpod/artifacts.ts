import type { SupabaseClient } from '@supabase/supabase-js';

import type { RunpodBlenderResult } from '@/lib/runpod/blender-modeling';

const BUCKET = 'analysis-artifacts';
const MAX_ARTIFACT_BYTES = 10 * 1024 * 1024;

function fromBase64(base64: string, label: string) {
  const bytes = Buffer.from(base64, 'base64');
  if (bytes.length === 0 || bytes.length > MAX_ARTIFACT_BYTES) {
    throw new Error(`${label} 아티팩트 크기가 허용 범위를 벗어났습니다.`);
  }
  return bytes;
}

export async function persistBlenderArtifacts(
  supabase: SupabaseClient,
  input: { analysisId: string; userId: string; result: RunpodBlenderResult },
) {
  const root = `${input.userId}/${input.analysisId}`;
  const modelPath = `${root}/massing.glb`;
  const previewPath = `${root}/preview.png`;
  const model = fromBase64(input.result.model.base64, 'GLB');
  const preview = fromBase64(input.result.preview.base64, 'PNG');

  const [modelUpload, previewUpload] = await Promise.all([
    supabase.storage.from(BUCKET).upload(modelPath, model, {
      contentType: input.result.model.mimeType,
      upsert: true,
    }),
    supabase.storage.from(BUCKET).upload(previewPath, preview, {
      contentType: input.result.preview.mimeType,
      upsert: true,
    }),
  ]);

  if (modelUpload.error) throw new Error(`GLB 저장 실패: ${modelUpload.error.message}`);
  if (previewUpload.error) throw new Error(`PNG 저장 실패: ${previewUpload.error.message}`);

  const { error: artifactError } = await supabase.from('analysis_artifacts').insert([
    {
      analysis_id: input.analysisId,
      user_id: input.userId,
      kind: 'glb',
      storage_path: modelPath,
      file_size_bytes: model.length,
      generation_options: { provider: 'runpod-blender', renderer: input.result.renderer },
    },
    {
      analysis_id: input.analysisId,
      user_id: input.userId,
      kind: 'thumbnail',
      storage_path: previewPath,
      file_size_bytes: preview.length,
      generation_options: { provider: 'runpod-blender', renderer: input.result.renderer },
    },
  ]);
  if (artifactError) throw new Error(`아티팩트 정보 저장 실패: ${artifactError.message}`);

  return {
    modelPath,
    previewPath,
    modelBytes: model.length,
    previewBytes: preview.length,
  };
}

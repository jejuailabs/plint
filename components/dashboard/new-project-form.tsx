'use client';

import { Layers3, LoaderCircle, MapPin, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';

import { AddressSearch, type AddressResult } from '@/components/address-search';

export function NewProjectForm() {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingResult, setPendingResult] = useState<AddressResult | null>(null);

  const handleSelect = useCallback((result: AddressResult) => {
    setPendingResult(result);
  }, []);

  const confirmAndStart = useCallback(async () => {
    if (!pendingResult) return;
    const normalized = (pendingResult.jibunAddress || pendingResult.roadAddress).trim();
    if (!normalized) return;

    setIsPending(true);
    setErrorMessage(null);
    setPendingResult(null);

    try {
      const siteRes = await fetch('/api/sites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jibun_address: normalized }),
      });

      if (!siteRes.ok) {
        const payload = await siteRes.json() as { error?: { message?: string } };
        throw new Error(payload.error?.message ?? '프로젝트 생성에 실패했습니다.');
      }

      const { data: site } = await siteRes.json() as { data: { id: string } };

      const analysisRes = await fetch('/api/analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ site_id: site.id }),
      });

      if (!analysisRes.ok) {
        const payload = await analysisRes.json() as { error?: { message?: string } };
        throw new Error(payload.error?.message ?? '분석 요청에 실패했습니다.');
      }

      const { data: analysis } = await analysisRes.json() as { data: { id: string } };
      router.push(`/dashboard/analysis/${analysis.id}`);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : '오류가 발생했습니다.');
      setIsPending(false);
    }
  }, [pendingResult, router]);

  return (
    <div className="mx-auto w-full max-w-xl">
      <div className="rounded-2xl border border-white/12 bg-white/[0.065] p-2 shadow-[0_24px_90px_rgba(0,0,0,.32)] backdrop-blur-xl">
        {isPending ? (
          <div className="flex h-12 items-center justify-center gap-2 text-sm text-slate-300">
            <LoaderCircle className="size-4 animate-spin text-cyan-300" />
            분석을 시작하고 있습니다…
          </div>
        ) : (
          <AddressSearch
            onSelect={handleSelect}
            placeholder="도로명, 지번, 건물명으로 검색"
            disabled={isPending}
          />
        )}
      </div>
      {errorMessage ? (
        <p role="alert" className="mt-4 text-center text-sm text-rose-300">
          {errorMessage}
        </p>
      ) : null}

      {pendingResult && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm" onClick={() => setPendingResult(null)}>
          <div className="mx-4 w-full max-w-md rounded-2xl border border-white/12 bg-[#0c1829] p-6 shadow-[0_40px_120px_rgba(0,0,0,.6)]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">주소 확인</h3>
              <button type="button" onClick={() => setPendingResult(null)} className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white">
                <X className="size-4" />
              </button>
            </div>
            <div className="mt-4 rounded-xl border border-cyan-300/15 bg-cyan-300/[0.04] p-4">
              <div className="flex gap-3">
                <MapPin className="mt-0.5 size-4 shrink-0 text-cyan-300" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white">{pendingResult.roadAddress || pendingResult.jibunAddress}</p>
                  {pendingResult.roadAddress && pendingResult.jibunAddress && (
                    <p className="mt-1 text-xs text-slate-400">{pendingResult.jibunAddress}</p>
                  )}
                  {pendingResult.buildingName && (
                    <p className="mt-1 text-xs text-cyan-200/70">{pendingResult.buildingName}</p>
                  )}
                  <p className="mt-1 text-[11px] text-slate-500">{pendingResult.zipCode}</p>
                </div>
              </div>
            </div>
            <p className="mt-4 text-xs text-slate-400">이 주소로 개발 사전검토 분석을 시작합니다.</p>
            <div className="mt-5 flex gap-3">
              <button type="button" onClick={() => setPendingResult(null)} className="flex-1 rounded-xl border border-white/10 bg-white/[0.04] py-2.5 text-sm text-slate-300 hover:bg-white/[0.08]">
                취소
              </button>
              <button type="button" onClick={confirmAndStart} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-cyan-300 py-2.5 text-sm font-medium text-slate-950 hover:bg-cyan-200">
                <Layers3 className="size-4" />
                분석 시작
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import { LoaderCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';

import { AddressSearch, type AddressResult } from '@/components/address-search';

export function NewProjectForm() {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSelect = useCallback(async (result: AddressResult) => {
    const normalized = (result.jibunAddress || result.roadAddress).trim();
    if (!normalized) return;

    setIsPending(true);
    setErrorMessage(null);

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
  }, [router]);

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
    </div>
  );
}

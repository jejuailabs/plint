'use client';

import { ArrowRight, LoaderCircle, MapPin } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { type SyntheticEvent, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function NewProjectForm() {
  const router = useRouter();
  const [address, setAddress] = useState('');
  const [isPending, setIsPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(e: SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    const normalized = address.trim();
    if (!normalized) return;

    setIsPending(true);
    setErrorMessage(null);

    try {
      // Create site
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

      // Start analysis
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
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto w-full max-w-xl">
      <div className="rounded-2xl border border-white/12 bg-white/[0.065] p-2 shadow-[0_24px_90px_rgba(0,0,0,.32)] backdrop-blur-xl">
        <label className="sr-only" htmlFor="new-project-address">지번 또는 도로명주소</label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="flex flex-1 items-center gap-2 px-2">
            <MapPin className="size-4 shrink-0 text-cyan-300" />
            <Input
              id="new-project-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="지번 또는 도로명주소를 입력하세요"
              className="h-12 flex-1 border-0 bg-transparent px-2 text-[15px] text-white shadow-none placeholder:text-slate-500 focus-visible:ring-0"
              disabled={isPending}
            />
          </div>
          <Button
            type="submit"
            disabled={isPending || !address.trim()}
            className="h-12 rounded-xl bg-lime-300 px-6 text-slate-950 hover:bg-lime-200 disabled:opacity-50"
          >
            {isPending ? (
              <LoaderCircle className="mr-1 size-4 animate-spin" />
            ) : (
              <ArrowRight className="mr-1 size-4" />
            )}
            분석 시작
          </Button>
        </div>
      </div>
      {errorMessage ? (
        <p role="alert" className="mt-4 text-center text-sm text-rose-300">
          {errorMessage}
        </p>
      ) : null}
      <p className="mt-4 text-center text-xs text-slate-600">
        예: 서울특별시 성동구 성수동2가 277-17
      </p>
    </form>
  );
}

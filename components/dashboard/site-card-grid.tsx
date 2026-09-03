'use client';

import { Calendar, FolderOpen, Layers, MapPin, Plus } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

type Site = {
  id: string;
  jibun_address: string;
  created_at: string;
  analysis_count: number;
  last_analysis_at: string | null;
};

type SitesResponse = {
  data: Site[];
};

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

function SiteCard({ site }: { site: Site }) {
  return (
    <Link
      href={`/dashboard/analysis/${site.id}`}
      className="group rounded-2xl border border-white/8 bg-white/[0.035] p-5 transition hover:border-white/15 hover:bg-white/[0.06]"
    >
      <div className="flex items-start justify-between">
        <div className="grid size-10 place-items-center rounded-xl border border-cyan-300/20 bg-cyan-300/8">
          <MapPin className="size-4 text-cyan-300" />
        </div>
        <span className="text-[10px] uppercase tracking-[0.14em] text-slate-600">
          {site.analysis_count}건 분석
        </span>
      </div>
      <p className="mt-4 text-sm font-medium text-white group-hover:text-cyan-100">
        {site.jibun_address}
      </p>
      <div className="mt-3 flex items-center gap-3 text-[11px] text-slate-500">
        <span className="flex items-center gap-1">
          <Calendar className="size-3" />
          {site.last_analysis_at ? formatDate(site.last_analysis_at) : formatDate(site.created_at)}
        </span>
        <span className="flex items-center gap-1">
          <Layers className="size-3" />
          {site.analysis_count}건
        </span>
      </div>
    </Link>
  );
}

function SkeletonCards() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-white/8 bg-white/[0.035] p-5">
          <Skeleton className="size-10 rounded-xl bg-white/5" />
          <Skeleton className="mt-4 h-4 w-3/4 bg-white/5" />
          <Skeleton className="mt-3 h-3 w-1/2 bg-white/5" />
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-16 text-center">
      <div className="grid size-16 place-items-center rounded-2xl border border-white/10 bg-white/[0.04]">
        <FolderOpen className="size-7 text-slate-600" />
      </div>
      <h3 className="mt-6 text-lg font-medium text-white">첫 프로젝트를 시작하세요</h3>
      <p className="mt-2 max-w-sm text-sm text-slate-500">
        분석할 대지의 지번주소를 입력하면 필지 데이터, 규제 검토, 시장 분석, 3D 시나리오를 자동으로 생성합니다.
      </p>
      <Link href="/dashboard/new">
        <Button className="mt-6 h-10 bg-lime-300 px-5 text-slate-950 hover:bg-lime-200">
          <Plus className="size-4" />
          새 프로젝트 시작
        </Button>
      </Link>
    </div>
  );
}

export function SiteCardGrid() {
  const [sites, setSites] = useState<Site[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  const fetchSites = useCallback(async () => {
    try {
      const res = await fetch('/api/sites');
      if (!res.ok) throw new Error('Failed to fetch sites');
      const payload = (await res.json()) as SitesResponse;
      setSites(payload.data ?? []);
      setStatus('ready');
    } catch {
      setStatus('ready');
      setSites([]);
    }
  }, []);

  useEffect(() => {
    const initialFetch = window.setTimeout(() => {
      void fetchSites();
    }, 0);
    return () => clearTimeout(initialFetch);
  }, [fetchSites]);

  if (status === 'loading') return <SkeletonCards />;

  if (sites.length === 0) return <EmptyState />;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {sites.map((site) => (
        <SiteCard key={site.id} site={site} />
      ))}
    </div>
  );
}

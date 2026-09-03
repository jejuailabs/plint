'use client';

import {
  AlertTriangle, CheckCircle2, Clock, Layers3, LoaderCircle, RefreshCw,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type AnalysisStatus = 'pending' | 'collecting' | 'regulations' | 'modeling' | 'feasibility' | 'completed' | 'failed';

type AnalysisResult = {
  id: string;
  site_id: string;
  status: AnalysisStatus;
  jibun_address: string;
  created_at: string;
  result: Record<string, unknown> | null;
};

const statusLabels: Record<AnalysisStatus, string> = {
  pending: '대기 중',
  collecting: '데이터 수집 중',
  regulations: '규제 검토 중',
  modeling: '매싱 모델링 중',
  feasibility: '사업성 분석 중',
  completed: '분석 완료',
  failed: '분석 실패',
};

const statusSteps: AnalysisStatus[] = ['collecting', 'regulations', 'modeling', 'feasibility', 'completed'];

function isTerminal(status: AnalysisStatus) {
  return status === 'completed' || status === 'failed';
}

function StepIndicator({ current }: { current: AnalysisStatus }) {
  const currentIndex = statusSteps.indexOf(current);

  return (
    <div className="flex items-center gap-2">
      {statusSteps.map((step, i) => {
        const isDone = currentIndex > i;
        const isActive = currentIndex === i;
        return (
          <div key={step} className="flex items-center gap-2">
            <div className="flex flex-col items-center gap-1">
              <div
                className={`grid size-8 place-items-center rounded-full border ${
                  isDone
                    ? 'border-lime-300/30 bg-lime-300/10'
                    : isActive
                      ? 'border-cyan-300/30 bg-cyan-300/10'
                      : 'border-white/10 bg-white/[0.03]'
                }`}
              >
                {isDone ? (
                  <CheckCircle2 className="size-4 text-lime-300" />
                ) : isActive ? (
                  <LoaderCircle className="size-4 animate-spin text-cyan-300" />
                ) : (
                  <Clock className="size-3.5 text-slate-600" />
                )}
              </div>
              <span className={`text-[10px] ${isDone ? 'text-lime-300' : isActive ? 'text-cyan-200' : 'text-slate-600'}`}>
                {statusLabels[step]}
              </span>
            </div>
            {i < statusSteps.length - 1 && (
              <div className={`mb-4 h-px w-8 ${isDone ? 'bg-lime-300/30' : 'bg-white/10'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function AnalysisDetail({ analysisId }: { analysisId: string }) {
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchAnalysis = useCallback(async () => {
    try {
      const res = await fetch(`/api/analysis/${analysisId}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const payload = await res.json() as { data: AnalysisResult };
      setAnalysis(payload.data);
      setStatus('ready');

      if (isTerminal(payload.data.status) && timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    } catch {
      setStatus('error');
    }
  }, [analysisId]);

  useEffect(() => {
    const initialFetch = window.setTimeout(() => {
      void fetchAnalysis();
    }, 0);
    timerRef.current = setInterval(() => {
      void fetchAnalysis();
    }, 3000);

    return () => {
      clearTimeout(initialFetch);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [fetchAnalysis]);

  if (status === 'loading') {
    return (
      <div className="grid min-h-[calc(100vh-64px)] place-items-center">
        <div className="text-center">
          <LoaderCircle className="mx-auto size-8 animate-spin text-cyan-300" />
          <p className="mt-4 text-sm text-slate-300">분석 정보를 불러오고 있습니다...</p>
        </div>
      </div>
    );
  }

  if (status === 'error' || !analysis) {
    return (
      <div className="grid min-h-[calc(100vh-64px)] place-items-center px-6">
        <Card className="max-w-md border border-rose-400/20 bg-rose-400/5 text-white">
          <CardContent className="flex flex-col items-center py-8 text-center">
            <AlertTriangle className="size-8 text-rose-300" />
            <p className="mt-4 text-sm">분석 정보를 불러올 수 없습니다.</p>
            <Button className="mt-5" onClick={() => void fetchAnalysis()}>
              <RefreshCw className="size-4" />
              다시 시도
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Failed state
  if (analysis.status === 'failed') {
    return (
      <div className="mx-auto max-w-2xl px-5 py-12">
        <Card className="border border-rose-400/20 bg-rose-400/5 text-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="size-5 text-rose-300" />
              분석 실패
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-slate-300">
              {analysis.jibun_address} 분석 중 오류가 발생했습니다. 주소를 확인하고 다시 시도해 주세요.
            </p>
            <div className="flex gap-3">
              <Link href="/dashboard/new">
                <Button className="bg-lime-300 text-slate-950 hover:bg-lime-200">
                  <RefreshCw className="size-4" />
                  다시 분석
                </Button>
              </Link>
              <Link href="/dashboard">
                <Button variant="outline" className="border-white/10 text-slate-300 hover:bg-white/5 hover:text-white">
                  프로젝트 목록
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // In-progress state
  if (!isTerminal(analysis.status)) {
    return (
      <div className="grid min-h-[calc(100vh-64px)] place-items-center px-6">
        <div className="flex flex-col items-center gap-8 text-center">
          <div className="grid size-16 place-items-center rounded-2xl border border-cyan-300/20 bg-cyan-300/8">
            <Layers3 className="size-7 text-cyan-300" />
          </div>
          <div>
            <h2 className="text-xl font-medium text-white">{analysis.jibun_address}</h2>
            <p className="mt-2 text-sm text-slate-400">분석이 진행 중입니다...</p>
          </div>
          <StepIndicator current={analysis.status} />
          <Badge variant="outline" className="border-cyan-300/20 bg-cyan-300/8 text-cyan-200">
            {statusLabels[analysis.status]}
          </Badge>
          <p className="text-xs text-slate-600">3초마다 자동으로 상태를 확인합니다</p>
        </div>
      </div>
    );
  }

  // Completed state - show a summary (the full workspace can be reused)
  return (
    <div className="mx-auto max-w-4xl px-5 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">분석 완료</p>
          <h2 className="mt-1 text-xl font-medium text-white">{analysis.jibun_address}</h2>
        </div>
        <Badge variant="outline" className="border-lime-300/25 bg-lime-300/10 text-lime-200">
          완료
        </Badge>
      </div>

      <Card className="border border-white/8 bg-white/[0.035] text-white">
        <CardContent className="py-12 text-center">
          <CheckCircle2 className="mx-auto size-12 text-lime-300" />
          <h3 className="mt-4 text-lg font-medium">분석이 완료되었습니다</h3>
          <p className="mt-2 text-sm text-slate-400">
            필지 식별, 규제 검토, 매싱 모델링, 사업성 분석이 모두 완료되었습니다.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link href={`/analysis?address=${encodeURIComponent(analysis.jibun_address)}`}>
              <Button className="bg-lime-300 text-slate-950 hover:bg-lime-200">
                상세 결과 보기
              </Button>
            </Link>
            <Link href="/dashboard">
              <Button variant="outline" className="border-white/10 text-slate-300 hover:bg-white/5 hover:text-white">
                프로젝트 목록
              </Button>
            </Link>
          </div>
          <p className="mt-6 text-[10px] text-slate-600">
            본 결과는 사전검토용 개략 분석이며 인허가, 감정평가 또는 전문 용역을 대체하지 않습니다.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

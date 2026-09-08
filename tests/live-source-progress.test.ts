import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AnalysisProgress } from '@/lib/pipeline/progress';

const calls = vi.hoisted(() => ({
  address: vi.fn(),
  building: vi.fn(),
  price: vi.fn(),
  transactions: vi.fn(),
  weather: vi.fn(),
  planning: vi.fn(),
  cadastral: vi.fn(),
  context: vi.fn(),
  characteristics: vi.fn(),
}));
vi.mock('@/lib/external-apis/connectors/juso-address', () => ({
  createJusoAddressConnector: () => ({ execute: calls.address }),
}));
vi.mock('@/lib/external-apis/connectors/building-ledger', () => ({
  createBuildingLedgerConnector: () => ({ execute: calls.building }),
}));
vi.mock('@/lib/external-apis/connectors/land-price', () => ({
  createLandPriceConnector: () => ({ execute: calls.price }),
}));
vi.mock('@/lib/external-apis/connectors/land-transaction', () => ({
  createLandTransactionConnector: () => ({ execute: calls.transactions }),
}));
vi.mock('@/lib/external-apis/connectors/kma-weather', () => ({
  createKmaWeatherConnector: () => ({ execute: calls.weather }),
}));
vi.mock('@/lib/external-apis/connectors/land-use-plan', () => ({
  createLandUsePlanConnector: () => ({ execute: calls.planning }),
}));
vi.mock('@/lib/external-apis/connectors/cadastral-boundary', () => ({
  createCadastralBoundaryConnector: () => ({ execute: calls.cadastral }),
}));
vi.mock('@/lib/external-apis/connectors/context-buildings', () => ({
  createContextBuildingsConnector: () => ({ execute: calls.context }),
}));
vi.mock('@/lib/external-apis/connectors/land-characteristics', () => ({
  createLandCharacteristicsConnector: () => ({
    execute: calls.characteristics,
  }),
}));

import { fetchLiveSourceData } from '@/lib/pipeline/live-source';

const response = (data: unknown) => ({
  data,
  rawSnapshotId: 'test',
  observedAt: '2026-09-08',
  warnings: [],
});

beforeEach(() => {
  vi.resetAllMocks();
  Object.values(calls).forEach((call) => call.mockResolvedValue(response({})));
  calls.address.mockResolvedValue(
    response({
      pnuCode: '1168010100101230000',
      administrativeCode: '1168010100',
      latitude: 37.5,
      longitude: 127,
    }),
  );
  calls.transactions.mockResolvedValue(
    response([{ date: '2026-01-01', type: '대', price: 1000, areaSqm: 10 }]),
  );
});

describe('live source progress wiring', () => {
  it('reports parallel groups independently while a real connector is still pending', async () => {
    let finish!: (value: ReturnType<typeof response>) => void;
    calls.building.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const events: AnalysisProgress[] = [];
    let weatherDone!: () => void;
    const weather = new Promise<void>((resolve) => {
      weatherDone = resolve;
    });
    const signal = new AbortController().signal;
    const pending = fetchLiveSourceData('서울특별시 강남구 역삼동', {
      signal,
      onProgress: (event) => {
        events.push(event);
        if (event.step === 'weather' && event.status === 'completed')
          weatherDone();
      },
    });
    await weather;
    expect(
      events.filter((event) => event.step === 'building').at(-1)?.status,
    ).toBe('running');
    expect(calls.transactions).toHaveBeenCalledTimes(6);
    expect(calls.building.mock.calls[0][1]).toBe(signal);
    finish(response({}));
    await pending;
    for (const step of [
      'address',
      'building',
      'market',
      'planning',
      'weather',
    ]) {
      expect(events.filter((event) => event.step === step).at(-1)?.status).toBe(
        'completed',
      );
    }
  });

  it('skips downstream requests when address resolution returns no data', async () => {
    calls.address.mockResolvedValue(response(null));
    const events: AnalysisProgress[] = [];
    await fetchLiveSourceData('주소 확인 불가', {
      onProgress: (event) => events.push(event),
    });
    expect(calls.building).not.toHaveBeenCalled();
    expect(calls.transactions).not.toHaveBeenCalled();
    expect(
      events.find(
        (event) => event.step === 'address' && event.status === 'warning',
      ),
    ).toBeDefined();
    expect(events.filter((event) => event.status === 'skipped')).toHaveLength(
      4,
    );
  });

  it('preserves other source results when one connector fails', async () => {
    calls.planning.mockRejectedValue(new Error('upstream unavailable'));
    const events: AnalysisProgress[] = [];
    const result = await fetchLiveSourceData('서울특별시 강남구 역삼동', {
      onProgress: (event) => events.push(event),
    });
    expect(result.landUsePlan.data).toBeNull();
    expect(result.building.data).not.toBeNull();
    expect(
      events.filter((event) => event.step === 'planning').at(-1)?.status,
    ).toBe('warning');
  });
});

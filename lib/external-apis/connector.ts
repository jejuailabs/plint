export type ConnectorProtocol = 'REST' | 'WFS' | 'WMS' | 'WMTS' | 'FILE' | 'SDK';

export type ConnectorManifest = {
  id: string;
  label: string;
  provider: string;
  datasetId: string;
  sourceUrl: string;
  protocol: ConnectorProtocol;
  auth: 'serviceKey' | 'token' | 'none';
  path: 'request' | 'warehouse' | 'render';
  updateCycle: string;
  timeoutMs: number;
  dailyQuota?: number;
  licenseCode: string;
  commercialUse: 'allowed' | 'restricted' | 'review';
  derivativeUse: 'allowed' | 'restricted' | 'review';
  coordinateSystem?: string;
  requiredForPreview: boolean;
};

export type ConnectorResult<T> = {
  data: T | null;
  rawSnapshotId: string;
  observedAt: string;
  effectiveAt?: string;
  warnings: string[];
};

export interface Connector<TInput, TOutput> {
  manifest: ConnectorManifest;
  execute(input: TInput, signal?: AbortSignal): Promise<ConnectorResult<TOutput>>;
}

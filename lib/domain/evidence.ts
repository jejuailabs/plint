import { z } from 'zod';

export const confidenceSchema = z.enum(['verified', 'derived', 'estimated', 'missing']);

export const evidenceSchema = z.object({
  provider: z.string().min(1),
  datasetId: z.string().min(1),
  sourceUrl: z.url(),
  observedAt: z.iso.datetime(),
  effectiveAt: z.iso.datetime().optional(),
  licenseCode: z.string().min(1),
  coordinateSystem: z.string().optional(),
  rawSnapshotId: z.string().min(1),
  confidence: confidenceSchema,
});

export type Confidence = z.infer<typeof confidenceSchema>;
export type Evidence = z.infer<typeof evidenceSchema>;

export type Fact<T> = {
  value: T | null;
  evidence: Evidence[];
  derivation?: string;
  warnings: string[];
};

export function fact<T>(
  value: T | null,
  evidence: Evidence[],
  options: { derivation?: string; warnings?: string[] } = {},
): Fact<T> {
  return {
    value,
    evidence,
    derivation: options.derivation,
    warnings: options.warnings ?? [],
  };
}

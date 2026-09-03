import { success } from '@/lib/api/response';

/**
 * Public endpoint returning published notices.
 * Returns an empty array until the notices table migration is applied.
 */
export function GET() {
  // TODO: query notices table once its migration is in place
  return success([]);
}

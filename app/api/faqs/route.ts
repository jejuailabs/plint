import { success } from '@/lib/api/response';

/**
 * Public endpoint returning published FAQs.
 * Returns an empty array until the faqs table migration is applied.
 */
export function GET() {
  // TODO: query faqs table once its migration is in place
  return success([]);
}

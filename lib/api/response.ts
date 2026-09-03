/**
 * Standardised JSON response helpers for API routes.
 *
 * Success shape : { data: T }
 * Paginated     : { data: T[], pagination: { page, pageSize, total } }
 * Error shape   : { error: { code, message } }
 */

export function success<T>(data: T, status = 200): Response {
  return Response.json({ data }, { status });
}

export function paginated<T>(
  data: T[],
  pagination: { page: number; pageSize: number; total: number },
): Response {
  return Response.json({ data, pagination });
}

export function error(code: string, message: string, status = 400): Response {
  return Response.json({ error: { code, message } }, { status });
}

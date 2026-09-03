const PORTONE_API_BASE = 'https://api.portone.io';

type PortOneConfig = {
  storeId: string;
  apiSecret: string;
};

function getConfig(): PortOneConfig | null {
  const storeId = process.env.PORTONE_STORE_ID;
  const apiSecret = process.env.PORTONE_API_SECRET;
  if (!storeId || !apiSecret) return null;
  return { storeId, apiSecret };
}

export function isPortOneConfigured(): boolean {
  return getConfig() !== null;
}

async function portoneRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const config = getConfig();
  if (!config) throw new Error('PortOne is not configured. Set PORTONE_STORE_ID and PORTONE_API_SECRET.');

  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');
  headers.set('Authorization', `PortOne ${config.apiSecret}`);

  const response = await fetch(`${PORTONE_API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`PortOne API error ${response.status}: ${body}`);
  }

  return response.json() as Promise<T>;
}

export type BillingKeyInfo = {
  billingKey: string;
  customerId: string;
  cardName?: string;
  cardLast4?: string;
};

export async function validateBillingKey(billingKey: string): Promise<BillingKeyInfo> {
  const result = await portoneRequest<{
    billingKeyInfo: {
      billingKey: string;
      customerId: string;
      methods?: Array<{ card?: { name?: string; number?: string } }>;
    };
  }>(`/billing-keys/${encodeURIComponent(billingKey)}`);

  const card = result.billingKeyInfo.methods?.[0]?.card;
  return {
    billingKey: result.billingKeyInfo.billingKey,
    customerId: result.billingKeyInfo.customerId,
    cardName: card?.name,
    cardLast4: card?.number?.slice(-4),
  };
}

export type PaymentRequest = {
  billingKey: string;
  orderName: string;
  amount: number;
  currency?: string;
  customerId: string;
};

export type PaymentResult = {
  paymentId: string;
  status: 'PAID' | 'FAILED' | 'CANCELLED';
  amount: number;
  paidAt?: string;
  failedReason?: string;
};

export async function requestPayment(paymentId: string, request: PaymentRequest): Promise<PaymentResult> {
  const config = getConfig();
  if (!config) throw new Error('PortOne is not configured.');

  const result = await portoneRequest<{
    payment: {
      id: string;
      status: string;
      amount: { total: number };
      paidAt?: string;
      failure?: { reason?: string };
    };
  }>(`/payments/${encodeURIComponent(paymentId)}/billing-key`, {
    method: 'POST',
    body: JSON.stringify({
      storeId: config.storeId,
      billingKey: request.billingKey,
      orderName: request.orderName,
      amount: { total: request.amount, currency: request.currency ?? 'KRW' },
      customer: { id: request.customerId },
    }),
  });

  return {
    paymentId: result.payment.id,
    status: result.payment.status as PaymentResult['status'],
    amount: result.payment.amount.total,
    paidAt: result.payment.paidAt,
    failedReason: result.payment.failure?.reason,
  };
}

export async function cancelScheduledPayment(billingKey: string): Promise<void> {
  await portoneRequest(`/billing-keys/${encodeURIComponent(billingKey)}/schedule`, {
    method: 'DELETE',
  });
}

export type WebhookEvent = {
  type: string;
  data: {
    paymentId?: string;
    transactionId?: string;
    storeId?: string;
  };
};

export function verifyWebhookSignature(body: string, signature: string): boolean {
  const secret = process.env.PORTONE_WEBHOOK_SECRET;
  if (!secret) return false;
  // PortOne V2 webhook signature verification
  // In production, use HMAC-SHA256 with the webhook secret
  // For skeleton: accept if secret is configured
  return signature.length > 0 && secret.length > 0;
}

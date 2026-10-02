import crypto from 'node:crypto';

const API_BASE = 'https://cloudapi.inflowinventory.com';
const DEFAULT_API_VERSION = '2026-09-29';

export function getInflowConfig() {
  const companyId = String(process.env.INFLOW_COMPANY_ID || '').trim();
  const apiKey = String(process.env.INFLOW_API_KEY || '').trim();
  const apiVersion = String(process.env.INFLOW_API_VERSION || DEFAULT_API_VERSION).trim();
  return { companyId, apiKey, apiVersion };
}

export function assertInflowConfig() {
  const config = getInflowConfig();
  const missing = [];
  if (!config.companyId) missing.push('INFLOW_COMPANY_ID');
  if (!config.apiKey) missing.push('INFLOW_API_KEY');
  if (missing.length) throw new Error(`Missing inFlow configuration: ${missing.join(', ')}`);
  return config;
}

export async function inflowFetch(path, options = {}) {
  const { companyId, apiKey, apiVersion } = assertInflowConfig();
  const cleanPath = String(path).replace(/^\//, '');
  const url = `${API_BASE}/${companyId}/${cleanPath}`;
  const headers = new Headers(options.headers || {});
  headers.set('Authorization', `Bearer ${apiKey}`);
  headers.set('Accept', `application/json;version=${apiVersion}`);
  if (options.body != null && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, { ...options, headers });
  const textBody = await response.text();
  let data = null;
  if (textBody) {
    try { data = JSON.parse(textBody); }
    catch { data = textBody; }
  }

  if (!response.ok) {
    const detail = typeof data === 'string' ? data : JSON.stringify(data);
    const error = new Error(`inFlow ${response.status} ${response.statusText}: ${detail || 'No response body'}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

export function stableUuid(...parts) {
  const digest = crypto.createHash('sha256').update(parts.join('|')).digest();
  const bytes = Buffer.from(digest.subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function safeEqualBase64(a, b) {
  try {
    const left = Buffer.from(String(a || '').trim(), 'base64');
    const right = Buffer.from(String(b || '').trim(), 'base64');
    return left.length > 0 && left.length === right.length && crypto.timingSafeEqual(left, right);
  } catch {
    return false;
  }
}

export function verifyInflowWebhook(rawBody, signature) {
  const secret = String(process.env.INFLOW_WEBHOOK_SECRET || '').trim();
  if (!secret || !signature) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('base64');
  return safeEqualBase64(signature, expected);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function eventLooksLikeSalesOrder(value) {
  return typeof value === 'string' && /sales\s*order/i.test(value.replace(/[._-]/g, ' '));
}

export function extractSalesOrderIds(payload) {
  const ids = new Set();
  const fallbackIds = new Set();
  const seen = new Set();

  function walk(value, salesOrderContext = false) {
    if (value == null || typeof value !== 'object') return;
    if (seen.has(value)) return;
    seen.add(value);

    if (Array.isArray(value)) {
      for (const item of value) walk(item, salesOrderContext);
      return;
    }

    const markerValues = [
      value.event,
      value.eventName,
      value.eventType,
      value.type,
      value.resource,
      value.resourceType,
      value.entityType,
      value.objectType,
    ];
    const hereIsSalesOrder = salesOrderContext || markerValues.some(eventLooksLikeSalesOrder);

    for (const [key, child] of Object.entries(value)) {
      if (/^salesOrderId$/i.test(key) && typeof child === 'string' && UUID_RE.test(child)) {
        ids.add(child);
      } else if (hereIsSalesOrder && /^(id|entityId|recordId|resourceId|objectId)$/i.test(key) && typeof child === 'string' && UUID_RE.test(child)) {
        fallbackIds.add(child);
      }
    }

    for (const child of Object.values(value)) walk(child, hereIsSalesOrder);
  }

  walk(payload);
  return [...ids, ...fallbackIds];
}

export function quantityAsPositiveString(line) {
  const raw = line?.quantity?.standardQuantity ?? line?.quantity?.uomQuantity ?? null;
  if (raw == null) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return String(raw);
}

export function makeMoNumber(orderNumber, lineNum, sku) {
  const clean = (value) => String(value || '').replace(/[^A-Za-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
  const order = clean(orderNumber) || 'SO';
  const suffix = clean(sku) || String((Number(lineNum) || 0) + 1);
  return `MO-${order}-${suffix}`.slice(0, 80);
}

const API_BASE = 'https://cloudapi.inflowinventory.com';
const DEFAULT_API_VERSION = '2026-09-29';

export function getInflowConfig() {
  return {
    companyId: String(process.env.INFLOW_COMPANY_ID || '').trim(),
    apiKey: String(process.env.INFLOW_API_KEY || '').trim(),
    apiVersion: String(process.env.INFLOW_API_VERSION || DEFAULT_API_VERSION).trim(),
  };
}

export function inflowConfigured() {
  const c = getInflowConfig();
  return Boolean(c.companyId && c.apiKey);
}

export async function inflowFetch(path, options = {}) {
  const { companyId, apiKey, apiVersion } = getInflowConfig();
  if (!companyId || !apiKey) {
    const error = new Error('inFlow API is not configured. Add INFLOW_COMPANY_ID and INFLOW_API_KEY in Vercel.');
    error.status = 503;
    throw error;
  }
  const clean = String(path || '').replace(/^\//, '');
  const headers = new Headers(options.headers || {});
  headers.set('Authorization', 'Bearer ' + apiKey);
  headers.set('Accept', 'application/json;version=' + apiVersion);
  if (options.body != null && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

  const response = await fetch(API_BASE + '/' + encodeURIComponent(companyId) + '/' + clean, { ...options, headers });
  const raw = await response.text();
  let data = null;
  if (raw) {
    try { data = JSON.parse(raw); } catch { data = raw; }
  }
  if (!response.ok) {
    const detail = typeof data === 'string' ? data : JSON.stringify(data);
    const error = new Error('inFlow ' + response.status + ': ' + (detail || response.statusText));
    error.status = response.status;
    throw error;
  }
  return data;
}

function number(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function sumField(lines, keys) {
  let total = 0;
  let found = false;
  for (const line of Array.isArray(lines) ? lines : []) {
    for (const key of keys) {
      if (line?.[key] != null) {
        total += number(line[key]);
        found = true;
        break;
      }
    }
  }
  return { total, found };
}

export function normalizeProduct(product) {
  const lines = Array.isArray(product?.inventoryLines) ? product.inventoryLines : [];
  const hand = sumField(lines, ['quantityOnHand', 'qtyOnHand']);
  const available = sumField(lines, ['quantityAvailable', 'rawQuantityAvailable', 'available']);
  const onOrder = sumField(lines, ['quantityOnOrder', 'quantityOnPurchaseOrder', 'qtyOnOrder']);
  const reserved = sumField(lines, ['quantityReserved', 'quantityReservedForSales', 'reserved']);

  const locations = lines.map(line => ({
    locationId: String(line?.locationId || ''),
    sublocation: String(line?.sublocation || ''),
    onHand: number(line?.quantityOnHand ?? line?.qtyOnHand),
    available: number(line?.quantityAvailable ?? line?.rawQuantityAvailable ?? line?.quantityOnHand),
    onOrder: number(line?.quantityOnOrder ?? line?.quantityOnPurchaseOrder),
  })).filter(line => line.locationId || line.sublocation || line.onHand || line.available || line.onOrder);

  return {
    productId: String(product?.productId || product?.id || ''),
    name: String(product?.name || product?.productName || ''),
    sku: String(product?.sku || ''),
    isActive: product?.isActive !== false,
    onHand: hand.total,
    available: available.found ? available.total : hand.total,
    onOrder: onOrder.total,
    reserved: reserved.total,
    locations,
  };
}

export async function pullAllProducts() {
  const out = [];
  const seen = new Set();
  let after = '';
  const pageSize = 100;

  for (let page = 0; page < 20; page += 1) {
    const params = new URLSearchParams();
    params.set('include', 'inventoryLines');
    params.set('count', String(pageSize));
    if (after) params.set('after', after);

    const data = await inflowFetch('products?' + params.toString());
    const rows = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : Array.isArray(data?.items) ? data.items : [];
    if (!rows.length) break;

    let added = 0;
    for (const row of rows) {
      const normalized = normalizeProduct(row);
      if (!normalized.productId || seen.has(normalized.productId)) continue;
      seen.add(normalized.productId);
      out.push(normalized);
      added += 1;
    }

    const last = rows[rows.length - 1];
    const nextAfter = String(last?.productId || last?.id || '');
    if (rows.length < pageSize || !nextAfter || nextAfter === after || added === 0) break;
    after = nextAfter;
  }

  return out.filter(p => p.isActive).sort((a,b) => (a.sku || a.name).localeCompare(b.sku || b.name));
}

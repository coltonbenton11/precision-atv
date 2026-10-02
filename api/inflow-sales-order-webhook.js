import {
  extractSalesOrderIds,
  inflowFetch,
  makeMoNumber,
  quantityAsPositiveString,
  stableUuid,
  verifyInflowWebhook,
} from './_inflow.js';

async function getSalesOrder(salesOrderId) {
  const include = encodeURIComponent('lines.product');
  return inflowFetch(`sales-orders/${salesOrderId}?include=${include}`);
}

async function ensureQuickInvoice(order) {
  if (order?.isInvoiced === true) return { changed: false, reason: 'already-invoiced' };
  const updated = await inflowFetch(`sales-orders/${order.salesOrderId}/quick-invoice`, { method: 'POST' });
  return { changed: true, order: updated };
}

async function ensureManufactureOrder(order, line) {
  const quantity = quantityAsPositiveString(line);
  if (!quantity || line?.product?.isManufacturable !== true) return null;

  const locationId = order.locationId || String(process.env.INFLOW_DEFAULT_LOCATION_ID || '').trim();
  if (!locationId) {
    throw new Error(`Sales order ${order.orderNumber || order.salesOrderId} needs a location before a manufacture order can be created.`);
  }

  const manufacturingOrderId = stableUuid('precision-atv-mo', order.salesOrderId, line.salesOrderLineId || line.productId);
  const manufacturingOrderLineId = stableUuid('precision-atv-mo-line', manufacturingOrderId, line.productId);
  const manufacturingOrderNumber = makeMoNumber(order.orderNumber, line.lineNum, line.product?.sku);

  const body = {
    manufacturingOrderId,
    manufacturingOrderNumber,
    locationId,
    orderDate: order.orderDate || new Date().toISOString(),
    primaryFinishedProductId: line.productId,
    remarks: `Automatically created from sales order ${order.orderNumber || order.salesOrderId}. Source SO ID: ${order.salesOrderId}.`,
    lines: [
      {
        manufacturingOrderLineId,
        productId: line.productId,
        description: line.description || line.product?.name || line.product?.sku || undefined,
        quantity: {
          standardQuantity: quantity,
          uomQuantity: line.quantity?.uomQuantity ?? undefined,
          uom: line.quantity?.uom ?? undefined,
        },
      },
    ],
  };

  return inflowFetch('manufacturing-orders?fillDefaultBom=true', {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

async function processSalesOrder(salesOrderId) {
  const order = await getSalesOrder(salesOrderId);
  if (!order?.salesOrderId) throw new Error(`Unable to load inFlow sales order ${salesOrderId}`);
  if (order.isQuote || order.isCancelled) {
    return { salesOrderId, skipped: true, reason: order.isQuote ? 'quote' : 'cancelled' };
  }

  const invoice = await ensureQuickInvoice(order);
  const manufactureOrders = [];

  for (const line of order.lines || []) {
    if (line?.product?.isManufacturable !== true) continue;
    const created = await ensureManufactureOrder(order, line);
    if (created) {
      manufactureOrders.push({
        manufacturingOrderId: created.manufacturingOrderId,
        manufacturingOrderNumber: created.manufacturingOrderNumber,
        productId: line.productId,
      });
    }
  }

  return {
    salesOrderId,
    orderNumber: order.orderNumber,
    invoiced: invoice.changed || order.isInvoiced === true,
    invoiceChanged: invoice.changed,
    manufactureOrders,
  };
}

export async function POST(request) {
  const rawBody = await request.text();
  const signature = request.headers.get('x-inflow-hmac-sha256');

  if (!process.env.INFLOW_WEBHOOK_SECRET) {
    return Response.json({ error: 'Webhook secret is not configured.' }, { status: 503 });
  }
  if (!verifyInflowWebhook(rawBody, signature)) {
    return Response.json({ error: 'Invalid webhook signature.' }, { status: 401 });
  }

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return Response.json({ error: 'Invalid JSON payload.' }, { status: 400 });
  }

  const salesOrderIds = extractSalesOrderIds(payload);
  if (!salesOrderIds.length) {
    console.warn('inFlow webhook received without a recognizable salesOrderId', payload);
    return Response.json({ ok: true, processed: 0, note: 'No sales order ID found.' });
  }

  try {
    const results = [];
    for (const salesOrderId of salesOrderIds) {
      results.push(await processSalesOrder(salesOrderId));
    }
    return Response.json({ ok: true, processed: results.length, results });
  } catch (error) {
    console.error('inFlow sales-order automation failed', error);
    return Response.json({ error: 'inFlow order automation failed.', detail: error.message }, { status: 500 });
  }
}

export async function GET() {
  return Response.json({
    ok: true,
    integration: 'inflow-sales-order-webhook',
    configured: Boolean(process.env.INFLOW_COMPANY_ID && process.env.INFLOW_API_KEY && process.env.INFLOW_WEBHOOK_SECRET),
  });
}

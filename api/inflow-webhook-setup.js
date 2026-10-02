import crypto from 'node:crypto';
import { inflowFetch } from './_inflow.js';

function isAuthorized(request) {
  const expected = String(process.env.DASHBOARD_KEY || process.env.INTEGRATION_SETUP_KEY || '').trim();
  if (!expected) return false;
  const auth = request.headers.get('authorization') || '';
  return auth === `Bearer ${expected}`;
}

export async function POST(request) {
  if (!isAuthorized(request)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const webhookUrl = String(process.env.INFLOW_WEBHOOK_URL || `${url.origin}/api/inflow-sales-order-webhook`).trim();

  try {
    const existing = await inflowFetch('webhooks');
    const matching = Array.isArray(existing)
      ? existing.find((hook) => hook.url === webhookUrl && Array.isArray(hook.events) && hook.events.includes('salesOrder.created'))
      : null;

    if (matching && !matching.isDisabled) {
      return Response.json({
        ok: true,
        existing: true,
        webhookUrl,
        webHookSubscriptionId: matching.webHookSubscriptionId,
        events: matching.events,
        secretConfigured: Boolean(process.env.INFLOW_WEBHOOK_SECRET),
        nextStep: process.env.INFLOW_WEBHOOK_SECRET
          ? 'Webhook already exists and the local webhook secret is configured.'
          : 'A matching webhook already exists, but inFlow only returns its secret at creation. If the secret was not saved, delete the old subscription in inFlow and run setup again.',
      });
    }

    const body = {
      events: ['salesOrder.created'],
      url: webhookUrl,
      webHookSubscriptionId: crypto.randomUUID(),
      webHookSubscriptionRequestId: crypto.randomUUID(),
    };

    const subscription = await inflowFetch('webhooks', {
      method: 'PUT',
      body: JSON.stringify(body),
    });

    return Response.json({
      ok: true,
      existing: false,
      webhookUrl,
      webHookSubscriptionId: subscription.webHookSubscriptionId,
      events: subscription.events,
      secret: subscription.secret,
      nextStep: 'Store the returned secret as INFLOW_WEBHOOK_SECRET in your Vercel environment, then redeploy. inFlow returns this secret only when the subscription is created.',
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: error.status || 500 });
  }
}

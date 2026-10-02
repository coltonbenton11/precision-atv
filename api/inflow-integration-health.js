import { inflowFetch, getInflowConfig } from './_inflow.js';

function isAuthorized(request) {
  const expected = String(process.env.DASHBOARD_KEY || process.env.INTEGRATION_SETUP_KEY || '').trim();
  if (!expected) return false;
  return (request.headers.get('authorization') || '') === `Bearer ${expected}`;
}

export async function GET(request) {
  if (!isAuthorized(request)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const config = getInflowConfig();
  const checks = {
    companyId: Boolean(config.companyId),
    apiKey: Boolean(config.apiKey),
    webhookSecret: Boolean(process.env.INFLOW_WEBHOOK_SECRET),
    defaultLocation: Boolean(process.env.INFLOW_DEFAULT_LOCATION_ID),
  };

  if (!checks.companyId || !checks.apiKey) {
    return Response.json({ ok: false, checks, apiReachable: false });
  }

  try {
    const webhooks = await inflowFetch('webhooks');
    const salesOrderWebhook = Array.isArray(webhooks)
      ? webhooks.find((hook) => Array.isArray(hook.events) && hook.events.includes('salesOrder.created'))
      : null;

    return Response.json({
      ok: Boolean(salesOrderWebhook && !salesOrderWebhook.isDisabled),
      checks,
      apiReachable: true,
      salesOrderWebhook: salesOrderWebhook ? {
        id: salesOrderWebhook.webHookSubscriptionId,
        url: salesOrderWebhook.url,
        disabled: salesOrderWebhook.isDisabled,
        consecutiveFailureCount: salesOrderWebhook.consecutiveFailureCount,
        lastFailureMessage: salesOrderWebhook.lastFailureMessage,
      } : null,
    });
  } catch (error) {
    return Response.json({ ok: false, checks, apiReachable: false, error: error.message }, { status: 502 });
  }
}

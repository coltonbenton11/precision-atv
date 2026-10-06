const SUPABASE_URL = 'https://mlceccanwzlknlqtgoev.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Aa9gRaUv2HRIUFgEFcFN6g_R_idzmEo';

function bearer(req) {
  const value = String(req.headers.authorization || '');
  const match = value.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : '';
}

async function verifyManager(token) {
  if (!token) return false;

  const userRes = await fetch(SUPABASE_URL + '/auth/v1/user', {
    headers: {
      apikey: SUPABASE_KEY,
      authorization: 'Bearer ' + token,
    },
  });
  if (!userRes.ok) return false;
  const user = await userRes.json();
  if (!user?.id) return false;

  const profileRes = await fetch(
    SUPABASE_URL + '/rest/v1/profiles?id=eq.' + encodeURIComponent(user.id) + '&select=role,active&limit=1',
    {
      headers: {
        apikey: SUPABASE_KEY,
        authorization: 'Bearer ' + token,
      },
    },
  );
  if (!profileRes.ok) return false;
  const rows = await profileRes.json();
  const profile = Array.isArray(rows) ? rows[0] : null;
  return Boolean(profile?.active && ['owner', 'manager'].includes(profile.role));
}

function config() {
  const accountSid = String(process.env.TWILIO_ACCOUNT_SID || '').trim();
  const authToken = String(process.env.TWILIO_AUTH_TOKEN || '').trim();
  const fromNumber = String(process.env.TWILIO_FROM_NUMBER || '').trim();
  return { accountSid, authToken, fromNumber, configured: Boolean(accountSid && authToken && fromNumber) };
}

async function bodyJson(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return {}; }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  try {
    const twilio = config();
    const method = String(req.method || 'GET').toUpperCase();

    // Safe health check: only reports whether required variables exist.
    // This keeps the UI diagnostic independent of Supabase auth/networking.
    if (method === 'GET') {
      res.status(200).json({ configured: twilio.configured });
      return;
    }

    if (method !== 'POST') {
      res.setHeader('Allow', 'GET, POST');
      res.status(405).json({ error: 'Method not allowed.' });
      return;
    }

    let allowed = false;
    try {
      allowed = await verifyManager(bearer(req));
    } catch (error) {
      console.error('Supabase manager verification failed', error);
      res.status(502).json({ error: 'Could not verify Production access. Please sign out and back in, then retry.' });
      return;
    }

    if (!allowed) {
      res.status(403).json({ error: 'Manager or owner access required.' });
      return;
    }

    if (!twilio.configured) {
      res.status(503).json({ error: 'Twilio environment variables are not configured for this Production deployment.' });
      return;
    }

    const body = await bodyJson(req);
    let to = String(body?.to || '').replace(/[^\d+]/g, '');
    if (/^\d{10}$/.test(to)) to = '+1' + to;
    else if (/^1\d{10}$/.test(to)) to = '+' + to;
    if (!/^\+[1-9]\d{7,14}$/.test(to)) {
      res.status(400).json({ error: 'Enter a valid phone number. A 10-digit US number is accepted.' });
      return;
    }

    const params = new URLSearchParams();
    params.set('To', to);
    params.set('From', twilio.fromNumber);
    params.set('Body', 'Precision ATV Production test: Twilio SMS is connected and working.');

    const auth = Buffer.from(twilio.accountSid + ':' + twilio.authToken).toString('base64');
    const response = await fetch(
      'https://api.twilio.com/2010-04-01/Accounts/' + encodeURIComponent(twilio.accountSid) + '/Messages.json',
      {
        method: 'POST',
        headers: {
          authorization: 'Basic ' + auth,
          'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
        },
        body: params.toString(),
      },
    );

    const text = await response.text();
    let data = {};
    try { data = text ? JSON.parse(text) : {}; } catch { data = { message: text }; }

    if (!response.ok) {
      res.status(response.status >= 400 && response.status < 500 ? response.status : 502).json({
        error: data?.message || 'Twilio rejected the test message.',
        code: data?.code || null,
      });
      return;
    }

    res.status(200).json({
      success: true,
      sid: data?.sid || null,
      status: data?.status || 'queued',
    });
  } catch (error) {
    console.error('Precision Production Twilio endpoint failed', error);
    res.status(500).json({
      error: 'Twilio endpoint error.',
      detail: error instanceof Error ? error.message : String(error),
    });
  }
}

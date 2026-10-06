import { inflowConfigured, pullAllProducts, getInflowConfig } from './_inflow.js';

const SUPABASE_URL = 'https://mlceccanwzlknlqtgoev.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Aa9gRaUv2HRIUFgEFcFN6g_R_idzmEo';

function bearer(req) {
  const raw = String(req.headers?.authorization || '');
  const match = raw.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : '';
}

async function verifyManager(token) {
  if (!token) return false;
  const userRes = await fetch(SUPABASE_URL + '/auth/v1/user', {
    headers: { apikey: SUPABASE_KEY, authorization: 'Bearer ' + token },
  });
  if (!userRes.ok) return false;
  const user = await userRes.json();
  if (!user?.id) return false;

  const profileRes = await fetch(
    SUPABASE_URL + '/rest/v1/profiles?id=eq.' + encodeURIComponent(user.id) + '&select=role,active&limit=1',
    { headers: { apikey: SUPABASE_KEY, authorization: 'Bearer ' + token } },
  );
  if (!profileRes.ok) return false;
  const rows = await profileRes.json();
  const profile = Array.isArray(rows) ? rows[0] : null;
  return Boolean(profile?.active && ['owner','manager'].includes(profile.role));
}

export default async function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  try {
    const method=String(req.method||'GET').toUpperCase();
    const config=getInflowConfig();

    if(method==='GET'){
      return res.status(200).json({
        configured: inflowConfigured(),
        apiVersion: config.apiVersion,
        requirements: ['INFLOW_COMPANY_ID','INFLOW_API_KEY'],
      });
    }

    if(method!=='POST') return res.status(405).json({error:'Method not allowed.'});
    if(!(await verifyManager(bearer(req)))) return res.status(403).json({error:'Manager or owner access required.'});
    if(!inflowConfigured()) return res.status(503).json({error:'inFlow is not configured. Add INFLOW_COMPANY_ID and INFLOW_API_KEY to this Production Vercel project.'});

    const products=await pullAllProducts();
    const totals=products.reduce((acc,p)=>{
      acc.onHand+=Number(p.onHand||0);
      acc.available+=Number(p.available||0);
      acc.onOrder+=Number(p.onOrder||0);
      return acc;
    },{onHand:0,available:0,onOrder:0});

    return res.status(200).json({
      ok:true,
      pulledAt:new Date().toISOString(),
      count:products.length,
      totals,
      products,
    });
  }catch(error){
    console.error('Precision Production inFlow inventory pull failed',error);
    return res.status(error?.status&&error.status>=400&&error.status<600?error.status:500).json({
      error:error?.message||'Could not pull inventory from inFlow.'
    });
  }
}

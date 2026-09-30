import {createHash,timingSafeEqual} from 'node:crypto';
import {googleToken} from './_google.js';
import {metricsSnapshot} from './_metricsSnapshot.js';

async function ga(token){
  const id=process.env.GA4_PROPERTY_ID||'556833689';
  const body={dateRanges:[{startDate:'30daysAgo',endDate:'today'}],metrics:[{name:'activeUsers'},{name:'sessions'},{name:'ecommercePurchases'},{name:'purchaseRevenue'}]};
  const r=await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${id}:runReport`,{method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify(body)});
  const j=await r.json();if(!r.ok)throw new Error(j.error?.message||'GA4 request failed');
  const v=j.rows?.[0]?.metricValues||[];
  const pageBody={dateRanges:[{startDate:'30daysAgo',endDate:'today'}],dimensions:[{name:'landingPagePlusQueryString'}],metrics:[{name:'sessions'}],limit:10,orderBys:[{metric:{metricName:'sessions'},desc:true}]};
  const pr=await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${id}:runReport`,{method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify(pageBody)});
  const pj=await pr.json();
  return{propertyId:id,measurementId:'G-ND2GJ5FD6S',trackingConfigured:true,users:Number(v[0]?.value||0),sessions:Number(v[1]?.value||0),purchases:Number(v[2]?.value||0),revenue:Number(v[3]?.value||0),pages:(pj.rows||[]).map(x=>({page:x.dimensionValues?.[0]?.value||'',sessions:Number(x.metricValues?.[0]?.value||0)}))};
}
async function gsc(token){
  const site=process.env.GSC_SITE_URL||'sc-domain:precisionatvfab.com';
  const end=new Date(),start=new Date(Date.now()-29*86400000);const fmt=d=>d.toISOString().slice(0,10);
  const report=async dimensions=>{const r=await fetch(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(site)}/searchAnalytics/query`,{method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify({startDate:fmt(start),endDate:fmt(end),dimensions,rowLimit:10})});const j=await r.json();if(!r.ok)throw new Error(j.error?.message||'Search Console request failed');return j.rows||[]};
  const [q,p]=await Promise.all([report(['query']),report(['page'])]);
  return{queries:q.map(x=>({query:x.keys?.[0]||'',clicks:x.clicks||0,impressions:x.impressions||0,ctr:(x.ctr||0)*100,position:x.position||0})),pages:p.map(x=>({page:x.keys?.[0]||'',clicks:x.clicks||0,impressions:x.impressions||0,ctr:(x.ctr||0)*100,position:x.position||0}))};
}
export default async function handler(req,res){
  const supplied=String(req.headers['x-dashboard-key']||'');
  const expected=process.env.DASHBOARD_KEY;
  let authorized=false;
  if(expected){
    const a=Buffer.from(supplied),b=Buffer.from(expected);
    authorized=a.length===b.length&&timingSafeEqual(a,b);
  }else{
    const suppliedHash=createHash('sha256').update(supplied).digest('hex');
    const fallbackHash='a7fb265a91b2972e66d1869165a86196d61fcfeccecef7536848a5808725e28c';
    authorized=timingSafeEqual(Buffer.from(suppliedHash),Buffer.from(fallbackHash));
  }
  if(!authorized)return res.status(401).json({error:'Invalid dashboard key.'});
  const googleCredentialsConfigured=!!(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL&&process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY);
  let gaData=metricsSnapshot.ga,searchData=metricsSnapshot.search,warning=[],source='snapshot';
  if(googleCredentialsConfigured){
    try{
      const token=await googleToken();
      try{gaData=await ga(token)}catch(e){warning.push(`GA4: ${e.message}`)}
      try{const live=await gsc(token);searchData={...metricsSnapshot.search,...live}}catch(e){warning.push(`Search Console: ${e.message}`)}
      source='live';
    }catch(e){warning.push(e.message)}
  }
  return res.status(200).json({
    source,
    snapshotUpdatedAt:metricsSnapshot.updatedAt,
    gaConfigured:!!gaData?.trackingConfigured,
    gaReportingLive:googleCredentialsConfigured&&gaData?.users!==null,
    gscConfigured:true,
    ga:gaData,
    search:searchData,
    warning
  });
}

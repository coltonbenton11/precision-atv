import {googleToken} from './_google.js';
import {metricsSnapshot} from './_metricsSnapshot.js';
import {isAdmin} from './_adminAuth.js';

const SHOPIFY_API='2026-07';

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
let cachedAdminToken=null,cachedAdminTokenUntil=0;
async function shopifyAdminToken(){
  if(process.env.SHOPIFY_ADMIN_ACCESS_TOKEN)return process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;
  const clientId=process.env.SHOPIFY_ADMIN_CLIENT_ID,clientSecret=process.env.SHOPIFY_ADMIN_CLIENT_SECRET;
  const domain=process.env.SHOPIFY_STORE_DOMAIN||'precisionatv-com.myshopify.com';
  if(!clientId||!clientSecret)throw new Error('Shopify Admin reporting credentials are not configured');
  if(cachedAdminToken&&Date.now()<cachedAdminTokenUntil)return cachedAdminToken;
  const body=new URLSearchParams({grant_type:'client_credentials',client_id:clientId,client_secret:clientSecret});
  const r=await fetch(`https://${domain}/admin/oauth/access_token`,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body});
  const j=await r.json();if(!r.ok||!j.access_token)throw new Error(j.error_description||j.error||'Unable to authenticate Shopify Admin API');
  cachedAdminToken=j.access_token;cachedAdminTokenUntil=Date.now()+Math.max(60000,(Number(j.expires_in||3600)-300)*1000);return cachedAdminToken;
}
async function adminGraphql(query,variables={}){
  const domain=process.env.SHOPIFY_STORE_DOMAIN||'precisionatv-com.myshopify.com';
  const token=await shopifyAdminToken();
  const r=await fetch(`https://${domain}/admin/api/${SHOPIFY_API}/graphql.json`,{method:'POST',headers:{'content-type':'application/json','X-Shopify-Access-Token':token},body:JSON.stringify({query,variables})});
  const j=await r.json();if(!r.ok||j.errors)throw new Error(j.errors?.[0]?.message||'Shopify Admin API request failed');return j.data;
}
function rowObject(table){
  const cols=(table?.columns||[]).map(c=>c.name);const row=table?.rows?.[0]||{};
  if(!cols.length)return row;
  if(Array.isArray(row))return Object.fromEntries(cols.map((c,i)=>[c,row[i]]));
  return row;
}
async function shopifyReports(){
  const gql=`query DashboardReports($summary:String!,$products:String!,$traffic:String!){
    summary:shopifyqlQuery(query:$summary){tableData{columns{name dataType displayName}rows}parseErrors}
    products:shopifyqlQuery(query:$products){tableData{columns{name dataType displayName}rows}parseErrors}
    traffic:shopifyqlQuery(query:$traffic){tableData{columns{name dataType displayName}rows}parseErrors}
  }`;
  const variables={
    summary:'FROM sales SHOW total_sales, net_sales, orders, average_order_value, total_returns SINCE startOfDay(-30d) UNTIL today',
    products:'FROM sales SHOW net_sales, orders, net_items_sold, average_order_value GROUP BY product_title SINCE startOfDay(-30d) UNTIL today ORDER BY net_sales DESC LIMIT 10',
    traffic:'FROM sessions SHOW sessions, conversion_rate, online_store_visitors, sessions_with_cart_additions, sessions_that_reached_checkout, sessions_that_completed_checkout SINCE startOfDay(-30d) UNTIL today'
  };
  const d=await adminGraphql(gql,variables);
  const errors=[...(d.summary?.parseErrors||[]),...(d.products?.parseErrors||[]),...(d.traffic?.parseErrors||[])];
  if(errors.length)throw new Error(errors.join('; '));
  const summary=rowObject(d.summary?.tableData);
  const traffic=rowObject(d.traffic?.tableData);
  const cols=(d.products?.tableData?.columns||[]).map(c=>c.name);
  const products=(d.products?.tableData?.rows||[]).map(row=>Array.isArray(row)?Object.fromEntries(cols.map((c,i)=>[c,row[i]])):row);
  return{
    period:'Last 30 days',
    currency:'USD',
    totalSales:Number(summary.total_sales||0),
    netSales:Number(summary.net_sales||0),
    orders:Number(summary.orders||0),
    averageOrderValue:Number(summary.average_order_value||0),
    returns:Number(summary.total_returns||0),
    sessions:Number(traffic.sessions||0),
    conversionRate:Number(traffic.conversion_rate||0),
    visitors:Number(traffic.online_store_visitors||0),
    cartSessions:Number(traffic.sessions_with_cart_additions||0),
    checkoutSessions:Number(traffic.sessions_that_reached_checkout||0),
    completedCheckoutSessions:Number(traffic.sessions_that_completed_checkout||0),
    topProducts:products.map(x=>({title:x.product_title||'',netSales:Number(x.net_sales||0),orders:Number(x.orders||0),items:Number(x.net_items_sold||0),averageOrderValue:Number(x.average_order_value||0)}))
  };
}
async function shopifyOrderFallback(){
  const since=new Date(Date.now()-30*86400000).toISOString();
  const q=`query RecentOrders($after:String,$query:String!){orders(first:100,after:$after,sortKey:CREATED_AT,reverse:true,query:$query){pageInfo{hasNextPage endCursor}nodes{id name createdAt cancelledAt currentTotalPriceSet{shopMoney{amount currencyCode}} currentSubtotalPriceSet{shopMoney{amount currencyCode}} totalRefundedSet{shopMoney{amount currencyCode}}}}}`;
  let after=null,orders=[],loops=0;
  do{
    const d=await adminGraphql(q,{after,query:`created_at:>=${since}`});const block=d.orders;orders.push(...(block?.nodes||[]));after=block?.pageInfo?.hasNextPage?block.pageInfo.endCursor:null;loops++;
  }while(after&&loops<5);
  const active=orders.filter(o=>!o.cancelledAt);const currency=active[0]?.currentTotalPriceSet?.shopMoney?.currencyCode||'USD';
  const totalSales=active.reduce((s,o)=>s+Number(o.currentTotalPriceSet?.shopMoney?.amount||0),0);
  const returns=active.reduce((s,o)=>s+Number(o.totalRefundedSet?.shopMoney?.amount||0),0);
  return{period:'Last 30 days',currency,totalSales,netSales:null,orders:active.length,averageOrderValue:active.length?totalSales/active.length:0,returns,sessions:null,conversionRate:null,visitors:null,cartSessions:null,checkoutSessions:null,completedCheckoutSessions:null,topProducts:[]};
}
async function shopify(){
  try{return{data:await shopifyReports(),source:'shopifyql',warning:null}}
  catch(e){try{return{data:await shopifyOrderFallback(),source:'orders',warning:'ShopifyQL unavailable; using order totals. '+e.message}}catch(f){throw new Error(f.message)}}
}
export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(!isAdmin(req))return res.status(401).json({error:'Admin login required.'});
  const googleCredentialsConfigured=!!(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL&&process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY);
  const shopifyConfigured=!!(process.env.SHOPIFY_ADMIN_ACCESS_TOKEN||(process.env.SHOPIFY_ADMIN_CLIENT_ID&&process.env.SHOPIFY_ADMIN_CLIENT_SECRET));
  let gaData=metricsSnapshot.ga,searchData=metricsSnapshot.search,warning=[],source='snapshot',commerce=null,commerceSource=null;
  if(googleCredentialsConfigured){
    try{
      const token=await googleToken();
      try{gaData=await ga(token)}catch(e){warning.push(`GA4: ${e.message}`)}
      try{const live=await gsc(token);searchData={...metricsSnapshot.search,...live}}catch(e){warning.push(`Search Console: ${e.message}`)}
      source='live';
    }catch(e){warning.push(e.message)}
  }
  if(shopifyConfigured){
    try{const s=await shopify();commerce=s.data;commerceSource=s.source;if(s.warning)warning.push(s.warning)}catch(e){warning.push(`Shopify: ${e.message}`)}
  }
  return res.status(200).json({
    source,snapshotUpdatedAt:metricsSnapshot.updatedAt,
    gaConfigured:!!gaData?.trackingConfigured,gaReportingLive:googleCredentialsConfigured&&gaData?.users!==null,gscConfigured:true,
    shopifyConfigured,shopifyReportingLive:!!commerce,commerceSource,
    ga:gaData,search:searchData,commerce,warning
  });
}

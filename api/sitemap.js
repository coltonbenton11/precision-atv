const API_VERSION='2026-07';
const BASE='https://precisionatvfab.com';
function xml(value=''){return String(value).replace(/[<>&'"]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;',"'":'&apos;','"':'&quot;'}[c]))}
async function gql(domain,token,query,variables){const r=await fetch(`https://${domain}/api/${API_VERSION}/graphql.json`,{method:'POST',headers:{'content-type':'application/json','X-Shopify-Storefront-Access-Token':token},body:JSON.stringify({query,variables})});const j=await r.json();if(j.errors)throw new Error(j.errors[0]?.message||'Shopify error');return j.data}
export default async function handler(req,res){
 const raw=process.env.SHOPIFY_STORE_DOMAIN||'';const domain=raw.replace(/^https?:\/\//,'').replace(/\/$/,'');const token=process.env.SHOPIFY_STOREFRONT_TOKEN||process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN||process.env.SHOPIFY_STOREFRONT_PUBLIC_ACCESS_TOKEN;
 const staticUrls=[
  {loc:BASE+'/',priority:'1.0',changefreq:'weekly'},
  {loc:BASE+'/shop',priority:'0.9',changefreq:'daily'},
  {loc:BASE+'/services',priority:'0.9',changefreq:'monthly'},
  {loc:BASE+'/about',priority:'0.7',changefreq:'monthly'},
  {loc:BASE+'/contact',priority:'0.7',changefreq:'monthly'}
 ];
 let products=[],collections=[];
 if(domain&&token){
  try{
   const pq=`query Products($after:String){products(first:100,after:$after,sortKey:UPDATED_AT){pageInfo{hasNextPage endCursor}nodes{handle updatedAt}}}`;let after=null,loops=0;
   do{const d=await gql(domain,token,pq,{after});const x=d.products;products.push(...(x?.nodes||[]));after=x?.pageInfo?.hasNextPage?x.pageInfo.endCursor:null;loops++}while(after&&loops<20);
   const cq=`query Collections($after:String){collections(first:100,after:$after,sortKey:UPDATED_AT){pageInfo{hasNextPage endCursor}nodes{handle updatedAt}}}`;after=null;loops=0;
   do{const d=await gql(domain,token,cq,{after});const x=d.collections;collections.push(...(x?.nodes||[]));after=x?.pageInfo?.hasNextPage?x.pageInfo.endCursor:null;loops++}while(after&&loops<10);
  }catch(e){}
 }
 const excluded=new Set(['all','best-selling-products','newest-products']);
 const rows=[
  ...staticUrls.map(u=>`<url><loc>${xml(u.loc)}</loc><changefreq>${u.changefreq}</changefreq><priority>${u.priority}</priority></url>`),
  ...products.map(p=>`<url><loc>${xml(BASE+'/products/'+p.handle)}</loc>${p.updatedAt?`<lastmod>${xml(p.updatedAt)}</lastmod>`:''}<changefreq>weekly</changefreq><priority>0.8</priority></url>`),
  ...collections.filter(c=>!excluded.has(c.handle)).map(c=>`<url><loc>${xml(BASE+'/collections/'+c.handle)}</loc>${c.updatedAt?`<lastmod>${xml(c.updatedAt)}</lastmod>`:''}<changefreq>weekly</changefreq><priority>0.6</priority></url>`)
 ];
 res.setHeader('Content-Type','application/xml; charset=utf-8');res.setHeader('Cache-Control','public, s-maxage=3600, stale-while-revalidate=86400');return res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${rows.join('')}</urlset>`);
}
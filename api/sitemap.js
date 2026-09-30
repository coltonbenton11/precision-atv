const API_VERSION='2026-07';
const BASE='https://precisionatvfab.com';
function xml(value=''){return String(value).replace(/[<>&'"]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;',"'":'&apos;','"':'&quot;'}[c]))}
export default async function handler(req,res){
  const domain=process.env.SHOPIFY_STORE_DOMAIN,token=process.env.SHOPIFY_STOREFRONT_TOKEN;
  const staticUrls=[
    {loc:BASE+'/',priority:'1.0',changefreq:'weekly'},
    {loc:BASE+'/shop',priority:'0.9',changefreq:'daily'},
    {loc:BASE+'/services',priority:'0.8',changefreq:'monthly'}
  ];
  let products=[];
  if(domain&&token){
    const query=`query SitemapProducts($after:String){products(first:100,after:$after,sortKey:UPDATED_AT){pageInfo{hasNextPage endCursor}nodes{handle updatedAt}}}`;
    try{
      let after=null,loops=0;
      do{
        const r=await fetch(`https://${domain}/api/${API_VERSION}/graphql.json`,{method:'POST',headers:{'content-type':'application/json','X-Shopify-Storefront-Access-Token':token},body:JSON.stringify({query,variables:{after}})});
        const j=await r.json();if(j.errors)throw new Error(j.errors[0]?.message||'Shopify error');
        const block=j.data?.products;products.push(...(block?.nodes||[]));after=block?.pageInfo?.hasNextPage?block.pageInfo.endCursor:null;loops++;
      }while(after&&loops<20);
    }catch(e){}
  }
  const rows=[
    ...staticUrls.map(u=>`<url><loc>${xml(u.loc)}</loc><changefreq>${u.changefreq}</changefreq><priority>${u.priority}</priority></url>`),
    ...products.map(p=>`<url><loc>${xml(BASE+'/products/'+p.handle)}</loc>${p.updatedAt?`<lastmod>${xml(p.updatedAt)}</lastmod>`:''}<changefreq>weekly</changefreq><priority>0.7</priority></url>`)
  ];
  res.setHeader('Content-Type','application/xml; charset=utf-8');res.setHeader('Cache-Control','public, s-maxage=3600, stale-while-revalidate=86400');
  return res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${rows.join('')}</urlset>`);
}

const API_VERSION='2026-07';
const BASE='https://precisionatvfab.com';
const SECTIONS={
  polaris:{
    title:'Polaris Remanufactured & Rebuilt Engines | Precision ATV',
    h1:'Polaris Rebuilt Engines',
    description:'Shop Polaris Ranger, RZR, Sportsman and General remanufactured engines from Precision ATV in Conroe, Texas. Built and tested with fitment support.',
    lead:'Find rebuilt and remanufactured Polaris engine assemblies for Ranger, RZR, Sportsman and other supported Polaris applications. Our team can help confirm year, model, and engine fitment before ordering.',
    path:'/engines/polaris',
    isMatch:p=>isEngine(p.title)&&/polaris|rzr|ranger|sportsman|scrambler/i.test(p.title)
  },
  'can-am':{
    title:'Can-Am Remanufactured & Rebuilt Engines | Precision ATV',
    h1:'Can-Am Rebuilt Engines',
    description:'Shop rebuilt Can-Am Defender, Maverick, Outlander and Renegade engines from Precision ATV. Engine builds and fitment guidance in Conroe, Texas.',
    lead:'Browse remanufactured Can-Am engines for Defender, Maverick, Outlander, Renegade and other supported applications. Confirm the year, trim, and engine before purchase.',
    path:'/engines/can-am',
    isMatch:p=>isEngine(p.title)&&/can-am|canam/i.test(p.title)
  },
  parts:{
    title:'ATV & UTV Rebuild Kits and Engine Parts | Precision ATV',
    h1:'Rebuild Kits & Parts',
    description:'Shop ATV and UTV engine rebuild kits, Namura top-end kits, cylinders, pistons and engine components for Polaris, Can-Am and other powersports applications.',
    lead:'Shop rebuild kits and engine parts, including model-specific Namura top-end kits, pistons, cylinders, gaskets and related engine components. Search by part number, vehicle make, model or year to narrow fitment.',
    path:'/rebuild-kits-parts',
    isMatch:p=>!isEngine(p.title)&&!/(?:\\becu\\b|reflash|tuning)/i.test(p.title)
  }
};
function isEngine(s=''){return /remanufactured|rebuilt engine|remanufactored|long.block/i.test(s)}
function esc(s=''){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
async function products(domain,token){
  const list=[];let cursor=null;
  const query=`query Catalog($after:String){products(first:100,after:$after){nodes{id title handle productType featuredImage{url altText} variants(first:4){nodes{availableForSale price{amount currencyCode}}}} pageInfo{hasNextPage endCursor}}}`;
  for(let i=0;i<8;i++){
    const response=await fetch(`https://${domain}/api/${API_VERSION}/graphql.json`,{method:'POST',headers:{'content-type':'application/json','X-Shopify-Storefront-Access-Token':token},body:JSON.stringify({query,variables:{after:cursor}})});
    if(!response.ok)throw new Error('Shopify catalog unavailable');
    const json=await response.json();
    if(json.errors)throw new Error(json.errors[0]?.message||'Shopify catalog error');
    const p=json.data?.products;list.push(...(p?.nodes||[]));
    if(!p?.pageInfo?.hasNextPage)break;
    cursor=p.pageInfo.endCursor;if(!cursor)break;
  }
  return list;
}
export default async function handler(req,res){
  const section=SECTIONS[String(req.query.section||'')];
  if(!section)return res.status(404).send('Not found');
  const domain=String(process.env.SHOPIFY_STORE_DOMAIN||'').replace(/^https?:\\/\\//,'').replace(/\\/$/,'');
  const token=process.env.SHOPIFY_STOREFRONT_TOKEN||process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN||process.env.SHOPIFY_STOREFRONT_PUBLIC_ACCESS_TOKEN;
  let all=[],message='';
  if(domain&&token){try{all=await products(domain,token)}catch(e){message='Catalog temporarily unavailable; please use our full shop or call for current availability.'}}
  else message='Live catalog temporarily unavailable.';
  const filtered=all.filter(section.isMatch);
  const cards=filtered.map(p=>{
    const variant=p.variants?.nodes?.find(v=>v.availableForSale)||p.variants?.nodes?.[0];
    const price=variant?.price?.amount ? new Intl.NumberFormat('en-US',{style:'currency',currency:variant.price.currencyCode||'USD'}).format(Number(variant.price.amount)):'Call for price';
    return `<article class="product"><a class="product-card-link" href="/products/${encodeURIComponent(p.handle)}"><div class="product-media">${p.featuredImage?.url?`<img loading="lazy" src="${esc(p.featuredImage.url)}" alt="${esc(p.featuredImage.altText||p.title)}">`:'PRECISION ATV'}</div><div class="product-body"><div class="product-type">${esc(p.productType||'Engine parts')}</div><div class="product-title">${esc(p.title)}</div><div class="price">${esc(price)}</div><span class="btn">View details</span></div></a></article>`;
  }).join('');
  const canonical=BASE+section.path;
  const related='<nav class="shop-category-links" aria-label="Engine and parts categories"><a href="/engines/polaris">Polaris Engines</a><a href="/engines/can-am">Can-Am Engines</a><a href="/rebuild-kits-parts">Rebuild Kits &amp; Parts</a><a href="/shop">Full Catalog</a></nav>';
  const schema={'@context':'https://schema.org','@type':'CollectionPage',name:section.h1,url:canonical,description:section.description};
  const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(section.title)}</title><meta name="description" content="${esc(section.description)}"><meta name="robots" content="index,follow"><link rel="canonical" href="${esc(canonical)}"><meta property="og:type" content="website"><meta property="og:title" content="${esc(section.title)}"><meta property="og:description" content="${esc(section.description)}"><meta property="og:url" content="${esc(canonical)}"><script type="application/ld+json">${JSON.stringify(schema)}</script><link rel="stylesheet" href="/styles.css"></head><body><div class="topbar"><div class="wrap">CONROE, TEXAS • ENGINE BUILDS & PARTS</div></div><nav class="nav"><div class="wrap"><a class="brand" href="/">PRECISION <span>ATV</span></a><div class="navlinks"><a href="/shop">Shop</a><a href="/services">Engine Builds &amp; Tuning</a><a href="/about">About</a><a href="/contact">Contact</a></div></div></nav><header class="page-hero"><div class="wrap"><div class="kicker">Precision ATV • Shop by application</div><h1>${esc(section.h1)}</h1><p class="muted">${esc(section.lead)}</p>${related}</div></header><section><div class="wrap"><h2>Browse ${esc(section.h1.toLowerCase())}</h2>${message?`<p>${esc(message)}</p>`:''}<div class="product-grid">${cards||'<p>Contact the shop for help locating compatible products.</p>'}</div></div></section><section class="band"><div class="wrap"><div><h2>Need help matching your engine?</h2><p>Confirm your model, VIN and engine variant before ordering any rebuild components.</p></div><a class="btn" href="tel:+19362287655">Call (936) 228-7655</a></div></section><footer class="footer"><div class="wrap footer-grid"><div class="brand">PRECISION ATV • CONROE, TX</div><a href="/shop">Shop all products</a></div></footer></body></html>`;
  res.setHeader('Content-Type','text/html; charset=utf-8');
  res.setHeader('Cache-Control','public, s-maxage=180, stale-while-revalidate=900');
  return res.status(200).send(html);
}

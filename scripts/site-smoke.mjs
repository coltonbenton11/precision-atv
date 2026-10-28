import fs from 'node:fs';
const base='https://precisionatvfab.com',shop='https://shop.precisionatvfab.com';
const urls=[
['shopify-home',base+'/'],['shopify-contact',base+'/pages/contact'],['shopify-returns',base+'/pages/return-policy'],
['old-browse-models',base+'/pages/choose-your-brand'],['shop-root',shop+'/'],['shop-catalog',shop+'/shop'],
['shop-cart',shop+'/cart'],['shop-dealer',shop+'/dealer'],['shop-product',shop+'/products/2017-2026-can-am-defender-hd10-remanufactured-engine'],
['shop-about',shop+'/about'],['shop-services',shop+'/services'],['shop-products-api',shop+'/api/products?all=1'],['shop-robots',shop+'/robots.txt'],['shop-sitemap',shop+'/sitemap.xml'],
['shop-main-policy',shop+'/policies/refund-policy'],['shopify-main-product',base+'/products/2017-2026-can-am-defender-hd10-remanufactured-engine']];
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const results=[];
for(const [name,url] of urls){
  const entry={name,url};
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),22000);
  try{
    const r=await fetch(url,{redirect:'manual',signal:controller.signal,headers:{'user-agent':'Mozilla/5.0 (compatible; PrecisionATV-SmokeTest/1.0)','accept':'text/html,application/json,text/plain,*/*'}});
    entry.status=r.status;entry.location=r.headers.get('location')||'';
    entry.contentType=r.headers.get('content-type')||'';
    entry.cacheControl=r.headers.get('cache-control')||'';
    entry.server=r.headers.get('server')||'';
    entry.vercelId=r.headers.get('x-vercel-id')?'present':'';
    let body=await r.text();entry.bytes=body.length;
    entry.title=(body.match(/<title[^>]*>([\s\S]*?)<\/title>/i)||[])[1]?.trim()?.slice(0,110)||'';
    entry.headerBrowseModels=/(<a\b[^>]*>Browse Models<\/a>)/i.test(body);
    entry.hardcodedVercelLinks=[...new Set((body.match(/(?:https?:\/\/)?[\w.-]+\.vercel\.app(?:\/[\w./-]*)?/gi)||[]))].slice(0,5);
    entry.brandShopLink=body.includes('https://shop.precisionatvfab.com/shop');
    entry.dealerLogin=body.includes('Dealer Login');
    entry.cartLink=body.includes('href="/cart"');
    entry.productFeed=body.includes('/api/products?all=1');
    if(name==='shop-products-api'){
      try{
        const j=JSON.parse(body);entry.mode=j.mode;entry.productCount=j.products?.length;entry.total=j.total;entry.sample=j.products?.filter(x=>/RANGER XP 900|RZR XP 1000|Defender HD10/i.test(x.title)).slice(0,5).map(x=>({handle:x.handle,title:x.title,image:x.image,available:x.available}));
        entry.error=j.error||null;
      }catch(e){entry.error='Non-JSON data: '+body.slice(0,220)}
    }
    if(name==='shop-main-policy')entry.redirectToMyShopify=entry.location.includes('myshopify.com');
  }catch(e){entry.error=String(e).slice(0,200)}
  finally{clearTimeout(timer)}
  results.push(entry);
  await sleep(1100);
}
const lines=['# Precision ATV live storefront smoke test','','Generated: '+new Date().toISOString(),'',...results.map(r=>'- **'+r.name+'**: HTTP '+(r.status||'error')+' '+(r.title||'')+' '+(r.location?'→ '+r.location:'')+' '+(r.error?'Error: '+r.error:'')),'','## Inspection JSON','Detailed test results in site-smoke.json'];
fs.writeFileSync('site-smoke.json',JSON.stringify({runAt:new Date().toISOString(),results},null,2));
fs.writeFileSync('site-smoke.md',lines.join('\n'));
console.log(lines.join('\n'));console.log('---START_ESSENTIAL_JSON---');console.log(JSON.stringify(results.map(x=>({name:x.name,status:x.status,location:x.location,bytes:x.bytes,title:x.title,brandShopLink:x.brandShopLink,headerBrowseModels:x.headerBrowseModels,hardcodedVercelLinks:x.hardcodedVercelLinks,dealerLogin:x.dealerLogin,cartLink:x.cartLink,mode:x.mode,productCount:x.productCount,total:x.total,error:x.error,sample:x.sample})),null,2));console.log('---END_ESSENTIAL_JSON---');

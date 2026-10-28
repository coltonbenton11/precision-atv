import fs from 'node:fs';
const site='https://precisionatvfab.com';
const paths=['/','/collections/engine','/collections/piston-kits-components','/collections/rzr-1000','/collections/rzr-xp-turbo','/collections/rzr-turbo-s','/collections/rzr-pro-xp','/collections/rzr-900','/collections/rzr-rs1','/collections/polaris-ranger-1000-sohc','/collections/ranger-xp-900','/collections/canam','/collections/canam-defender-hd10','/collections/canam-outlander-1000','/collections/canam-renegade-1000','/collections/all','/pages/about-us-1','/pages/contact','/pages/dyno-tune','/pages/precision-atv-core-return-policy','/pages/return-policy','/blogs/news/8-budget-friendly-atv-utv-performance-tips','/blogs/news/atv-utv-engine-tuning-guide','/blogs/news/atv-utv-tire-selection-guide','/products/2017-2026-can-am-defender-hd10-remanufactured-engine','/products/2012-2015-can-am-outlander-800-remanufactured-engine','/products/2017-2026-can-am-maverick-x3-remanufactured-engine'];
const pause=ms=>new Promise(done=>setTimeout(done,ms));
const clean=x=>String(x||'').replace(/<[^>]+>/g,' ').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();
const attr=(tag,name)=>(tag.match(new RegExp('\\b'+name+'\\s*=\\s*["\\x27]([^"\\x27]+)["\\x27]','i'))||[])[1]||'';
const meta=(html,key,val)=>[...html.matchAll(/<meta\b[^>]*>/gi)].map(x=>x[0]).filter(x=>attr(x,key).toLowerCase()===val.toLowerCase()).map(x=>attr(x,'content'))[0]||'';
const can=html=>[...html.matchAll(/<link\b[^>]*>/gi)].map(x=>x[0]).filter(x=>attr(x,'rel').toLowerCase()==='canonical').map(x=>attr(x,'href'))[0]||'';
async function get(url){const a=new AbortController(),t=setTimeout(()=>a.abort(),18000);try{const r=await fetch(url,{redirect:'follow',signal:a.signal,headers:{'user-agent':'PrecisionATV-SEO-Verification/1.0','accept':'text/html,*/*;q=0.7'}});return {status:r.status,url:r.url,html:await r.text()}}finally{clearTimeout(t)}}
const results=[];let throttled=0;
for(const path of paths){
 let obj={url:site+path,issues:[]};
 try{
  const r=await get(obj.url);obj.status=r.status;obj.finalUrl=r.url;
  if(r.status===429){obj.issues.push('HTTP_429');throttled++;}else if(r.status===200){
   const html=r.html;
   obj.title=clean((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)||[])[1]||'');
   obj.description=meta(html,'name','description');
   obj.canonical=can(html);
   obj.robots=meta(html,'name','robots');
   obj.ogDescription=meta(html,'property','og:description');
   obj.h1=(html.match(/<h1\b/gi)||[]).length;
   obj.schema=(html.match(/<script[^>]+type\s*=\s*["']application\/ld\+json["']/gi)||[]).length;
   obj.oldAdminNav=/<a[^>]+\/admin[^>]*>\s*Admin\s*<\/a>/i.test(html);
   obj.legacyName=/<footer[\s\S]*?PRECISION ATV FAB/i.test(html);
   if(!obj.title||obj.title.length>65||obj.title.length<20)obj.issues.push('TITLE_LENGTH_OR_MISSING');
   if(!obj.description)obj.issues.push('MISSING_DESCRIPTION');
   if(!obj.canonical)obj.issues.push('MISSING_CANONICAL');
   if(obj.h1!==1)obj.issues.push('H1_COUNT_'+obj.h1);
   if(!obj.schema)obj.issues.push('MISSING_SCHEMA');
   if(!obj.ogDescription)obj.issues.push('MISSING_OG_DESCRIPTION');
   if(obj.oldAdminNav)obj.issues.push('PUBLIC_ADMIN_NAV');
   if(obj.legacyName)obj.issues.push('LEGACY_FAB_FOOTER');
   if(/noindex/i.test(obj.robots))obj.issues.push('NOINDEX');
  }else obj.issues.push('HTTP_'+r.status);
 }catch(e){obj.issues.push('FETCH_FAILED');obj.error=String(e).slice(0,150)}
 results.push(obj);
 if(throttled>=3){console.log('Stopping after three HTTP 429 responses to respect throttling');break}
 await pause(1400);
}
const tally={};for(const r of results)for(const x of r.issues)tally[x]=(tally[x]||0)+1;
const report={generatedAt:new Date().toISOString(),pages:results.length,ok200:results.filter(x=>x.status===200).length,rateLimited:results.filter(x=>x.status===429).length,issueCount:tally,results};
fs.writeFileSync('seo-focus.json',JSON.stringify(report,null,2));
const lines=['# Precision ATV priority-page live SEO check','', 'Generated: '+report.generatedAt,'URLs checked: '+report.pages,'HTTP 200: '+report.ok200,'HTTP 429: '+report.rateLimited,'','## Issues',...Object.entries(tally).map(x=>'- '+x[0]+': '+x[1]),'','## Page details',...results.map(x=>'- '+x.url+' HTTP '+(x.status||'error')+' — '+(x.issues.join(', ')||'OK')+(x.title?' ['+x.title.slice(0,72)+']':'')),'','These checks confirm public HTML markup; they cannot confirm Google indexing.'];
fs.writeFileSync('seo-focus.md',lines.join('\n'));console.log(lines.join('\n'));

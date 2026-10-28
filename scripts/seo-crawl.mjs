import fs from 'node:fs';
const ROOT = 'https://precisionatvfab.com';
const MAX = 500;
const sleep = ms => new Promise(resolve => setTimeout(resolve,ms));
const normalize = s => String(s||'').replace(/&amp;/g,'&').replace(/&#39;/g,"'").replace(/&quot;/g,'"').replace(/&#x27;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').trim();
const strip = s => normalize(s.replace(/<[^>]*>/g,' ').replace(/\s+/g,' '));
const xmlLocs = s => [...s.matchAll(/<loc[^>]*>([\s\S]*?)<\/loc>/gi)].map(x=>normalize(x[1]));
const source = u => /\/products\//.test(u)?'product':/\/collections\//.test(u)?'collection':/\/pages\//.test(u)?'page':/\/blogs\//.test(u)?'blog':u===ROOT+'/ ' ? 'home':u===ROOT+'/ ' ?'home':new URL(u).pathname==='/'?'home':'other';
async function load(url){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),20000);
  try{
    const res=await fetch(url,{redirect:'follow',signal:controller.signal,headers:{'User-Agent':'PrecisionATV-SEO-Audit/1.0 (+https://precisionatvfab.com)','Accept':'text/html,application/xml,text/xml;q=0.9,*/*;q=0.8'}});
    const body=await res.text();
    return {status:res.status,final:res.url,headers:res.headers,body:body.slice(0,1500000)};
  }finally{clearTimeout(timer)}
}
function meta(html,key,value){
  const tags=[...html.matchAll(/<meta\b[^>]*>/gi)].map(x=>x[0]);
  for(const tag of tags){
    if(new RegExp('\\b'+key+'\\s*=\\s*["\\x27]'+value+'["\\x27]','i').test(tag)){
      const c=tag.match(/\bcontent\s*=\s*["']([^"']*)["']/i);
      return c?normalize(c[1]):'';
    }
  }
  return '';
}
function canonical(html){
  for(const m of html.matchAll(/<link\b[^>]*>/gi)){
    if(/\brel\s*=\s*["']canonical["']/i.test(m[0]))return normalize((m[0].match(/\bhref\s*=\s*["']([^"']+)["']/i)||[])[1]||'');
  }
  return '';
}
async function main(){
  const starts=[ROOT+'/sitemap.xml'];
  const seenMaps=new Set(),candidates=new Set([ROOT+'/']),mapErrors=[];
  while(starts.length && seenMaps.size<25){
    const url=starts.shift();if(seenMaps.has(url))continue;seenMaps.add(url);
    try{
      const r=await load(url);
      if(r.status!==200){mapErrors.push(url+' HTTP '+r.status);continue}
      const locs=xmlLocs(r.body);
      if(/<sitemapindex/i.test(r.body)){
        for(const u of locs)if(u.startsWith(ROOT+'/')&&!seenMaps.has(u))starts.push(u);
      }else if(/<urlset/i.test(r.body)){
        for(const u of locs){
          try{
            const x=new URL(u);if(x.host==='precisionatvfab.com' && (x.protocol==='https:'||x.protocol==='http:'))candidates.add(x.origin+x.pathname);
          }catch{}
        }
      }else mapErrors.push(url+' unexpected content');
    }catch(e){mapErrors.push(url+' '+String(e).slice(0,120))}
    await sleep(90);
  }
  const urls=[...candidates].slice(0,MAX);
  let pointer=0;
  const results=[];
  async function worker(){
    while(pointer<urls.length){
      const url=urls[pointer++];const item={url,type:source(url),issues:[]};
      try{
        const r=await load(url);
        item.status=r.status;item.finalUrl=r.final;
        if(r.status!==200)item.issues.push('HTTP_'+r.status);
        if(new URL(r.final).pathname!==new URL(url).pathname)item.issues.push('REDIRECT');
        const h=r.body;
        item.title=strip((h.match(/<title[^>]*>([\s\S]*?)<\/title>/i)||[])[1]||'');
        item.description=meta(h,'name','description');
        item.robots=meta(h,'name','robots');
        item.canonical=canonical(h);
        item.ogTitle=meta(h,'property','og:title');
        item.ogDescription=meta(h,'property','og:description');
        item.schemaCount=(h.match(/<script[^>]+type\s*=\s*["']application\/ld\+json["']/gi)||[]).length;
        item.h1Count=(h.match(/<h1\b/gi)||[]).length;
        item.imgCount=(h.match(/<img\b/gi)||[]).length;
        item.imgWithoutAlt=[...h.matchAll(/<img\b[^>]*>/gi)].filter(x=>!/\balt\s*=\s*["'][^"']+["']/i.test(x[0])).length;
        if(!item.title)item.issues.push('MISSING_TITLE');
        else if(item.title.length>65)item.issues.push('TITLE_LONG');
        else if(item.title.length<20)item.issues.push('TITLE_SHORT');
        if(!item.description)item.issues.push('MISSING_DESCRIPTION');
        else if(item.description.length>165)item.issues.push('DESCRIPTION_LONG');
        if(!item.canonical)item.issues.push('MISSING_CANONICAL');
        else{
          try{const c=new URL(item.canonical,ROOT);if(c.pathname!==new URL(url).pathname)item.issues.push('CANONICAL_OTHER_URL');}catch{item.issues.push('CANONICAL_INVALID')}
        }
        if(item.h1Count!==1)item.issues.push('H1_COUNT_'+item.h1Count);
        if(!item.schemaCount)item.issues.push('NO_JSONLD');
        if(!item.ogDescription)item.issues.push('MISSING_OG_DESCRIPTION');
        if(item.imgWithoutAlt)item.issues.push('IMAGE_ALT_MISSING');
        if(/noindex/i.test(item.robots))item.issues.push('NOINDEX');
        const text=strip(h.replace(/<script[\s\S]*?<\/script>/gi,'').replace(/<style[\s\S]*?<\/style>/gi,''));
        item.textWords=text.split(/\s+/).filter(Boolean).length;
        if(item.textWords<300)item.issues.push('THIN_RENDERED_TEXT');
      }catch(e){item.issues.push('FETCH_FAILED');item.error=String(e).slice(0,180)}
      results.push(item);
      await sleep(150);
    }
  }
  await Promise.all(Array.from({length:3},worker));
  results.sort((a,b)=>a.url.localeCompare(b.url));
  const byIssue={};
  const byType={};
  for(const item of results){
    (byType[item.type]||=( {count:0,errors:0})).count++;
    if(item.issues.length)byType[item.type].errors++;
    for(const iss of item.issues)byIssue[iss]=(byIssue[iss]||0)+1;
  }
  const dup=(field)=>{
    const map=new Map();
    for(const r of results)if(r[field]){const key=r[field].toLowerCase().replace(/\s+/g,' ').trim();map.set(key,[...(map.get(key)||[]),r.url]);}
    return [...map].filter(([k,v])=>v.length>1).map(([value,urls])=>({value,urls}));
  };
  const data={auditedAt:new Date().toISOString(),root:ROOT,crawlLimit:MAX,sitemapUrls:seenMaps.size,sitemapErrors:mapErrors,discoveredUrls:candidates.size,auditedUrls:results.length,truncated:candidates.size>MAX,issueCounts:byIssue,byType,duplicateTitles:dup('title'),duplicateDescriptions:dup('description'),results};
  fs.writeFileSync('seo-audit.json',JSON.stringify(data,null,2));
  const top=Object.entries(byIssue).sort((a,b)=>b[1]-a[1]);
  const lines=['# Precision ATV live crawl audit','', 'Date: '+data.auditedAt,'','Sitemap discovery: '+seenMaps.size+' sitemap files, '+candidates.size+' URLs','Pages fetched: '+results.length+' (limit '+MAX+')','', '## Findings',...top.map(x=>'- '+x[0]+': '+x[1]),'','## By page type',...Object.entries(byType).map(x=>'- '+x[0]+': '+x[1].count+' checked, '+x[1].errors+' with at least one flag'),'','## Sitemap errors',...(mapErrors.length?mapErrors:['None']),'','## Sample highest-priority pages',...results.filter(x=>x.issues.some(i=>/HTTP_|FETCH_FAILED|MISSING_|H1_COUNT_|NO_JSONLD|CANONICAL_OTHER_URL/.test(i))).slice(0,50).map(x=>'- '+x.url+' — '+x.issues.join(', ')),'','## Metadata duplicates','Duplicate title groups: '+data.duplicateTitles.length,'Duplicate description groups: '+data.duplicateDescriptions.length,'','Audit uses unauthenticated HTML requests and cannot determine actual Google indexing or search rankings.'];
  fs.writeFileSync('seo-audit.md',lines.join('\n'));
  console.log(lines.join('\n'));
}
main().catch(e=>{console.error(e);process.exitCode=1});

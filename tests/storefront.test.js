import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
import productPage from '../api/product-page.js';
const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
function verifyScripts(html){
  for(const match of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)){
    if(/type=["']application\/ld\+json["']/.test(match[1]))continue;
    if(match[2].trim())new Script(match[2]);
  }
}
test('retail pages have dealer and cart paths without public admin link',()=>{
  for(const path of ['index.html','shop.html','about.html','services.html','contact.html']){
    const html=read(path);
    assert.match(html,/href="\/dealer"/);
    assert.match(html,/href="\/cart"/);
    assert.doesNotMatch(html,/href="\/admin"/);
    verifyScripts(html);
  }
});
test('cart and dealer HTML inline scripts parse and work as distinct routes',()=>{
  for(const path of ['cart.html','dealer.html'])verifyScripts(read(path));
  const redirects=JSON.parse(read('vercel.json')).redirects;
  assert.equal(redirects.some(x=>x.source==='/cart'),false);
});
test('product pages render server-side and inline handlers parse',async()=>{
  const savedDomain=process.env.SHOPIFY_STORE_DOMAIN;
  const savedToken=process.env.SHOPIFY_STOREFRONT_TOKEN;
  const existingFetch=globalThis.fetch;
  process.env.SHOPIFY_STORE_DOMAIN='example.myshopify.com';
  process.env.SHOPIFY_STOREFRONT_TOKEN='test-token';
  globalThis.fetch=async()=>({ok:true,json:async()=>({data:{product:{
    id:'gid://shopify/Product/123',handle:'piston-ring-set',title:'Piston Ring Set',
    productType:'Parts',vendor:'Precision ATV',tags:[],descriptionHtml:'<p>Product details</p>',
    seo:null,featuredImage:null,images:{nodes:[]},
    variants:{nodes:[{id:'gid://shopify/ProductVariant/202',title:'Default Title',
      availableForSale:true,selectedOptions:[],price:{amount:'20',currencyCode:'USD'},compareAtPrice:null}]}
  }}})});
  const result={headers:{},statusCode:200,html:'',
    status(code){this.statusCode=code;return this},
    setHeader(key,value){this.headers[key]=value},
    send(value){this.html=value;return this}};
  try{
    await productPage({query:{handle:'piston-ring-set'}},result);
    assert.equal(result.statusCode,200);
    assert.match(result.html,/Add to cart/);
    assert.match(result.html,/const requiresVin=false/);
    verifyScripts(result.html);
  }finally{
    globalThis.fetch=existingFetch;
    if(savedDomain===undefined)delete process.env.SHOPIFY_STORE_DOMAIN;else process.env.SHOPIFY_STORE_DOMAIN=savedDomain;
    if(savedToken===undefined)delete process.env.SHOPIFY_STOREFRONT_TOKEN;else process.env.SHOPIFY_STOREFRONT_TOKEN=savedToken;
  }
});

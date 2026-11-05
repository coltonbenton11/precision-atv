import test from 'node:test';
import assert from 'node:assert/strict';
import {validUsdPrice,safeUsdAmount,money} from '../api/_pricing.js';
import products from '../api/products.js';
import productPage from '../api/product-page.js';

function response(){
  return {statusCode:200,headers:{},body:null,html:'',
    setHeader(k,v){this.headers[k]=v},
    status(code){this.statusCode=code;return this},
    json(value){this.body=value;return this},
    send(value){this.html=value;return this}
  };
}
function withShopify(fake,cb){
  const d=process.env.SHOPIFY_STORE_DOMAIN,t=process.env.SHOPIFY_STOREFRONT_TOKEN,f=globalThis.fetch;
  process.env.SHOPIFY_STORE_DOMAIN='example.myshopify.com';
  process.env.SHOPIFY_STOREFRONT_TOKEN='test-token';
  globalThis.fetch=fake;
  return Promise.resolve().then(cb).finally(()=>{
    globalThis.fetch=f;
    if(d===undefined)delete process.env.SHOPIFY_STORE_DOMAIN;else process.env.SHOPIFY_STORE_DOMAIN=d;
    if(t===undefined)delete process.env.SHOPIFY_STOREFRONT_TOKEN;else process.env.SHOPIFY_STOREFRONT_TOKEN=t;
  });
}
test('invalid or missing prices never format as free',()=>{
  assert.equal(money('1420.00','USD'),'$1,420.00');
  for(const value of [null,undefined,'',0,'0','not-a-price',-1]){
    assert.equal(money(value),'Price temporarily unavailable');
  }
  assert.equal(money('1420.00','CAD'),'Price temporarily unavailable');
  assert.equal(validUsdPrice({amount:'0.00',currencyCode:'USD'}),false);
  assert.equal(validUsdPrice({amount:'1420.00',currencyCode:'USD'}),true);
  assert.equal(validUsdPrice({amount:'1420.00',currencyCode:'CAD'}),false);
  assert.equal(safeUsdAmount({amount:0,currencyCode:'USD'}),null);
});
test('product catalog returns null instead of a zero retail price',async()=>{
  const ids=[1,2,3];
  await withShopify(async(_url,init)=>{
    assert.match(JSON.parse(init.body).query,/@inContext\(country: US\)/);
    const nodes=ids.map((id)=>({id:String(id),handle:'product-'+id,title:'Product '+id,productType:'Parts',vendor:'Precision ATV',tags:[],featuredImage:null,images:{nodes:[]},media:{nodes:[]},variants:{nodes:[{id:'gid://shopify/ProductVariant/'+id,availableForSale:true,price:id===1?{amount:'1420.00',currencyCode:'USD'}:id===2?null:{amount:'0.00',currencyCode:'USD'}}]}}));
    return {ok:true,json:async()=>({data:{products:{nodes,pageInfo:{hasNextPage:false,endCursor:null}}}})};
  },async()=>{
    const res=response();await products({query:{first:'3'}},res);
    assert.equal(res.statusCode,200);
    assert.equal(res.body.products[0].price,'1420.00');
    assert.equal(res.body.products[1].price,null);
    assert.equal(res.body.products[2].price,null);
    assert.equal(res.body.products[1].available,false);
  });
});
test('product detail does not advertise $0 or enable invalid-price purchases',async()=>{
  await withShopify(async(_url,init)=>{
    assert.match(JSON.parse(init.body).query,/@inContext\(country: US\)/);
    return {ok:true,json:async()=>({data:{product:{
      id:'gid://shopify/Product/123',handle:'kit',title:'Polaris RS1 Kit',
      productType:'Differential',vendor:'Precision ATV',tags:[],descriptionHtml:'<p>Details</p>',
      seo:null,featuredImage:null,images:{nodes:[]},
      variants:{nodes:[{id:'gid://shopify/ProductVariant/202',title:'Default Title',
        availableForSale:true,selectedOptions:[],price:{amount:'0',currencyCode:'USD'},compareAtPrice:null}]}
    }}})};
  },async()=>{
    const res=response();await productPage({query:{handle:'kit'}},res);
    assert.equal(res.statusCode,200);
    assert.match(res.html,/Price temporarily unavailable/);
    assert.doesNotMatch(res.html,/class="detail-price"[^<]*<span id="price">\$0\.00/);
    assert.match(res.html,/function variantPriced\(v\)/);
    assert.match(res.html,/id="buyBtn"[^>]* disabled/);
  });
});

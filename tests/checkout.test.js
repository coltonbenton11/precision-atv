import test from 'node:test';
import assert from 'node:assert/strict';
import checkout from '../api/cart.js';
import {verifyAdminPassword,isAdmin} from '../api/_adminAuth.js';

const ENGINE='gid://shopify/ProductVariant/101';
const PART='gid://shopify/ProductVariant/202';
function response(){
  return {statusCode:200,headers:{},body:null,
    setHeader(k,v){this.headers[k]=v},
    status(n){this.statusCode=n;return this},
    json(v){this.body=v;return this}
  };
}
async function run(items,{warnings=[],missing=false}={}){
  process.env.SHOPIFY_STORE_DOMAIN='example.myshopify.com';
  process.env.SHOPIFY_STOREFRONT_TOKEN='test-token';
  const req={method:'POST',body:{items}};
  const res=response();
  const previous=globalThis.fetch;
  globalThis.fetch=async (_url,init)=>{
    const body=JSON.parse(init.body);
    const isLookup=body.query.includes('CartVariants');
    let data;
    if(isLookup){
      data={nodes:body.variables.ids.map(id=>id===ENGINE?
        {id,availableForSale:true,product:{title:'2020 Polaris RZR Remanufactured Engine',productType:'Engines',tags:[]}}:
        {id,availableForSale:!missing,product:{title:'Piston Ring Set',productType:'Parts',tags:[]}})};
    }else{
      const lines=body.variables.input.lines.map(item=>({quantity:item.quantity,merchandise:{id:item.merchandiseId,availableForSale:true}}));
      data={cartCreate:{cart:{id:'gid://shopify/Cart/cart',checkoutUrl:'https://example.myshopify.com/checkouts/test',
        buyerIdentity:{countryCode:'US'},cost:{totalAmount:{currencyCode:'USD'}},lines:{nodes:lines}},
        warnings,userErrors:[]}};
    }
    return {ok:true,status:200,json:async()=>({data})};
  };
  try{await checkout(req,res)}
  finally{globalThis.fetch=previous}
  return res;
}
test('ordinary parts check out without VIN',async()=>{
  const res=await run([{variantId:PART,quantity:1}]);
  assert.equal(res.statusCode,200);
  assert.match(res.body.checkoutUrl,/checkouts/);
});
test('remanfactured engines require VIN',async()=>{
  const res=await run([{variantId:ENGINE,quantity:1}]);
  assert.equal(res.statusCode,400);
  assert.match(res.body.error,/VIN/);
});
test('engine and parts share the same verified Shopify checkout',async()=>{
  const res=await run([{variantId:ENGINE,quantity:1,vin:'1HGCM82633A004352'},{variantId:PART,quantity:3}]);
  assert.equal(res.statusCode,200);
});
test('unavailable products block checkout',async()=>{
  const res=await run([{variantId:PART,quantity:1}],{missing:true});
  assert.equal(res.statusCode,409);
});
test('Shopify stock warnings block checkout',async()=>{
  const res=await run([{variantId:PART,quantity:1}],{warnings:[{code:'MERCHANDISE_OUT_OF_STOCK',message:'out of stock'}]});
  assert.equal(res.statusCode,409);
});
test('invalid quantities fail before checkout',async()=>{
  const res=await run([{variantId:PART,quantity:0}]);
  assert.equal(res.statusCode,400);
});
test('admin requires a configured secret',()=>{
  const saved=process.env.DASHBOARD_KEY;
  delete process.env.DASHBOARD_KEY;
  try {
    assert.equal(verifyAdminPassword('whatever'),false);
    assert.equal(isAdmin({headers:{cookie:''}}),false);
  } finally {
    if(saved===undefined)delete process.env.DASHBOARD_KEY;
    else process.env.DASHBOARD_KEY=saved;
  }
});

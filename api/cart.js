const API_VERSION='2026-07';

function getShopifyConfig(){
  let domain=(process.env.SHOPIFY_STORE_DOMAIN||'').trim();
  if(domain.startsWith('https://'))domain=domain.slice(8);
  else if(domain.startsWith('http://'))domain=domain.slice(7);
  while(domain.endsWith('/'))domain=domain.slice(0,-1);
  const token=process.env.SHOPIFY_STOREFRONT_TOKEN||process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN||process.env.SHOPIFY_STOREFRONT_PUBLIC_ACCESS_TOKEN;
  return {domain,token};
}

export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  const {domain,token}=getShopifyConfig();
  if(!domain||!token)return res.status(503).json({error:'Shopify checkout is not connected yet.'});

  let body=req.body||{};
  if(typeof body==='string'){
    try{body=JSON.parse(body)}catch{return res.status(400).json({error:'Invalid request body'})}
  }

  const variantId=body.variantId;
  const quantity=Math.max(1,Number(body.quantity)||1);
  const vin=String(body.vin||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,17);
  if(!variantId)return res.status(400).json({error:'Missing variant'});
  if(!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin))return res.status(400).json({error:'A valid 17-character VIN is required before checkout.'});

  const query=`mutation CartCreate($input:CartInput!){
    cartCreate(input:$input){
      cart{
        id checkoutUrl buyerIdentity{countryCode}
        lines(first:10){nodes{quantity merchandise{... on ProductVariant{id availableForSale}}}}
      }
      userErrors{code field message}
      warnings{code message target}
    }
  }`;

  try{
    const shopify=await fetch(`https://${domain}/api/${API_VERSION}/graphql.json`,{
      method:'POST',
      headers:{'content-type':'application/json','X-Shopify-Storefront-Access-Token':token},
      body:JSON.stringify({query,variables:{input:{
        lines:[{merchandiseId:variantId,quantity,attributes:[{key:'VIN',value:vin}]}],
        attributes:[{key:'storefront',value:'precision-atv-vercel'},{key:'Vehicle VIN',value:vin}]
      }}})
    });

    const text=await shopify.text();
    let data;
    try{data=JSON.parse(text)}catch{
      return res.status(502).json({error:'Shopify returned an invalid checkout response'});
    }

    const result=data.data?.cartCreate;
    const apiError=result?.userErrors?.[0]||data.errors?.[0];
    if(!shopify.ok||apiError){
      console.warn('Shopify cart creation rejected',{variantId,quantity,status:shopify.status,code:apiError?.code,message:apiError?.message});
      return res.status(400).json({
        error:apiError?.message||`Shopify checkout returned HTTP ${shopify.status}`,
        code:apiError?.code||'SHOPIFY_CART_ERROR'
      });
    }

    // Shopify can return a checkout URL while excluding unavailable merchandise.
    // Verify that the requested variant and exact quantity survived cart creation.
    const cart=result?.cart;
    if(!cart)return res.status(502).json({error:'Shopify did not return a cart. Please try again.',code:'MISSING_CART'});

    const warnings=result?.warnings||[];
    const stockOrMarketWarning=warnings.find(w=>
      ['MERCHANDISE_OUT_OF_STOCK','MERCHANDISE_NOT_ENOUGH_STOCK','PRODUCT_UNAVAILABLE_IN_BUYER_LOCATION'].includes(w.code)
    );
    const lines=cart.lines?.nodes||[];
    const matching=lines.filter(line=>line.merchandise?.id===variantId);
    const validCart=lines.length===1&&matching.length===1&&
      matching[0].quantity===quantity&&matching[0].merchandise.availableForSale===true;

    if(stockOrMarketWarning||!validCart){
      console.warn('Shopify checkout line validation failed',{
        variantId,quantity,country:cart.buyerIdentity?.countryCode,
        returnedLines:lines.map(line=>({variantId:line.merchandise?.id,quantity:line.quantity,available:line.merchandise?.availableForSale})),
        warnings:warnings.map(w=>({code:w.code,message:w.message,target:w.target}))
      });
      const message=stockOrMarketWarning?.message||
        'Shopify did not add the selected engine and core-charge option to your cart.';
      return res.status(409).json({
        error:`${message} Please contact the shop so we can check this option before you pay.`,
        code:stockOrMarketWarning?.code||'CART_LINE_MISMATCH'
      });
    }

    const checkoutUrl=cart.checkoutUrl;
    if(!checkoutUrl)return res.status(502).json({error:'Shopify did not return a checkout URL',code:'MISSING_CHECKOUT_URL'});

    res.setHeader('Cache-Control','no-store');
    return res.status(200).json({checkoutUrl});
  }catch(e){
    console.error('Shopify cartCreate failed',e);
    return res.status(500).json({error:'Unable to create Shopify checkout'});
  }
}

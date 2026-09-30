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
  if(!variantId)return res.status(400).json({error:'Missing variant'});

  const query=`mutation CartCreate($input:CartInput!){cartCreate(input:$input){cart{id checkoutUrl} userErrors{field message}}}`;

  try{
    const shopify=await fetch(`https://${domain}/api/${API_VERSION}/graphql.json`,{
      method:'POST',
      headers:{'content-type':'application/json','X-Shopify-Storefront-Access-Token':token},
      body:JSON.stringify({query,variables:{input:{lines:[{merchandiseId:variantId,quantity}],attributes:[{key:'storefront',value:'precision-atv-vercel'}]}}})
    });

    const text=await shopify.text();
    let data;
    try{data=JSON.parse(text)}catch{
      return res.status(502).json({error:'Shopify returned an invalid checkout response'});
    }

    const error=data.data?.cartCreate?.userErrors?.[0]?.message||data.errors?.[0]?.message;
    if(!shopify.ok||error)return res.status(400).json({error:error||`Shopify returned HTTP ${shopify.status}`});

    const checkoutUrl=data.data?.cartCreate?.cart?.checkoutUrl;
    if(!checkoutUrl)return res.status(502).json({error:'Shopify did not return a checkout URL'});

    return res.status(200).json({checkoutUrl});
  }catch(e){
    console.error('Shopify cartCreate failed',e);
    return res.status(500).json({error:'Unable to create Shopify checkout'});
  }
}

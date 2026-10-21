const API_VERSION = '2026-07';
const MAX_LINES = 20;
function config() {
  const domain = String(process.env.SHOPIFY_STORE_DOMAIN || '').trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
  const token = process.env.SHOPIFY_STOREFRONT_TOKEN || process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN || process.env.SHOPIFY_STOREFRONT_PUBLIC_ACCESS_TOKEN;
  return {domain, token};
}
async function graphql(domain, token, query, variables) {
  const response = await fetch(`https://${domain}/api/${API_VERSION}/graphql.json`, {
    method: 'POST',
    headers: {'Content-Type':'application/json','X-Shopify-Storefront-Access-Token':token},
    body: JSON.stringify({query, variables})
  });
  let payload;
  try { payload = await response.json(); }
  catch { throw new Error('Invalid response from Shopify.'); }
  if (!response.ok || payload.errors?.length) {
    throw new Error(payload.errors?.[0]?.message || `Shopify returned ${response.status}.`);
  }
  return payload.data;
}
function vinRequired(product) {
  const tags = (product?.tags || []).map(tag => String(tag).toLowerCase());
  if (tags.includes('vin-not-required')) return false;
  if (tags.includes('vin-required') || tags.includes('requires-vin')) return true;
  const title = String(product?.title || '');
  const type = String(product?.productType || '');
  return /\b(remanufactured|remanufactored|rebuilt\s+engine|long[ -]?block|complete\s+engine|ecu\s+(reflash|tuning?)|bench\s+(ecu\s+)?reflash)\b/i.test(title) ||
    /^(remanufactured\s+)?engines?$/i.test(type);
}
function normalizeVin(value) {
  return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,17);
}
export default async function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  if (req.method !== 'POST') return res.status(405).json({error:'Method not allowed'});
  const {domain,token}=config();
  if (!domain || !token) return res.status(503).json({error:'Shopify checkout is not configured.'});
  let input = req.body || {};
  if (typeof input === 'string') {
    try { input = JSON.parse(input); }
    catch { return res.status(400).json({error:'Invalid request body'}); }
  }
  const raw = Array.isArray(input.items) ? input.items : [input];
  if (!raw.length || raw.length > MAX_LINES) return res.status(400).json({error:`Cart must contain between 1 and ${MAX_LINES} items.`});
  const items = raw.map(item => ({
    variantId:String(item.variantId || ''),
    quantity:Number(item.quantity),
    vin:normalizeVin(item.vin)
  }));
  if (items.some(item => !/^gid:\/\/shopify\/ProductVariant\/\d+$/.test(item.variantId) ||
      !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 100)) {
    return res.status(400).json({error:'Invalid cart item or quantity.'});
  }
  try {
    // Always resolve product types on the server; browser prices and VIN flags cannot be trusted.
    const ids = [...new Set(items.map(item=>item.variantId))];
    const lookup = await graphql(domain,token,
      'query CartVariants($ids:[ID!]!){nodes(ids:$ids){... on ProductVariant{id availableForSale product{title productType tags}}}}',
      {ids});
    const variants = new Map((lookup.nodes || []).filter(Boolean).map(variant=>[variant.id,variant]));
    for (const item of items) {
      const variant=variants.get(item.variantId);
      if (!variant || !variant.availableForSale) return res.status(409).json({error:'An item is no longer available. Please refresh the product page.'});
      if (vinRequired(variant.product) && !/^[A-HJ-NPR-Z0-9]{17}$/.test(item.vin)) {
        return res.status(400).json({error:`A valid 17-character VIN is required for ${variant.product.title}.`});
      }
      if (item.vin && !/^[A-HJ-NPR-Z0-9]{17}$/.test(item.vin)) {
        return res.status(400).json({error:'VIN must be 17 characters if provided.'});
      }
    }
    const lines=items.map(item=>({
      merchandiseId:item.variantId,quantity:item.quantity,
      ...(item.vin?{attributes:[{key:'VIN',value:item.vin}]}:{})
    }));
    const data=await graphql(domain,token,
      `mutation CreateCart($input:CartInput!){cartCreate(input:$input){
        cart{id checkoutUrl buyerIdentity{countryCode} cost{totalAmount{currencyCode}}
          lines(first:100){nodes{quantity merchandise{... on ProductVariant{id availableForSale}}}}}
        userErrors{code field message} warnings{code message target}
      }}`,
      {input:{buyerIdentity:{countryCode:'US'},lines,attributes:[{key:'storefront',value:'precision-atv-vercel'}]}}
    );
    const result=data.cartCreate;
    if (result?.userErrors?.length) {
      return res.status(400).json({error:result.userErrors[0].message,code:result.userErrors[0].code});
    }
    const cart=result?.cart;
    if (!cart?.checkoutUrl) return res.status(502).json({error:'Shopify did not generate checkout.'});
    const returned=new Map();
    for (const line of cart.lines?.nodes || []) {
      const id=line.merchandise?.id;
      if (!id || !line.merchandise.availableForSale) return res.status(409).json({error:'An item is unavailable for checkout.'});
      returned.set(id,(returned.get(id)||0)+line.quantity);
    }
    const expected=new Map();
    for(const item of items) expected.set(item.variantId,(expected.get(item.variantId)||0)+item.quantity);
    if (returned.size!==expected.size || [...expected].some(([id,qty])=>returned.get(id)!==qty) ||
        (result.warnings||[]).some(w=>/OUT_OF_STOCK|NOT_ENOUGH_STOCK|UNAVAILABLE_IN_BUYER_LOCATION/.test(w.code||''))) {
      return res.status(409).json({error:'Shopify could not add every selected item. Review your cart or contact the shop.'});
    }
    if(cart.cost?.totalAmount?.currencyCode!=='USD')return res.status(409).json({error:'Unexpected checkout currency. Contact the shop.'});
    return res.status(200).json({checkoutUrl:cart.checkoutUrl});
  } catch(error) {
    console.error('Shopify checkout failure',error);
    return res.status(502).json({error:'Unable to connect to secure checkout right now. Please contact the shop.'});
  }
}

// Retail prices must come from Shopify's US Storefront context.
// Never turn missing, non-USD, or zero prices into a purchasable $0 listing.
export function validUsdPrice(price){
  if(!price || price.currencyCode!=='USD')return false;
  if(price.amount===null||price.amount===undefined||String(price.amount).trim()==='')return false;
  const amount=Number(price.amount);
  return Number.isFinite(amount)&&amount>0;
}
export function safeUsdAmount(price){return validUsdPrice(price)?String(price.amount):null}
export function money(amount,currency='USD'){
  if(currency!=='USD'||amount===null||amount===undefined||String(amount).trim()==='')return 'Price temporarily unavailable';
  const n=Number(amount);
  if(!Number.isFinite(n)||n<=0)return 'Price temporarily unavailable';
  return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n);
}

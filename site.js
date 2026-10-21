const API = '';
function money(amount,currency='USD'){try{return new Intl.NumberFormat('en-US',{style:'currency',currency}).format(Number(amount||0))}catch{return `$${amount}`}}
async function bootstrapAnalytics(){
  try{
    const r=await fetch('/api/config'); const c=await r.json();
    if(c.ga4MeasurementId){
      const s=document.createElement('script');s.async=true;s.src=`https://www.googletagmanager.com/gtag/js?id=${c.ga4MeasurementId}`;document.head.appendChild(s);
      window.dataLayer=window.dataLayer||[];window.gtag=function(){dataLayer.push(arguments)};gtag('js',new Date());gtag('config',c.ga4MeasurementId,{send_page_view:true});
    }
  }catch(e){}
}
function track(name,params={}){if(window.gtag)gtag('event',name,params)}
bootstrapAnalytics();

/* Retail cart stays in the shopper's browser until Shopify creates secure checkout.
   Prices and availability are validated again by Shopify, never trusted from localStorage. */
const PATV_CART_KEY='patv-retail-cart-v1';
window.PATVCart={
  list(){
    try{
      const data=JSON.parse(localStorage.getItem(PATV_CART_KEY)||'[]');
      return Array.isArray(data)?data.filter(x=>x&&typeof x.variantId==='string').slice(0,20):[];
    }catch{return []}
  },
  save(items){
    try{
      localStorage.setItem(PATV_CART_KEY,JSON.stringify(items.slice(0,20)));
      this.updateCount();return true;
    }catch{return false}
  },
  add(item){
    const items=this.list();
    const key=x=>x.variantId+'|'+(x.vin||'');
    const idx=items.findIndex(x=>key(x)===key(item));
    if(idx>=0)items[idx].quantity=Math.min(100,Number(items[idx].quantity||0)+Number(item.quantity||1));
    else{
      if(items.length>=20)return false;
      items.push(item);
    }
    return this.save(items);
  },
  clear(){try{localStorage.removeItem(PATV_CART_KEY)}catch{}this.updateCount()},
  updateCount(){
    const n=this.list().reduce((sum,item)=>sum+Number(item.quantity||0),0);
    document.querySelectorAll('[data-cart-count]').forEach(el=>el.textContent=String(n));
  }
};
document.addEventListener('DOMContentLoaded',()=>window.PATVCart.updateCount());

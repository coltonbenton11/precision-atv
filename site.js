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

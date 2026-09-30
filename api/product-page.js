const API_VERSION='2026-07';
const BASE='https://precisionatvfab.com';

function esc(value=''){return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function strip(html=''){return String(html).replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim()}
function safeJson(value){return JSON.stringify(value).replace(/</g,'\\u003c').replace(/>/g,'\\u003e').replace(/&/g,'\\u0026')}
function money(amount,currency='USD'){try{return new Intl.NumberFormat('en-US',{style:'currency',currency}).format(Number(amount||0))}catch{return '$'+amount}}
function shell(title,body,head=''){return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>${head}<link rel="stylesheet" href="/styles.css"><script defer src="/_vercel/insights/script.js"></script></head><body>${body}<script src="/site.js"></script></body></html>`}

export default async function handler(req,res){
  const handle=String(req.query.handle||'').trim();
  const domain=process.env.SHOPIFY_STORE_DOMAIN,token=process.env.SHOPIFY_STOREFRONT_TOKEN;
  if(!handle)return res.status(400).send('Missing product handle.');
  if(!domain||!token)return res.status(503).send('Shopify is not configured.');

  const query=`query ProductByHandle($handle:String!){product(handle:$handle){id handle title descriptionHtml productType vendor seo{title description} featuredImage{url altText} images(first:8){nodes{url altText}} variants(first:100){nodes{id title availableForSale selectedOptions{name value} price{amount currencyCode} compareAtPrice{amount currencyCode}}}}}`;
  try{
    const r=await fetch(`https://${domain}/api/${API_VERSION}/graphql.json`,{method:'POST',headers:{'content-type':'application/json','X-Shopify-Storefront-Access-Token':token},body:JSON.stringify({query,variables:{handle}})});
    const j=await r.json();
    if(j.errors)throw new Error(j.errors[0]?.message||'Shopify error');
    const p=j.data?.product;
    if(!p){
      res.status(404);
      return res.send(shell('Product not found | Precision ATV',`<nav class="nav"><div class="wrap"><a class="brand" href="/">PRECISION <span>ATV</span></a><div class="navlinks"><a href="/shop">Shop</a><a href="/services">Service & Repair</a><a href="/#shop">Our Shop</a></div></div></nav><section><div class="wrap"><div class="card"><h1>Product not found.</h1><p class="muted">This item may have moved or is no longer available.</p><a class="btn" href="/shop">Back to shop</a></div></div></section>`));
    }

    const variants=p.variants?.nodes||[];
    const selected=variants.find(v=>v.availableForSale)||variants[0];
    const images=(p.images?.nodes?.length?p.images.nodes:(p.featuredImage?[p.featuredImage]:[]));
    const canonical=`${BASE}/products/${encodeURIComponent(p.handle)}`;
    const metaTitle=p.seo?.title||`${p.title} | Precision ATV`;
    const metaDescription=p.seo?.description||strip(p.descriptionHtml).slice(0,155)||`Shop ${p.title} from Precision ATV in Conroe, Texas.`;
    const mainImage=images[0]?.url||'';
    const currency=selected?.price?.currencyCode||'USD';
    const schema={
      '@context':'https://schema.org','@type':'Product',
      name:p.title,description:strip(p.descriptionHtml),image:images.map(i=>i.url),brand:{'@type':'Brand',name:p.vendor||'Precision ATV'},
      sku:selected?.id||p.id,
      offers:variants.map(v=>({'@type':'Offer',url:canonical,priceCurrency:v.price?.currencyCode||'USD',price:v.price?.amount||0,availability:v.availableForSale?'https://schema.org/InStock':'https://schema.org/OutOfStock'}))
    };
    const variantOptions=variants.map(v=>`<option value="${esc(v.id)}" data-price="${esc(v.price?.amount||0)}" data-currency="${esc(v.price?.currencyCode||'USD')}" data-available="${v.availableForSale?'1':'0'}" ${v.id===selected?.id?'selected':''}>${esc(v.title==='Default Title'?'Standard':v.title)} — ${esc(money(v.price?.amount,v.price?.currencyCode))}${v.availableForSale?'':' — Sold out'}</option>`).join('');
    const thumbs=images.map((img,i)=>`<button class="thumb ${i===0?'active':''}" type="button" onclick="swapImage(this,'${esc(img.url)}')"><img src="${esc(img.url)}" alt="${esc(img.altText||p.title)}"></button>`).join('');
    const compare=selected?.compareAtPrice&&Number(selected.compareAtPrice.amount)>Number(selected.price?.amount)?`<span class="compare-price">${esc(money(selected.compareAtPrice.amount,selected.compareAtPrice.currencyCode))}</span>`:'';

    const head=`<meta name="description" content="${esc(metaDescription)}"><link rel="canonical" href="${esc(canonical)}"><meta property="og:type" content="product"><meta property="og:title" content="${esc(metaTitle)}"><meta property="og:description" content="${esc(metaDescription)}"><meta property="og:url" content="${esc(canonical)}">${mainImage?`<meta property="og:image" content="${esc(mainImage)}">`:''}<script type="application/ld+json">${safeJson(schema)}</script>`;
    const body=`
<div class="topbar"><div class="wrap"><div>CONROE, TEXAS • BUILT FOR THE RIDE</div><div>Fitment help: <a href="tel:+19362287655">(936) 228-7655</a></div></div></div>
<nav class="nav"><div class="wrap"><a class="brand" href="/">PRECISION <span>ATV</span></a><div class="navlinks"><a href="/shop">Shop</a><a href="/services">Service & Repair</a><a href="/#shop">Our Shop</a><a class="btn" href="tel:+19362287655">Call the shop</a></div><a class="mobile-call" href="tel:+19362287655">Call</a></div></nav>
<section class="product-page"><div class="wrap">
<div class="breadcrumbs"><a href="/">Home</a><span>›</span><a href="/shop">Shop</a><span>›</span><span>${esc(p.productType||'Product')}</span></div>
<div class="product-detail">
  <div class="product-gallery">
    <div class="gallery-main">${mainImage?`<img id="mainImage" src="${esc(mainImage)}" alt="${esc(images[0]?.altText||p.title)}">`:'<div class="product-media">PRECISION ATV</div>'}</div>
    ${thumbs?`<div class="thumbs">${thumbs}</div>`:''}
  </div>
  <div class="product-summary">
    <div class="kicker">${esc(p.productType||'Powersports')} • ${esc(p.vendor||'Precision ATV')}</div>
    <h1>${esc(p.title)}</h1>
    <div class="detail-price"><span id="price">${esc(money(selected?.price?.amount,currency))}</span> ${compare}</div>
    <div id="availability" class="availability ${selected?.availableForSale?'in':'out'}">${selected?.availableForSale?'In stock / available to order':'Currently unavailable'}</div>
    ${variants.length>1?`<label class="field-label" for="variant">Choose option</label><select class="select" id="variant">${variantOptions}</select>`:''}
    <div class="buy-row"><label><span class="field-label">Qty</span><input class="qty" id="qty" type="number" min="1" value="1"></label><button id="buyBtn" class="btn buy-main" onclick="buyNow()" ${selected?.availableForSale?'':'disabled'}>Buy securely through Shopify</button></div>
    <div class="trust-row">
      <div><b>Real shop support</b><span>Call before ordering if you need fitment help.</span></div>
      <div><b>Secure checkout</b><span>Payment, tax and shipping are handled by Shopify.</span></div>
      <div><b>Conroe, Texas</b><span>Backed by a working powersports shop.</span></div>
    </div>
  </div>
</div>
<div class="product-copy"><div><div class="kicker">Product details</div><h2>What you need to know.</h2></div><div class="description">${p.descriptionHtml||'<p>Contact Precision ATV for specifications and fitment information.</p>'}</div></div>
</div></section>
<section class="band"><div class="wrap"><div><h2>Not sure it fits?</h2><p>Talk to the shop before you order. We’ll help match the part to your machine.</p></div><a class="btn" href="tel:+19362287655">Call (936) 228-7655</a></div></section>
<footer class="footer"><div class="wrap footer-grid"><div><div class="brand">PRECISION <span>ATV</span></div><p>1801 N Loop 336 E • Conroe, TX 77301</p></div><div class="policy-links"><a href="/shop">Shop</a><a href="/services">Service</a><a href="https://precisionatvfab.com/policies/refund-policy">Returns</a><a href="https://precisionatvfab.com/policies/privacy-policy">Privacy</a></div></div></footer>
<script>
const variants=${safeJson(variants.map(v=>({id:v.id,title:v.title,available:v.availableForSale,price:v.price?.amount||0,currency:v.price?.currencyCode||'USD'})))};
function swapImage(btn,url){document.getElementById('mainImage').src=url;document.querySelectorAll('.thumb').forEach(x=>x.classList.remove('active'));btn.classList.add('active')}
function currentVariant(){const s=document.getElementById('variant');const id=s?s.value:${safeJson(selected?.id||'')};return variants.find(v=>v.id===id)||variants[0]}
function updateVariant(){const v=currentVariant();if(!v)return;document.getElementById('price').textContent=money(v.price,v.currency);const a=document.getElementById('availability');a.textContent=v.available?'In stock / available to order':'Currently unavailable';a.className='availability '+(v.available?'in':'out');document.getElementById('buyBtn').disabled=!v.available}
document.getElementById('variant')?.addEventListener('change',updateVariant);
async function buyNow(){const v=currentVariant();if(!v||!v.available)return;const qty=Math.max(1,Number(document.getElementById('qty').value)||1);track('add_to_cart',{currency:v.currency,value:Number(v.price)*qty,items:[{item_id:v.id,item_name:${safeJson(p.title)},price:Number(v.price),quantity:qty}]});const btn=document.getElementById('buyBtn');btn.disabled=true;btn.textContent='Starting checkout…';try{const r=await fetch('/api/cart',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({variantId:v.id,quantity:qty})});const d=await r.json();if(!d.checkoutUrl)throw new Error(d.error||'Unable to start checkout');track('begin_checkout',{currency:v.currency,value:Number(v.price)*qty,items:[{item_id:v.id,item_name:${safeJson(p.title)},price:Number(v.price),quantity:qty}]});location.href=d.checkoutUrl}catch(e){alert(e.message);btn.disabled=false;btn.textContent='Buy securely through Shopify'}}
track('view_item',{currency:${safeJson(currency)},value:Number(${safeJson(selected?.price?.amount||0)}),items:[{item_id:${safeJson(selected?.id||p.id)},item_name:${safeJson(p.title)}}]});
</script>`;
    res.setHeader('Cache-Control','public, s-maxage=120, stale-while-revalidate=600');
    res.setHeader('Content-Type','text/html; charset=utf-8');
    return res.status(200).send(shell(metaTitle,body,head));
  }catch(e){
    res.status(500);
    return res.send(shell('Store temporarily unavailable | Precision ATV',`<section><div class="wrap"><div class="card"><h1>We hit a snag.</h1><p class="muted">The product could not be loaded right now. Please try again or call the shop.</p><a class="btn" href="/shop">Back to shop</a></div></div></section>`));
  }
}

const API_VERSION='2026-07';
const SHOP='https://precisionatv-com.myshopify.com/cdn/shop/files/';

const IMAGE_FALLBACKS={
  'rzr xp turbo':SHOP+'2017-2021-polaris-rzr-xp-turbo-remanufactured-rebuilt-engine-oem-spec-1-year-warranty-2825799.jpg?v=1774717627&width=900',
  'ranger xp 1000':SHOP+'2017-2025-polaris-ranger-xp-1000-remanufactured-rebuilt-engine-oem-spec-1-year-warranty-6618614.jpg?v=1767591686&width=900',
  'ranger xp 570':SHOP+'2015-2016-polaris-ranger-xp-570-remanufactured-rebuilt-engine-oem-spec-1-year-warranty-5150904.jpg?v=1767591684&width=900',
  'sportsman':SHOP+'polaris-sportsman-2015-2026-1000-remanufactured-rebuilt-engine-oem-spec-1-year-warranty-7139307.png?v=1768503129&width=900',
  'can-am 570 outlander/renegade hot rods':SHOP+'can-am-570-outlanderrenegade-hot-rods-bottom-end-kit-hr00193-7835465.jpg?v=1783500786&width=900',
  'outlander 570 renegade 570 top end':SHOP+'can-am-outlander-570-renegade-570-top-end-rebuild-kit-cylinders-pistons-2144951.png?v=1767508808&width=900',
  'outlander 1000 performance bench ecu':SHOP+'can-am-outlander-1000-performance-bench-ecu-reflash-must-send-ecu-960371.jpg?v=1733132123&width=900',
  'renegade 1000 performance bench ecu':SHOP+'can-am-renegade-1000-performance-bench-ecu-reflash-must-send-ecu-209622.jpg?v=1733132122&width=900',
  'renegade 850 performance bench ecu':SHOP+'can-am-renegade-850-performance-bench-ecu-reflash-must-send-ecu-871995.jpg?v=1733132122&width=900',
  'hot cams':SHOP+'hot-cams-shim-conversion-kit-pol-ind-vic-hc00134-5567914.jpg?v=1783500786&width=900',
  'ngk':SHOP+'ngk-spark-plug-9383310-93833-4377742.jpg?v=1783500786&width=900',
  'rs1 diff':SHOP+'polaris-rs1-diff-swap-kit-for-the-polaris-rzr-1000-xp-and-xp4-715437.jpg?v=1744679774&width=900'
};
const GENERIC_POLARIS=SHOP+'polaris-rzr-1000-s-2016-2022-remanufactured-rebuilt-engine-oem-spec-1-year-warranty-9264263.jpg?v=1767591684&width=900';
const GENERIC_CANAM=SHOP+'2018-2026-can-am-maverick-sport-1000-remanufactured-rebuilt-engine-oem-spec-1-year-warranty-2176874.jpg?v=1776636906&width=900';

function fallbackImage(title=''){
  const s=title.toLowerCase();
  for(const [key,url] of Object.entries(IMAGE_FALLBACKS))if(s.includes(key))return url;
  if(s.includes('can-am')||s.includes('canam'))return GENERIC_CANAM;
  if(s.includes('polaris')||s.includes('rzr')||s.includes('ranger'))return GENERIC_POLARIS;
  return GENERIC_POLARIS;
}
const RAW=[
  ['2017-2021 POLARIS RZR XP TURBO Remanufactured Engine','Engines',4150],
  ['Polaris Sportsman 2015-2026 1000 Remanufactured Engine','Engines',3850],
  ['Polaris Sportsman 2009-2026 850 Remanufactured Engine','Engines',3850],
  ['2018-2026 Can-Am Maverick Sport 1000 Remanufactured Engine','Engines',3550],
  ['2015-2016 Polaris Ranger XP 570 Remanufactured Engine','Engines',3050],
  ['Polaris RZR 1000 S 2016-2022 Remanufactured Engine','Engines',3950],
  ['2014-2026 POLARIS RZR XP 1000 Remanufactured Engine','Engines',3950],
  ['2017-2025 POLARIS RANGER XP 1000 Remanufactured Engine','Engines',3950],
  ['2013-2019 POLARIS RANGER XP 900 Remanufactured Engine','Engines',3950],
  ['2018-2021 Can-Am Defender HD5 Remanufactured Engine','Engines',3550],
  ['2022-2026 Can-Am Defender HD7 Remanufactured Engine','Engines',3550],
  ['2012-2024 Can-Am Outlander 1000 Remanufactured Engine','Engines',3550],
  ['2022-2026 Can-Am Defender HD9 Remanufactured Engine','Engines',3550],
  ['2012-2015 Can-Am Renegade 800 Remanufactured Engine','Engines',3550],
  ['2012-2015 Can-Am Outlander 800 Remanufactured Engine','Engines',3550],
  ['2016-2021 Can-Am Defender HD8 Remanufactured Engine','Engines',3550],
  ['2017-2026 Can-Am Defender HD10 Remanufactured Engine','Engines',3550],
  ['VERTEX Complete Engine Rebuild Kit POL - WR00043-1','Parts & Kits',2094.70],
  ['CAN-AM 570 Outlander/Renegade Hot Rods Bottom End Kit - HR00193','Parts & Kits',1508.95],
  ['HOT CAMS Shim Conversion Kit POL IND VIC - HC00134','Parts & Kits',436.95],
  ['NGK Spark Plug #93833/10 - 93833','Parts & Kits',14.88],
  ['Can-Am Outlander 570 Renegade 570 Top End Rebuild Kit','Parts & Kits',629.99],
  ['Polaris XP Turbo / XP 1000 ARP Stock Replacement Case Bolt Kit','Parts & Kits',149.99],
  ['Polaris XP Turbo / XP 1000 ARP Case Stud Kit','Parts & Kits',178.92],
  ['Polaris XP Turbo / XP 1000 ARP CustomAge625+ Head Stud Kit','Parts & Kits',342.45],
  ['Polaris XP Turbo / XP 1000 ARP2000 Head Stud Kit','Parts & Kits',168],
  ['Polaris XP Turbo / XP 1000 ARP L19 Alloy Head Stud Kit','Parts & Kits',200],
  ['POLARIS RS1 Diff Swap Kit for RZR 1000 XP and XP4','Accessories',1420],
  ['CAN-AM Renegade 850 Performance Bench ECU Reflash','ECU Tuning',189],
  ['CAN-AM Renegade 1000 Performance Bench ECU Reflash','ECU Tuning',189],
  ['CAN-AM Outlander 1000 Performance Bench ECU Reflash','ECU Tuning',189],
  ['Precision ATV BAR ONLY Can-Am Big Game Winch Retrieval System','Accessories',499.99],
  ['Precision ATV Can-Am Big Game Winch Retrieval System','Accessories',729.99]
];
const FALLBACK=RAW.map((x,i)=>({id:`fallback-${i}`,handle:`fallback-${i}`,title:x[0],productType:x[1],vendor:'Precision ATV',price:String(x[2]),currency:'USD',image:fallbackImage(x[0]),variantId:null,available:true}));

export default async function handler(req,res){
  const rawDomain=process.env.SHOPIFY_STORE_DOMAIN||'';
  const domain=rawDomain.replace(/^https?:\/\//,'').replace(/\/$/,'');
  const token=process.env.SHOPIFY_STOREFRONT_TOKEN||process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN||process.env.SHOPIFY_STOREFRONT_PUBLIC_ACCESS_TOKEN;
  const wantAll=String(req.query.all||'')==='1'||String(req.query.all||'').toLowerCase()==='true';
  const requested=Math.max(1,Number(req.query.first||100)||100);
  const first=Math.min(requested,100);

  if(!domain||!token){
    const products=wantAll?FALLBACK:FALLBACK.slice(0,first);
    return res.status(200).json({mode:'preview',warning:'Shopify Storefront credentials are not available to this deployment.',products,total:products.length,hasMore:false});
  }

  const query=`query Products($first:Int!,$after:String){products(first:$first,after:$after,sortKey:BEST_SELLING){pageInfo{hasNextPage endCursor}nodes{id handle title productType vendor tags featuredImage{url altText} images(first:1){nodes{url altText}} media(first:1){nodes{previewImage{url altText}}} variants(first:10){nodes{id title availableForSale price{amount currencyCode}}}}}}`;

  try{
    const products=[];
    let after=null;
    let hasMore=true;
    const maxProducts=wantAll?1200:first;

    while(hasMore&&products.length<maxProducts){
      const pageSize=Math.min(100,maxProducts-products.length);
      const r=await fetch(`https://${domain}/api/${API_VERSION}/graphql.json`,{
        method:'POST',
        headers:{'content-type':'application/json','X-Shopify-Storefront-Access-Token':token},
        body:JSON.stringify({query,variables:{first:pageSize,after}})
      });
      const j=await r.json();
      if(!r.ok||j.errors)throw new Error(j.errors?.[0]?.message||`Shopify returned HTTP ${r.status}`);
      const connection=j.data?.products;
      const nodes=connection?.nodes||[];

      for(const p of nodes){
        const v=p.variants?.nodes?.find(x=>x.availableForSale)||p.variants?.nodes?.[0];
        const image=p.featuredImage?.url||p.images?.nodes?.[0]?.url||p.media?.nodes?.[0]?.previewImage?.url||fallbackImage(p.title);
        const tags=Array.isArray(p.tags)?p.tags:[];
        products.push({
          id:p.id,handle:p.handle,title:p.title,productType:p.productType,vendor:p.vendor,tags,image,
          variantId:v?.id||null,price:v?.price?.amount||0,currency:v?.price?.currencyCode||'USD',
          available:!!v?.availableForSale,
          searchText:[p.title,p.productType,p.vendor,...tags].filter(Boolean).join(' ').toLowerCase()
        });
      }

      hasMore=Boolean(connection?.pageInfo?.hasNextPage);
      after=connection?.pageInfo?.endCursor||null;
      if(!nodes.length||!after)hasMore=false;
      if(!wantAll)hasMore=false;
    }

    res.setHeader('Cache-Control','public, s-maxage=60, stale-while-revalidate=300');
    return res.status(200).json({mode:'shopify',products,total:products.length,hasMore});
  }catch(e){
    const products=wantAll?FALLBACK:FALLBACK.slice(0,first);
    return res.status(200).json({mode:'preview',warning:e.message,products,total:products.length,hasMore:false});
  }
}

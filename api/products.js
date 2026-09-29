const FALLBACK=[
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
].map((x,i)=>({id:`fallback-${i}`,handle:`fallback-${i}`,title:x[0],productType:x[1],vendor:'Precision ATV',price:String(x[2]),currency:'USD',image:null,variantId:null,available:true}));
export default async function handler(req,res){
  const domain=process.env.SHOPIFY_STORE_DOMAIN,token=process.env.SHOPIFY_STOREFRONT_TOKEN;const first=Math.min(Number(req.query.first||100),100);
  if(!domain||!token)return res.status(200).json({mode:'preview',products:FALLBACK.slice(0,first)});
  const query=`query Products($first:Int!){products(first:$first,sortKey:BEST_SELLING){nodes{id handle title productType vendor featuredImage{url altText} variants(first:10){nodes{id title availableForSale price{amount currencyCode}}}}}}`;
  try{const r=await fetch(`https://${domain}/api/2026-07/graphql.json`,{method:'POST',headers:{'content-type':'application/json','X-Shopify-Storefront-Access-Token':token},body:JSON.stringify({query,variables:{first}})});const j=await r.json();if(j.errors)throw new Error(j.errors[0]?.message||'Shopify error');const products=(j.data?.products?.nodes||[]).map(p=>{const v=p.variants.nodes.find(x=>x.availableForSale)||p.variants.nodes[0];return{id:p.id,handle:p.handle,title:p.title,productType:p.productType,vendor:p.vendor,image:p.featuredImage?.url||null,variantId:v?.id||null,price:v?.price?.amount||0,currency:v?.price?.currencyCode||'USD',available:!!v?.availableForSale}});res.setHeader('Cache-Control','public, s-maxage=120, stale-while-revalidate=600');return res.status(200).json({mode:'shopify',products})}catch(e){return res.status(200).json({mode:'preview',warning:e.message,products:FALLBACK.slice(0,first)})}
}

# Precision ATV — Vercel + Shopify storefront

A standalone Precision ATV storefront designed for Vercel while retaining Shopify as the commerce backend.

## Included
- Responsive public storefront and catalog
- Current Conroe location: 1801 N Loop 336 E, Conroe, TX 77301
- No fabrication service marketing
- Shopify Storefront API product/variant/inventory feed
- Shopify cart creation + hosted Shopify checkout
- GA4 event hooks for page views, product selections, add-to-cart and begin-checkout
- Search-friendly titles, descriptions, canonical URLs, LocalBusiness schema, robots.txt and sitemap.xml
- Vercel Web Analytics script hook
- Owner `/analytics` dashboard with GA4 and Google Search Console API support
- Dashboard metrics protected by a Vercel environment key

## Required Vercel environment variables
Copy `.env.example` values into Vercel Project Settings > Environment Variables.

### Shopify
`SHOPIFY_STORE_DOMAIN=precisionatv-com.myshopify.com`
`SHOPIFY_STOREFRONT_TOKEN=<Storefront API public access token>`

### GA4 client tracking
`GA4_MEASUREMENT_ID=G-ND2GJ5FD6S`

### Owner reporting dashboard
`GA4_PROPERTY_ID=556833689`
`GSC_SITE_URL=sc-domain:precisionatvfab.com`
`GOOGLE_SERVICE_ACCOUNT_EMAIL=<service-account-email>`
`GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY=<private-key>`
`DASHBOARD_KEY=<long random password>`

Add the Google service-account email as a viewer on GA4 and as a user/owner on the matching Google Search Console property.

## Shopify behavior
If Shopify credentials are missing, the site uses a 33-product preview catalog based on the existing Precision ATV store. Once credentials are added, `/api/products` automatically switches to live Shopify products, prices, variants, availability and product images. Checkout is created through Shopify's Storefront Cart API.

## Domain
The files currently use `https://precisionatvfab.com/` as the intended canonical production domain. Update `canonical`, `robots.txt`, `sitemap.xml`, and `GSC_SITE_URL` if a different final domain is selected.
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
- Private `/admin` owner login with unified Shopify commerce, GA4, and Google Search Console reporting
- Dashboard metrics protected by a Vercel environment key
- inFlow order automation for QuickBooks invoicing and manufacture orders

## Required Vercel environment variables
Copy `.env.example` values into Vercel Project Settings > Environment Variables.

### Shopify
`SHOPIFY_STORE_DOMAIN=precisionatv-com.myshopify.com`
`SHOPIFY_STOREFRONT_TOKEN=<Storefront API public access token>`
`SHOPIFY_ADMIN_CLIENT_ID=<Dev Dashboard app client ID>`
`SHOPIFY_ADMIN_CLIENT_SECRET=<Dev Dashboard app client secret>`

Grant the app `read_reports` and `read_orders`. The server exchanges these credentials for a short-lived Admin API access token automatically. Existing legacy/admin-created apps can alternatively set `SHOPIFY_ADMIN_ACCESS_TOKEN`.

### GA4 client tracking
`GA4_MEASUREMENT_ID=G-ND2GJ5FD6S`

### Private owner reporting dashboard
`GA4_PROPERTY_ID=556833689`
`GSC_SITE_URL=sc-domain:precisionatvfab.com`
`GOOGLE_SERVICE_ACCOUNT_EMAIL=<service-account-email>`
`GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY=<private-key>`
`DASHBOARD_KEY=<long random password>`

For fully live Google reporting in the private dashboard, add the Google service-account email as a viewer on GA4 and as a user on the matching Google Search Console property. Without those server credentials, the storefront still collects GA4 and the dashboard can show the Search Console snapshot.

## Shopify behavior
If Shopify credentials are missing, the site uses a 33-product preview catalog based on the existing Precision ATV store. Once credentials are added, `/api/products` automatically switches to live Shopify products, prices, variants, availability and product images. Checkout is created through Shopify's Storefront Cart API.

## Shopify → inFlow → QuickBooks → Manufacturing automation

The integration uses inFlow as the operational source of truth:

1. Shopify's inFlow Connector creates the inFlow sales order.
2. inFlow sends a `salesOrder.created` webhook to `/api/inflow-sales-order-webhook`.
3. The webhook verifies inFlow's HMAC signature and reloads the canonical sales order with `lines.product`.
4. The integration calls inFlow's `quick-invoice` action. When the inFlow QuickBooks Online sales-order push is enabled, this creates the matching QuickBooks invoice.
5. Each positive-quantity sales-order line whose product has an inFlow BOM (`isManufacturable=true`) receives its own inFlow manufacture order with `fillDefaultBom=true`.
6. Manufacture-order IDs are deterministic from the sales-order/line IDs, so webhook retries update the same MO instead of creating duplicates.

### inFlow prerequisites

In inFlow, enable both supported integrations before turning on the webhook:

- **Shopify:** install/authorize the inFlow Connector and enable Shopify order import.
- **QuickBooks Online:** connect the correct QBO company and enable **Sales order push**.
- **Manufacturing:** the products that should trigger build orders must have BOMs and the account must support manufacture orders.
- **API:** generate an API key and copy the inFlow `companyId`.

Add these Vercel variables:

`INFLOW_COMPANY_ID=<inFlow company UUID>`
`INFLOW_API_KEY=<inFlow API key>`
`INFLOW_API_VERSION=2026-09-29`
`INFLOW_DEFAULT_LOCATION_ID=<optional fallback location UUID>`

### Register the webhook

After the project is deployed with the company ID/API key, call:

`POST /api/inflow-webhook-setup`

Authenticate with:

`Authorization: Bearer <DASHBOARD_KEY or INTEGRATION_SETUP_KEY>`

The setup endpoint registers `salesOrder.created` and returns the webhook secret **once**. Save that response value as:

`INFLOW_WEBHOOK_SECRET=<returned secret>`

Then redeploy. The public webhook route will reject any delivery whose `x-inflow-hmac-sha256` signature does not match.

### Health check

`GET /api/inflow-integration-health`

Use the same Bearer authorization. It reports whether the API credentials work, whether the `salesOrder.created` subscription exists/is enabled, and whether the local webhook secret is configured.

### Failure/retry behavior

The webhook is intentionally synchronous. If quick invoicing or manufacture-order creation fails, it returns HTTP 500 so inFlow can retry. Retrying is safe: already-invoiced sales orders are skipped, and manufacture orders use stable IDs.

## Domain
The files currently use `https://precisionatvfab.com/` as the intended canonical production domain. Update `canonical`, `robots.txt`, `sitemap.xml`, and `GSC_SITE_URL` if a different final domain is selected.
<!-- Dashboard deployment refresh -->

## Admin
The public storefront has no analytics link. Owners sign in at `/admin`. Authentication uses an HttpOnly signed session cookie; the browser never stores the admin password itself. Shopify reporting uses ShopifyQL when `read_reports` is available and falls back to recent-order totals with `read_orders`.
<!-- Shopify admin credentials deployment refresh -->
<!-- main precision-atv env refresh -->
<!-- dashboard key reset deploy -->
<!-- single-project deploy after duplicate removal -->
<!-- post-cooldown deploy retry -->
<!-- pro-plan production deploy -->
<!-- redeploy: shopify storefront env refresh -->

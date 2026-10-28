import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = name => readFileSync(new URL('../' + name, import.meta.url), 'utf8');

test('Vercel shop does not send Google to the deprecated Shopify shop redirect', () => {
  const html = read('shop.html');
  assert.match(html, /<meta name="robots" content="noindex,follow">/);
  assert.match(html, /<link rel="canonical" href="https:\/\/precisionatvfab\.com\/collections\/all">/);
  assert.doesNotMatch(html, /rel="canonical" href="https:\/\/precisionatvfab\.com\/shop"/);
});

test('Vercel SEO landing pages use indexable Shopify collections as canonicals', () => {
  const js = read('api/seo-landing.js');
  for (const handle of ['/collections/engine', '/collections/canam', '/collections/piston-kits-components']) {
    assert.ok(js.includes("canonicalPath:'" + handle + "'"));
  }
  assert.match(js, /const canonical=BASE\+section\.canonicalPath/);
  assert.match(js, /name="robots" content="noindex,follow"/);
});

test('generated sitemap uses final Shopify URLs rather than redirected legacy pages', () => {
  const js = read('api/sitemap.js');
  for (const handle of ['/collections/all', '/collections/engine', '/collections/canam', '/collections/piston-kits-components', '/pages/dyno-tune', '/pages/about-us-1', '/pages/contact']) {
    assert.ok(js.includes("BASE+'" + handle + "'"), 'Missing ' + handle);
  }
  for (const legacy of ['/shop', '/engines/polaris', '/engines/can-am', '/rebuild-kits-parts', '/services', '/about', '/contact']) {
    assert.ok(!js.includes("BASE+'" + legacy + "'"), 'Legacy canonical remains: ' + legacy);
  }
});

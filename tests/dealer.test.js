import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html=readFileSync(new URL('../dealer.html',import.meta.url),'utf8');

test('dealer sign-in uses the Shopify customer accounts configured for the store',()=>{
  assert.match(html,/href="https:\/\/shopify\.com\/61762109686\/account"/);
  assert.match(html,/one-time sign-in code/);
  assert.doesNotMatch(html,/type="password"/);
  assert.doesNotMatch(html,/href="\/admin"/);
});

test('dealer shopping stays on Shopify after sign-in, not the retail cart',()=>{
  assert.match(html,/href="https:\/\/precisionatvfab\.com\/collections\/all"/);
  assert.match(html,/Shop catalog after sign-in/);
  assert.match(html,/select your approved company and location/i);
  assert.doesNotMatch(html,/href="\/cart"/);
});

test('dealer page never claims a public price is wholesale',()=>{
  assert.match(html,/Dealer-only pricing and availability appear only when Shopify recognizes your approved company session/);
  assert.match(html,/Prices shown in our separate retail shop are not dealer quotes/);
});

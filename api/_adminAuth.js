import {createHash,createHmac,timingSafeEqual} from 'node:crypto';

const FALLBACK_HASH='a7fb265a91b2972e66d1869165a86196d61fcfeccecef7536848a5808725e28c';
const SESSION_LABEL='precision-atv-admin-v2';

function sha(value){return createHash('sha256').update(String(value||'')).digest('hex')}
function secret(){return process.env.DASHBOARD_KEY||FALLBACK_HASH}
function sessionToken(){return createHmac('sha256',secret()).update(SESSION_LABEL).digest('hex')}
function safeEqual(a,b){
  const x=Buffer.from(String(a||'')),y=Buffer.from(String(b||''));
  return x.length===y.length&&timingSafeEqual(x,y);
}
export function verifyAdminPassword(value){
  const expected=process.env.DASHBOARD_KEY;
  if(expected)return safeEqual(value,expected);
  return safeEqual(sha(value),FALLBACK_HASH);
}
export function cookieValue(req,name){
  const raw=String(req.headers.cookie||'');
  for(const part of raw.split(';')){
    const [k,...rest]=part.trim().split('=');
    if(k===name)return decodeURIComponent(rest.join('=')||'');
  }
  return '';
}
export function isAdmin(req){return safeEqual(cookieValue(req,'patv_admin'),sessionToken())}
export function adminCookie(){
  return `patv_admin=${sessionToken()}; Path=/; HttpOnly; Secure; SameSite=Strict`;
}
export function clearAdminCookie(){
  return 'patv_admin=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0';
}

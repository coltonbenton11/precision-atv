import {createHmac,timingSafeEqual} from 'node:crypto';

const SESSION_LABEL='precision-atv-admin-v2';

function secret(){return String(process.env.DASHBOARD_KEY||'')}
function sessionToken(){return secret()?createHmac('sha256',secret()).update(SESSION_LABEL).digest('hex'):''}
function safeEqual(a,b){
  const x=Buffer.from(String(a||'')),y=Buffer.from(String(b||''));
  return x.length===y.length&&timingSafeEqual(x,y);
}
export function verifyAdminPassword(value){
  return Boolean(secret()) && safeEqual(value,secret());
}
export function cookieValue(req,name){
  const raw=String(req.headers.cookie||'');
  for(const part of raw.split(';')){
    const [k,...rest]=part.trim().split('=');
    if(k===name)return decodeURIComponent(rest.join('=')||'');
  }
  return '';
}
export function isAdmin(req){return Boolean(secret()) && safeEqual(cookieValue(req,'patv_admin'),sessionToken())}
export function adminCookie(){
  return `patv_admin=${sessionToken()}; Path=/; HttpOnly; Secure; SameSite=Strict`;
}
export function clearAdminCookie(){
  return 'patv_admin=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0';
}

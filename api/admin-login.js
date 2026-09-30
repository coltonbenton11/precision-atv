import {verifyAdminPassword,adminCookie} from './_adminAuth.js';
export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  const password=String(req.body?.password||'');
  if(!verifyAdminPassword(password))return res.status(401).json({error:'Invalid login'});
  res.setHeader('Set-Cookie',adminCookie());
  return res.status(200).json({ok:true});
}

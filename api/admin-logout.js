import {clearAdminCookie} from './_adminAuth.js';
export default function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  res.setHeader('Set-Cookie',clearAdminCookie());
  return res.status(200).json({ok:true});
}

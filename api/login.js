const A=require('../lib/auth');
module.exports=A.guard(async(req,res)=>{
  if(req.method!=='POST') return res.status(405).json({error:'Use POST'});
  if(!A.limit(req,'login',10)) return res.status(429).json({error:'Too many attempts. Wait a minute.'});
  if(!A.required()) return res.status(200).json({ok:true});
  if(!A.codeOk((req.body||{}).code)) return res.status(401).json({error:'Wrong access code.'});
  A.setCookie(req,res); res.status(200).json({ok:true});
},{open:true});

const crypto=require('crypto');
const token=()=>crypto.createHmac('sha256',String(process.env.ACCESS_CODE||'')).update('riverlens-session-v1').digest('hex');
const required=()=>!!process.env.ACCESS_CODE;
function cookie(req,name){const m=(req.headers.cookie||'').split(/;\s*/).find(c=>c.startsWith(name+'='));return m?decodeURIComponent(m.slice(name.length+1)):''}
function same(a,b){const x=Buffer.from(String(a)),y=Buffer.from(String(b));return x.length===y.length&&crypto.timingSafeEqual(x,y)}
const authed=req=>!required()||same(cookie(req,'rl_auth'),token());
function setCookie(req,res){const secure=(req.headers['x-forwarded-proto']||'').includes('https')?'; Secure':'';
  res.setHeader('Set-Cookie',`rl_auth=${token()}; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000${secure}`)}
const codeOk=c=>required()&&same(c||'',process.env.ACCESS_CODE);
const hits=new Map();
function limit(req,key,max,ms=60000){const ip=(req.headers['x-forwarded-for']||'').split(',')[0]||'anon',k=key+ip,now=Date.now();
  const a=(hits.get(k)||[]).filter(t=>now-t<ms);if(a.length>=max)return false;a.push(now);hits.set(k,a);return true}
// wraps a handler: auth, JSON errors
const guard=(fn,{open=false}={})=>async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  try{ if(!open&&!authed(req)) return res.status(401).json({error:'Please enter the access code.',code:'access'}); return await fn(req,res) }
  catch(e){ console.error(e); return res.status(500).json({error:'Server error: '+String(e.message||e).slice(0,200)}) }
};
module.exports={authed,required,setCookie,codeOk,limit,guard};

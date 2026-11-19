const {db}=require('../lib/db'); const A=require('../lib/auth'); const {runAnalysis}=require('../lib/analysis');
const iso=()=>new Date().toISOString();
const LIST=`SELECT o.id,o.created_at,o.site,o.note,o.status AS obs_status,f.id AS finding_id,f.primary_category,f.uncertainty,f.needs_review,f.status AS finding_status,f.mode,f.model,f.error,f.final_category,f.reviewer
 FROM observations o LEFT JOIN findings f ON f.id=(SELECT MAX(id) FROM findings WHERE observation_id=o.id) ORDER BY o.id DESC LIMIT 500`;
module.exports=A.guard(async(req,res)=>{
  const d=await db(); if(!d) return res.status(503).json({error:'Database is not connected.',code:'no_db'});
  if(req.method==='GET') return res.status(200).json(await d.query(LIST));
  if(req.method!=='POST') return res.status(405).json({error:'Use GET or POST'});
  if(!A.limit(req,'create',20)) return res.status(429).json({error:'Too many uploads. Please wait a minute.'});
  const b=req.body||{}; const img=b.image,th=b.thumb;
  if(typeof img!=='string'||img.length<100||img.length>3_500_000) return res.status(400).json({error:'Send a resized JPEG as base64 (max about 2.5 MB).'});
  if(th&&(typeof th!=='string'||th.length>200_000)) return res.status(400).json({error:'Thumbnail too large.'});
  const site=String(b.site||'').trim().slice(0,120)||'Unspecified', note=String(b.note||'').trim().slice(0,1000);
  const stats=b.stats&&typeof b.stats==='object'?{mean:+b.stats.mean||0,edge:+b.stats.edge||0}:null;
  const ins=await d.query(`INSERT INTO observations(created_at,site,note,image_b64,thumb_b64,stats,status) VALUES($1,$2,$3,$4,$5,$6,'analysing') RETURNING id`,[iso(),site,note,img,th||null,stats?JSON.stringify(stats):null]);
  const id=Number(ins[0].id); await runAnalysis(d,id,img,stats);
  res.status(201).json({id});
});

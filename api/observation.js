const {db}=require('../lib/db'); const A=require('../lib/auth');
module.exports=A.guard(async(req,res)=>{
  const d=await db(); if(!d) return res.status(503).json({error:'Database is not connected.',code:'no_db'});
  const id=parseInt(req.query.id,10); if(!id) return res.status(400).json({error:'Missing id'});
  const o=(await d.query(`SELECT id,created_at,site,note,status FROM observations WHERE id=$1`,[id]))[0];
  if(!o) return res.status(404).json({error:'Not found'});
  const fs=await d.query(`SELECT * FROM findings WHERE observation_id=$1 ORDER BY id DESC`,[id]);
  o.findings=fs.map(f=>{const {report_json,...r}=f; r.report=report_json?JSON.parse(report_json):null; return r});
  res.status(200).json(o);
});

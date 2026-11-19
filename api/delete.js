const {db}=require('../lib/db'); const A=require('../lib/auth');
module.exports=A.guard(async(req,res)=>{
  if(req.method!=='POST') return res.status(405).json({error:'Use POST'});
  const d=await db(); if(!d) return res.status(503).json({error:'Database is not connected.',code:'no_db'});
  const id=parseInt((req.body||{}).id,10); if(!id) return res.status(400).json({error:'Missing id'});
  await d.query(`DELETE FROM findings WHERE observation_id=$1`,[id]); await d.query(`DELETE FROM observations WHERE id=$1`,[id]); res.status(200).json({ok:true});
});

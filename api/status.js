const {config}=require('../lib/riverlens'); const {configured}=require('../lib/db'); const A=require('../lib/auth');
module.exports=(req,res)=>{ const c=config(); res.setHeader('Cache-Control','no-store');
  res.status(200).json({ai_configured:!!c.provider,provider:c.provider,model:c.model||null,db_configured:configured(),access_code_required:A.required(),authed:A.authed(req)}) };

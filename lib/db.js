// Database access. Production: Neon Postgres via DATABASE_URL. Local tests: DATABASE_URL=sqlite:<file> (Node's built-in SQLite).
let impl=null, ready=null;
const PG_DDL=[
 `CREATE TABLE IF NOT EXISTS observations(id SERIAL PRIMARY KEY, created_at TEXT NOT NULL, site TEXT, note TEXT, image_b64 TEXT NOT NULL, thumb_b64 TEXT, stats TEXT, status TEXT NOT NULL DEFAULT 'analysing')`,
 `CREATE TABLE IF NOT EXISTS findings(id SERIAL PRIMARY KEY, observation_id INTEGER NOT NULL REFERENCES observations(id) ON DELETE CASCADE, created_at TEXT NOT NULL, model TEXT, mode TEXT, report_json TEXT, primary_category TEXT, uncertainty TEXT, needs_review INTEGER NOT NULL DEFAULT 1, status TEXT NOT NULL DEFAULT 'ai_draft', run_ms INTEGER, error TEXT, reviewer TEXT, review_comment TEXT, reviewed_at TEXT, final_category TEXT)`,
 `CREATE INDEX IF NOT EXISTS findings_obs ON findings(observation_id)`];
function connect(){
  const url=process.env.DATABASE_URL||process.env.POSTGRES_URL;
  if(!url) return null;
  if(url.startsWith('sqlite:')){
    const {DatabaseSync}=require('node:sqlite'); const d=new DatabaseSync(url.slice(7)||':memory:');
    const ddl=PG_DDL.map(s=>s.replace('SERIAL PRIMARY KEY','INTEGER PRIMARY KEY AUTOINCREMENT'));
    return {kind:'sqlite',ddl,query:async(text,params=[])=>{
      const t=text.replace(/\$(\d+)/g,'?$1').replace(/ILIKE/g,'LIKE'); const st=d.prepare(t);
      return /^\s*(select|with)/i.test(t)||/returning/i.test(t)?st.all(...params):(st.run(...params),[])}};
  }
  const {neon}=require('@neondatabase/serverless'); const sql=neon(url);
  return {kind:'pg',ddl:PG_DDL,query:async(text,params=[])=>sql.query?sql.query(text,params):sql(text,params)};
}
async function db(){
  if(!impl){impl=connect(); if(!impl) return null; ready=(async()=>{for(const s of impl.ddl) await impl.query(s)})()}
  await ready; return impl;
}
module.exports={db,configured:()=>!!(process.env.DATABASE_URL||process.env.POSTGRES_URL)};

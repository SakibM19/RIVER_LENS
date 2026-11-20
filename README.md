# RiverLens: shared-database web edition (Vercel + Neon + Gemini)

Website and serverless API on Vercel. Records and photos are saved in a Neon Postgres database, so everyone with the access code sees the same data from any device. Photos are described by Google Gemini. Your laptop is not needed once it is deployed.

```
public/    the website
api/       serverless routes: status, login, observations, observation, image, review, reanalyze, delete
lib/       database, access code, Gemini/Anthropic calls, validation
```

## Deploy (about 15 minutes)
1. **GitHub.** Unzip this folder. On github.com create a repository and use "uploading an existing file" to upload the **contents** of the folder (public, api, lib, package.json, vercel.json, ...). Commit.
2. **Vercel.** On vercel.com sign in with GitHub, **Add New > Project**, select the repository, **Deploy**.
3. **Database.** In the Vercel project open **Storage** (or the Marketplace) and add **Neon** (Postgres). Accept the free plan and connect it to this project. Vercel adds a `DATABASE_URL` (or `POSTGRES_URL`) variable by itself. The tables are created automatically on first use.
4. **Gemini key.** Get a key from Google AI Studio (aistudio.google.com). In the Vercel project go to **Settings > Environment Variables** and add:
   - `GEMINI_API_KEY` = your key
   - `ACCESS_CODE` = a password you choose (share it with your faculty)
5. **Redeploy** (Deployments > latest > Redeploy) so the variables apply, then open your `.vercel.app` address.
6. Check the **Status** tab: AI "on", Database "connected", Access code "required".

If the default model is rejected, add `RIVERLENS_MODEL` with a model name your key can use (default is `gemini-3.8-flash`). `ANTHROPIC_API_KEY` also works instead of Gemini.

## Run locally (optional)
Needs Node 22+. `DATABASE_URL=sqlite:./local.db GEMINI_API_KEY=... ACCESS_CODE=... node dev-server.js` then open http://localhost:3000.
(PowerShell: set each as `$env:NAME="value"` first.) The sqlite mode is for testing only; production uses Neon.

## What was tested, and what was not
Tested locally: every API route, login, review, delete, search, CSV export, demo mode, retry after invalid AI output, a second device seeing the same records. The database during those tests was SQLite and Gemini was a stand-in server.
**Not tested:** a real Neon connection and a real Gemini call. Your first deployment is that test.

## Privacy and limits
- Photos are resized in the browser, and location data is removed, before upload. They are stored in the database and sent to Gemini.
- Everyone with the access code can see all records. There are no individual accounts or roles yet.
- If `ACCESS_CODE` is not set the site is open to anyone with the link (the site warns you).
- Free hosting, database and AI plans have size and usage limits that can change. Check them. Roughly 300 KB per photo is stored.
- Visual descriptions only. No water-quality measurement, no safety judgement, no pollution-source identification.

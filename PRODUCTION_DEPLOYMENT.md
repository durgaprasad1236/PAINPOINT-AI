# Production Deployment (Render + Vercel)

## 1) Backend (Render)

### Service setup
- Create a new **Web Service** on Render.
- Connect repository.
- Set **Root Directory** to: `backend`
- Build Command: `pip install -r requirements.txt`
- Start Command: `uvicorn main:app --host 0.0.0.0 --port 10000`

### Environment variables (Render)
Set these in Render dashboard:
- `ENV=production`
- `API_KEY=<your_llm_api_key>`
- `APP_BASE_URL=https://<your-render-service>.onrender.com`
- `FRONTEND_URL=https://<your-vercel-project>.vercel.app`
- `ALLOWED_ORIGINS=https://<your-vercel-project>.vercel.app,https://www.<your-domain>.com`
- `CORS_ORIGIN_REGEX=^https://.*\.vercel\.app$`

### Health check
- `GET /api/health`

## 2) Frontend (Vercel)

### Project setup
- Import repo into Vercel.
- Set **Root Directory** to: `frontend`
- Framework preset: `Other`
- Build Command: _(leave empty)_
- Output Directory: `.`

### Runtime config
- Edit `frontend/config.js` and set:
  - `API_BASE_URL: 'https://<your-render-service>.onrender.com'`

### Routing / refresh support
- `frontend/vercel.json` already includes routes so:
  - `/` opens `dashboard.html`
  - `/dashboard` opens `dashboard.html`
  - `/login` opens `login.html`
  - direct refreshes keep working

## 3) Frontend ↔ Backend connection
- Frontend resolves API URL in this order:
  1. `localStorage.backendUrlInput`
  2. `window.APP_CONFIG.API_BASE_URL` from `config.js`
  3. `http://localhost:8000` (local fallback)

## 4) Common production issues

### CORS blocked
- Ensure `ALLOWED_ORIGINS` includes your exact Vercel URL(s) with `https`.
- Keep `CORS_ORIGIN_REGEX` for preview deployments.

### Mixed content (HTTPS page calling HTTP API)
- Use `https://...onrender.com` in `frontend/config.js`.
- Frontend now auto-upgrades `http://` to `https://` when app runs on HTTPS.

### Render cold start delay
- Frontend request helper retries on network/502/503/504 errors.
- If first request times out, retry after a few seconds.

### API keys exposure
- Keep model/API keys only in Render environment variables.
- Do not store server API keys in frontend code or Vercel public env vars.

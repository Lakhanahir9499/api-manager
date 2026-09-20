# Render Free Plan 24/7 Keep-Alive Setup

## Problem
Render **free web services spin down after 15 minutes of inactivity**. First request after spin-down takes 30-60 seconds to cold start.

## Solution: External Ping (Cron Job)

### Option 1: cron-job.org (Free, Easy)
1. Go to https://cron-job.org → Sign up
2. Create new cron job:
   - **URL**: `https://api-manager-backend.onrender.com/health/ping`
   - **Schedule**: Every 10 minutes (`*/10 * * * *`)
   - **Method**: GET
   - **Timeout**: 30 seconds
3. Save → It will ping your backend every 10 min, keeping it warm

### Option 2: UptimeRobot (Free)
1. Go to https://uptimerobot.com → Sign up
2. Add Monitor:
   - **Type**: HTTP(s)
   - **URL**: `https://api-manager-backend.onrender.com/health/ping`
   - **Interval**: 5 minutes
3. This also gives you uptime monitoring

### Option 3: GitHub Actions (Free)
Create `.github/workflows/keep-alive.yml`:
```yaml
name: Keep Render Alive
on:
  schedule:
    - cron: '*/10 * * * *'  # Every 10 minutes
jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - name: Ping backend
        run: curl -f https://api-manager-backend.onrender.com/health/ping
```

### Option 4: Better Uptime / Pingdom / etc.
Any external monitoring service that makes HTTP requests works.

---

## Render Deployment Steps

### 1. Push to GitHub
```bash
cd api-manager
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/api-manager.git
git push -u origin main
```

### 2. Create Render Services via Blueprint
1. Go to https://dashboard.render.com
2. Click **New** → **Blueprint**
3. Connect your GitHub repo
4. Render will detect `render.yaml` and create:
   - `api-manager-backend` (Web Service)
   - `api-manager-frontend` (Static Site)

### 3. Set Required Environment Variables
In Render Dashboard → Backend Service → Environment:

| Key | Value |
|-----|-------|
| `ADMIN_PASSWORD` | `your-secure-password-123` (min 8 chars) |
| `JWT_SECRET` | Generate: `openssl rand -base64 32` |
| `MONGODB_URI` | Already in render.yaml (Atlas) |
| `CORS_ORIGIN` | `https://api-manager-frontend.onrender.com` |

**Frontend** auto-gets `VITE_API_URL` from render.yaml.

### 4. Deploy
Click **Apply** → Render builds and deploys both services.

### 5. Test
- Frontend: `https://api-manager-frontend.onrender.com/admin`
- Backend Health: `https://api-manager-backend.onrender.com/health/ping`
- Login with your `ADMIN_PASSWORD`

---

## MongoDB Atlas Setup (Already Configured)

Your credentials in `render.yaml`:
```
mongodb+srv://admin_db_user:eFuqxb1VvoQmRLgT@cluster0.mongodb.net/api-manager?retryWrites=true&w=majority&appName=Cluster0
```

**Verify in Atlas:**
1. Go to https://cloud.mongodb.com
2. Clusters → Cluster0 → Network Access → Add IP: `0.0.0.0/0` (Allow from anywhere)
3. Database Access → User `admin_db_user` has `readWrite` on `api-manager` database

---

## After Deploy - Seed Database
Once backend is live, run seed:
```bash
# Option 1: Render Shell (in backend service dashboard)
npm run seed

# Option 2: Locally with Atlas URI
MONGODB_URI="mongodb+srv://admin_db_user:eFuqxb1VvoQmRLgT@cluster0.mongodb.net/api-manager?retryWrites=true&w=majority&appName=Cluster0" \
cd backend && npm run seed
```

---

## Custom Domain (Optional)
1. Render Dashboard → Settings → Custom Domains
2. Add your domain → Update DNS (CNAME to `api-manager-frontend.onrender.com`)
3. Update `CORS_ORIGIN` in backend env to your custom domain
4. Render auto-provisions SSL

---

## Monitoring
- **Backend logs**: Render Dashboard → Backend → Logs
- **Frontend logs**: Render Dashboard → Frontend → Logs
- **Uptime**: Use UptimeRobot on `/health/ping`

---

## Cost Summary
| Service | Plan | Cost |
|---------|------|------|
| Backend Web Service | Free | $0 |
| Frontend Static Site | Free | $0 |
| MongoDB Atlas | Free (M0) | $0 |
| Cron-job.org | Free | $0 |
| **Total** | | **$0/month** |

---

## Limitations on Free Plan
- Spins down after 15 min inactivity (solved by keep-alive)
- 750 hours/month limit (enough for 24/7 with keep-alive)
- No persistent disk (MongoDB Atlas handles data)
- Build minutes: 500/month (plenty)
- Bandwidth: 100 GB/month
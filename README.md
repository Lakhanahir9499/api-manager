# API Manager

A self-hosted API management platform to wrap upstream APIs, generate wrapper keys with rate limiting, IP filtering, and full key lifecycle management.

## Features

- 🔐 **Admin-only access** - Single password authentication
- 🔑 **Wrapper API Keys** - Generate keys that proxy to upstream APIs
- 🚫 **Upstream Hidden** - Upstream URLs never exposed in dev tools
- ⚡ **Rate Limiting** - Per-minute, daily, and monthly limits (sliding windows)
- 🌐 **IP Filtering** - Whitelist/blacklist with CIDR support
- 📝 **Key Management** - Create, edit, delete, suspend, unsuspend
- 📊 **Dashboard** - Usage stats, top keys, request counts
- 🐳 **Docker Ready** - Production deployment with nginx, MongoDB, certbot

## Quick Start

### 1. Clone and Configure

```bash
cd api-manager
cp .env.example .env
# Edit .env with your values
```

Required environment variables:
```env
MONGODB_URI=mongodb://mongodb:27017/api-manager
ADMIN_PASSWORD=your-secure-password-min-8-chars
JWT_SECRET=your-super-secret-jwt-key-min-32-chars-long
CORS_ORIGIN=https://your-domain.com
```

### 2. Start with Docker Compose

```bash
docker compose up -d
```

### 3. Access the Admin Panel

Open `http://your-server-ip/admin` and login with your `ADMIN_PASSWORD`.

## Initial Upstream APIs

The platform comes pre-configured with two upstreams:

1. **TG ID API**
   - Base: `https://tele-to-phone.felixrdx.xyz`
   - Path: `/api/developer/Cyb3rB4nn3r/fast`
   - Fixed params: `key=9852cb5d7955459bbceb48553f1a45b9`, `userid=8335023642`
   - Placeholder: `tg_id`

2. **Family API**
   - Base: `https://family.mafiaosint.com`
   - Path: `/`
   - Placeholder: `aadhar`

## Creating Wrapper Keys

1. Go to **API Keys** → **Create Key**
2. Fill in:
   - **Name**: Human-readable name
   - **Upstream API**: Select TG ID API or Family API
   - **Rate Limits**: Per minute / Daily / Monthly (0 = unlimited)
   - **IP Whitelist**: Allowed IPs/CIDRs (one per line, empty = all allowed)
   - **IP Blacklist**: Blocked IPs/CIDRs (one per line)
3. Click **Create** - copy the key immediately (shown only once!)

## Using Wrapper Keys

```bash
# TG ID API example
curl -H "X-API-Key: ak_live_xxxxxxxx" \
  "https://your-domain.com/api/?tg_id=123456789"

# Family API example
curl -H "X-API-Key: ak_live_xxxxxxxx" \
  "https://your-domain.com/api/?aadhar=123456789012"
```

The wrapper key is sent via `X-API-Key` header - **never in URL**, so it's never exposed in browser dev tools.

## Rate Limit Headers

Responses include rate limit info:
```
X-RateLimit-Limit-Minute: 60
X-RateLimit-Remaining-Minute: 59
X-RateLimit-Reset-Minute: 1699999999
X-RateLimit-Limit-Daily: 1000
X-RateLimit-Remaining-Daily: 999
X-RateLimit-Reset-Daily: 1699999999
X-RateLimit-Limit-Monthly: 10000
X-RateLimit-Remaining-Monthly: 9999
X-RateLimit-Reset-Monthly: 1699999999
```

When limit exceeded: `429 Too Many Requests` with `Retry-After` header.

## IP Filtering

- **Whitelist**: If set, only listed IPs/CIDRs can use the key
- **Blacklist**: Listed IPs/CIDRs are always blocked (takes precedence)
- **CIDR Support**: `192.168.1.0/24`, `10.0.0.0/8`, `2001:db8::/32`
- **Exact IPs**: `192.168.1.100`, `2001:db8::1`

## Key Statuses

- **Active**: Key works normally
- **Suspended**: Key returns 403, but configuration preserved
- **Deleted**: Soft delete - key disabled, usage data kept, rate limits cleared

## Production Deployment

### SSL with Let's Encrypt

1. Point your domain to the server
2. Update `nginx/nginx.conf` - uncomment HTTPS server block
3. Replace `your-domain.com` with your domain
4. Run certbot:
   ```bash
   docker compose run --rm certbot certonly \
     --webroot -w /var/www/certbot \
     -d your-domain.com \
     --email your@email.com --agree-tos --no-eff-email
   ```
5. Restart nginx: `docker compose restart nginx`

### Firewall

Only expose ports 80 and 443. MongoDB and backend should not be publicly accessible.

## Development

### Backend

```bash
cd backend
npm install
cp ../.env.example .env
# Edit .env
npm run dev
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Seed Database

```bash
cd backend
npm run seed
```

## API Endpoints

### Admin (requires session cookie)
- `POST /admin/login` - Login
- `POST /admin/logout` - Logout
- `POST /admin/refresh` - Refresh token
- `GET /admin/me` - Check auth
- `GET /admin/stats` - Dashboard stats
- `GET /admin/keys` - List keys
- `POST /admin/keys` - Create key
- `GET /admin/keys/:id` - Get key
- `PATCH /admin/keys/:id` - Update key
- `POST /admin/keys/:id/suspend` - Suspend key
- `POST /admin/keys/:id/unsuspend` - Unsuspend key
- `DELETE /admin/keys/:id` - Delete key
- `GET /admin/keys/:id/stats` - Key usage stats
- `GET /admin/upstreams` - List upstreams
- `POST /admin/upstreams` - Create upstream
- `GET /admin/upstreams/:id` - Get upstream
- `PATCH /admin/upstreams/:id` - Update upstream
- `DELETE /admin/upstreams/:id` - Delete upstream
- `GET /admin/upstreams/active` - Active upstreams

### Proxy (requires X-API-Key header)
- `ALL /api/*` - Proxy to upstream API

### Health
- `GET /health/health` - Health check
- `GET /health/ready` - Readiness check

## Security Notes

- Upstream credentials stored only in backend DB, never sent to frontend
- Wrapper keys hashed with bcrypt (cost 12)
- Admin password hashed at startup
- JWT tokens in HttpOnly, Secure, SameSite=Strict cookies
- CORS restricted to configured origin
- Helmet.js security headers
- Request size limited to 1MB
- Upstream timeout default 10s

## Project Structure

```
api-manager/
├── docker-compose.yml
├── .env.example
├── backend/
│   ├── src/
│   │   ├── config/env.ts          # Zod-validated config
│   │   ├── db/mongo.ts            # MongoDB connection
│   │   ├── models/                # Mongoose models
│   │   ├── middleware/            # Auth, rate limit, IP filter
│   │   ├── routes/                # Admin, proxy, health
│   │   ├── services/              # Business logic
│   │   └── index.ts               # Entry point
│   └── seed.ts                    # Seed initial upstreams
├── frontend/
│   ├── src/
│   │   ├── api/client.ts          # Axios with auto-refresh
│   │   ├── components/            # React components
│   │   ├── pages/                 # Page components
│   │   ├── hooks/                 # Custom hooks
│   │   └── styles/globals.css     # Design system
│   └── nginx.conf                 # Frontend nginx config
└── nginx/
    └── nginx.conf                 # Main nginx config
```

## License

MIT
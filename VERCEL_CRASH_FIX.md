# Nexora Vercel crash fix

This patch addresses the slow Vercel cold start and `FUNCTION_INVOCATION_FAILED` error.

## What changed

- MongoDB no longer connects during module import. The API can start immediately even if Atlas is unavailable.
- MongoDB connections are lazy and cached per warm Vercel function instance.
- MongoDB index checks run in the background rather than blocking every cold start.
- Database connection failures return HTTP 503 JSON instead of crashing the whole Vercel Function.
- `/api/health`, `/api/config`, and an unauthenticated `/api/me` do not wait for MongoDB.
- Production no longer crashes at startup if SMTP variables are missing; sign-in returns a controlled configuration error instead.
- Same-origin requests from `nexora.grapaxels.in` are accepted even when `APP_ORIGIN` is accidentally missing.
- A root Vercel config routes `/api/*` to the Express function and keeps SPA deep links working.

## Required Vercel settings

Your local `.env` is intentionally ignored by Git. Put the same values in:

Vercel -> Project -> Settings -> Environment Variables

At minimum set:

- APP_ORIGIN=https://nexora.grapaxels.in
- API_PUBLIC_ORIGIN=https://nexora.grapaxels.in
- VITE_API_URL=   (leave blank)
- MONGODB_URI=your MongoDB Atlas URI
- MONGODB_DB=Nexora
- SMTP_HOST=smtp.gmail.com
- SMTP_PORT=587
- SMTP_SECURE=tls
- SMTP_USER=your Gmail address
- SMTP_PASS=your Gmail app password
- SMTP_FROM=Nexora <your Gmail address>
- MAIL_FROM=Nexora <your Gmail address>
- ADMIN_EMAILS=your admin email(s)
- SUPER_ADMIN_EMAIL=your super-admin email
- SUPER_ADMIN_PASSWORD_HASH=your existing hash
- CAMPUS_NAME=Lovely Professional University
- NODE_ENV=production

Apply variables to Production (and Preview too if you test Preview deployments), then redeploy.

## MongoDB Atlas network access

Vercel Functions normally use dynamic outbound IPs. If Atlas only allows your laptop/current IP, localhost works but Vercel waits for MongoDB and then fails.

For a standard Vercel deployment, add `0.0.0.0/0` under MongoDB Atlas -> Security -> Network Access, or use a Vercel/Atlas networking option that gives you controlled/static egress.

Keep a strong MongoDB username/password because `0.0.0.0/0` permits connection attempts from any IP; authentication and TLS still protect the database.

## Test after redeploy

1. Open https://nexora.grapaxels.in/api/health
   Expected: {"ok":true,"service":"Nexora API"}
2. Open https://nexora.grapaxels.in/api/config
   Expected: JSON containing your campus name and `mailConfigured:true`.
3. Open https://nexora.grapaxels.in
4. Try email sign-in.

If `/api/health` works but a database-backed endpoint returns 503, check Atlas Network Access and `MONGODB_URI` in Vercel.

# Nexora Campus Marketplace

Nexora is a campus marketplace and community space. Verified members can buy, sell, exchange, or give away items, then connect through private messages or anonymous Campus Pulse conversations.

## What is included

- Searchable marketplace with category, condition, price, and listing-type filters
- Product photo uploads, seller profiles, saved items, and sold status
- Free finds, want-to-buy posts, and a semester-end marketplace
- Anonymous Campus Pulse posts, voting, comments, and private connections
- Participant, report submission, and administrator review tools
- Email verification with expiring one-time codes
- MongoDB persistence using the `Nexora` database

## Local setup

1. Install Node.js 22 or newer and run `npm install`.
2. Copy `.env.example` to `.env`.
3. Set `MONGODB_URI` to your MongoDB Atlas connection string. The database name is controlled by `MONGODB_DB=Nexora`.
4. Configure either SMTP or Resend for verification-code delivery. Any valid email provider is accepted for sign-in.
5. Run `npm run dev`, then open `http://127.0.0.1:5173`.

When `MONGODB_URI` is empty in development, Nexora starts a local MongoDB process with persistent storage under `data/`. Local demo accounts and sample content are enabled by `DEMO_MODE=true`; production always disables them.

## Production

Set `NODE_ENV=production`, `APP_ORIGIN` to the public HTTPS origin, and provide `MONGODB_URI` plus one email provider. SMTP uses `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, and `SMTP_FROM`. Resend uses `RESEND_API_KEY` and `MAIL_FROM`. SMTP takes priority when both are configured. Add moderator emails to `ADMIN_EMAILS`, build with `npm run build`, and start with `npm start`.

For Gmail SMTP, use `smtp.gmail.com`, port `587`, `SMTP_SECURE=false`, your Gmail address as `SMTP_USER`, and a Google app password as `SMTP_PASS`. Never use your normal mailbox password.

Credentials belong in `.env`, which is excluded from Git. See `.env.example` for all supported settings.

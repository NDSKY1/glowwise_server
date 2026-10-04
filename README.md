# GlowWise Server

Backend for **GlowWise** – a beauty & personal-care e-commerce app (Flutter frontend).
Built on the original Valida Foods server: Node.js + Express with JSON-file storage.

## Quick start

```bash
npm install
cp .env.example .env      # then fill in JWT_SECRET and Razorpay keys
npm run seed              # (optional) reload demo categories & products
npm run dev               # or: npm start
```

Server runs on `http://localhost:5005` (change `PORT` in `.env`).

| Script | What it does |
|---|---|
| `npm start` | start server |
| `npm run dev` | start with auto-reload (nodemon) |
| `npm run seed` | rewrite demo categories & products |
| `npm run seed:reset` | seed + clear carts, orders, payments, wishlists, reviews |

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `PORT` | no | default 5005 |
| `JWT_SECRET` | **yes** | signs login tokens – use a long random string |
| `RAZORPAY_KEY_ID` | for payments | Razorpay public key |
| `RAZORPAY_KEY_SECRET` | for payments | Razorpay secret key |
| `CORS_ORIGIN` | no | allowed origins for a web admin panel |

## Demo data

- 9 categories: Skincare, Makeup, Haircare, Body Care, Fragrance, Lip Care, Face Care, Sun Care, Wellness
- 23 beauty products (fictional brands) with prices, discounts, ratings, ingredients,
  skin types and concerns, and placeholder images in `uploads/`
- OTPs for registration / forgot password are written to `logs/otp_logs.txt` (no SMS gateway)

## Connecting the Flutter app

Set `baseUrl` in `lib/constant/api_const.dart` to this server's URL. No other app
changes are required – all existing endpoints and response formats are preserved.

## Documentation

- `docs/API_DOCUMENTATION.md` – every endpoint, parameters and examples
- `docs/PROJECT_ANALYSIS.md` – architecture, models, flows, and everything that changed

## Future scope

- **AI skin analysis** – contract in `services/skinAnalysisService.js`; `/skinAnalysis/analyze` returns 501 until a real model is plugged in
- **AI recommendations** – replace the rule-based scorer in `services/recommendationService.js`

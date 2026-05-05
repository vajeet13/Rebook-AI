# Rebook AI

**Turn no-shows into rebooked revenue using voice AI.**

## Goal

The goal of this system is to reduce appointment no-shows by actively calling users (via a voice AI agent), understanding their intent, and automatically taking actions like confirming, cancelling, or rescheduling appointments.
This repository is the **Express backend** for that workflow: clients and appointments, JWT-scoped APIs, outbound confirmation calls, and a [Bolna](https://www.bolna.ai/) webhook that turns voice outcomes into structured booking updates. It uses MongoDB (Mongoose) and consistent JSON errors for dashboards and integrations.

**Live:** [https://regal-mochi-ba82b6.netlify.app/](https://regal-mochi-ba82b6.netlify.app/)

---

## Features

- **Clients & appointments** — Create and list appointments, update schedule, complete visits; data is scoped per authenticated owner.
- **Voice AI outcomes** — Outbound calls plus webhook handling map executions to confirm, cancel, or reschedule paths on appointments.
- **Waitlist & slot recovery** — When cancellations free a slot, the waitlist drives who is offered the time so capacity is reclaimed.
- **Internal triggers** — Authenticated endpoints to batch confirmation calls or place a single test call linked to an appointment.
- **Health check** — `GET /api/health` stays `503` until MongoDB connects.

---

## Tech stack

- **Runtime:** Node.js (ES modules)
- **Framework:** Express 5
- **Database:** MongoDB via Mongoose
- **Auth:** Access + refresh JWTs (`jsonwebtoken`, `bcryptjs`)
- **Frontend:** Flutter — [Rebook-AI-App](https://github.com/vajeet13/Rebook-AI-App) (web client for this API: auth, dashboard, clients, appointments)

Requires **Node 18+** (uses `node --env-file` in `npm run dev`).

---

## Quick start

### 1. Clone and install

```bash
git clone https://github.com/<your-org>/rebook-ai.git
cd rebook-ai
npm install
```

### 2. Configure environment

Copy `.env.example` to `.env` and set at least:

| Variable | Required | Purpose |
|----------|----------|---------|
| `MONGO_URI` | Yes | MongoDB connection URI |
| `JWT_ACCESS_SECRET` | Yes | Secret for signing access tokens |
| `JWT_REFRESH_SECRET` | Yes | Secret for signing refresh tokens |
| `MONGO_DB_NAME` | No | Database name (default in code is `data`) |
| `PORT` | No | Listener port (default `3000`) |
| `BOLNA_API_KEY` | For calls | Bolna API key |
| `BOLNA_AGENT_ID` | For calls | Bolna agent ID for outbound executions |
| `BOLNA_WEBHOOK_SECRET` | Optional | If set, webhook URL must include `?token=` matching this value |
| `BOLNA_WEBHOOK_VERIFY_IP` | Optional | Set to `true` to enforce allowlisted caller IPs (`BOLNA_WEBHOOK_IPS`) |
| `CONFIRMATION_LEAD_MINUTES` / `CONFIRMATION_LEAD_WINDOW_MINUTES` | Optional | Batch confirmation window for internal triggers |

JWT lifetimes default to access `15m` and refresh `7d` (`JWT_ACCESS_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN`).

On Windows, if Atlas SRV lookup fails (`querySrv ECONNREFUSED`), use a non-SRV URI or set `MONGODB_DNS_SERVERS` as documented in `.env.example`.

### 3. Run

```bash
npm run dev
```

Production:

```bash
npm start
```

### 4. Postman

Import `postman/Rebook-AI.Local.postman_collection.json` or `postman/Rebook-AI.Production.postman_collection.json` to exercise the HTTP API locally or against a deployed host.

---

## API overview

Base path for JSON APIs is `/api`.

### Health

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/api/health` | `200` `{ "ok": true }` once MongoDB is connected; `503` while starting |

### Auth (`/api/auth`)

| Method | Path | Notes |
|--------|------|--------|
| `POST` | `/register` | Create user |
| `POST` | `/login` | Returns access + refresh tokens |
| `POST` | `/refresh` | Issue new access token |
| `POST` | `/logout` | Revokes refresh token session |

### Users (`/api/users`) — Bearer access token required

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/me` | Current profile |
| `POST` | `/me` | Update profile |
| `POST` | `/me/password` | Change password |
| `GET` | `/` | List users (**admin**) |
| `GET` | `/:userId` | User by id (**admin**) |

### Clients (`/api/clients`)

| Method | Path | Notes |
|--------|------|--------|
| `POST` | `/` | Create client |
| `GET` | `/` | List clients |
| `GET` | `/:clientId` | Get client |
| `PATCH` | `/:clientId` | Update client |

### Appointments (`/api/appointments`)

| Method | Path | Notes |
|--------|------|--------|
| `POST` | `/` | Create appointment |
| `GET` | `/` | List appointments |
| `GET` | `/:appointmentId` | Get appointment |
| `PATCH` | `/:appointmentId` | Update schedule/details |
| `PATCH` | `/:appointmentId/complete` | Mark complete |

### Webhooks (`/api/webhooks/bolna`)

| Method | Path | Notes |
|--------|------|--------|
| `POST` | `/` | Bolna analytics webhook; optional `verifyBolnaWebhook` via query token and/or IP allowlist |

Configure this URL in your Bolna project (e.g. `https://your-host/api/webhooks/bolna`). Pass **`appointmentId`** in call metadata / `user_data` so executions can update the correct document. Extractions commonly include outcome fields such as confirmation, cancellation reason, or a new ISO slot; see `services/bolnaExtractedData.js` for how payloads are interpreted.

### Internal (`/api/internal`) — Bearer access token required

| Method | Path | Notes |
|--------|------|--------|
| `POST` | `/trigger-confirmation-calls` | Within the configured lead window, queue confirmation calls for eligible appointments |
| `POST` | `/trigger-bolna-call/:appointmentId` | Trigger a Bolna outbound call for one appointment |
| `GET` | `/bolna-executions/:appointmentId` | Inspect stored execution metadata |

---

## Example: register and call a protected route

```bash
# Register
curl -s -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"firstName":"Test","lastName":"User","email":"test@example.com","password":"secret123"}'

# Login — copy accessToken from response
curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"secret123"}'

# Current user
curl -s http://localhost:3000/api/users/me \
  -H "Authorization: Bearer ACCESS_TOKEN_HERE"
```

On **Windows CMD**, caret line continuation (`^`) works with `curl.exe`. In **PowerShell**, prefer `-Body '{"email":"..."}'` with `Invoke-RestMethod` or quoted JSON compatible with your shell.

---

## Repository layout

```
config/          Mongo connection and options
controllers/     Route handlers (auth, users, clients, appointments, webhooks, …)
middleware/      Auth, roles, webhook verification, errors
models/          Mongoose schemas
postman/         Postman collection
routes/          Express routers
services/        Business logic (appointments, Bolna client/normalize/webhook)
utils/           Shared helpers (responses, errors, owner scope)
server.js        App entry — mounts routes and listens
```

---

## Security notes for production

- Use strong random values for JWT secrets and never commit `.env`.
- Run behind HTTPS; `trust proxy` is enabled when you terminate TLS at a load balancer — configure `X-Forwarded-For` correctly if you enable Bolna IP verification.
- Restrict database network access (Atlas IP allowlist or VPC) and rotate API keys regularly.

---

## License

ISC — see `package.json`. Third-party logos and trademarks (e.g. Bolna) belong to their owners; this project is not affiliated with them.

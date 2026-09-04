# Creative Jewelry B2B Shop

Wholesale ordering portal connected to the Creative Jewelry POS API.

The B2B shop serves a live catalog from the POS system, lets wholesale buyers place reservation-based orders, and provides a staff admin panel for reviewing users, orders, notifications, and sales reports.

## Stack

| Layer | Technology |
| --- | --- |
| Frontend | React, TypeScript, Vite, Tailwind CSS |
| Backend | Express, TypeScript |
| Database | PostgreSQL 16 |
| Deployment | Docker Compose, Coolify-compatible |

## Repository Layout

```text
client/               B2B React frontend
server/               B2B Express API
scripts/              helper scripts
Dockerfile            production image
docker-compose.yaml   Coolify-compatible compose file
```

## Local Development

### Requirements

- Node.js 22+
- npm
- PostgreSQL 16+
- Running POS API

The POS API must be available because the B2B shop reads catalog, stock, prices, reservations, and staff login from it.

Install dependencies:

```bash
npm install --prefix server
npm install --prefix client
```

Create `server/.env` from `server/.env.example` and set:

```env
PORT=4100
SHOP_JWT_SECRET=change-me-to-a-long-random-string
API_BASE_URL=http://localhost:4001
B2B_USERNAME=b2b
B2B_PIN=1234
SHOP_PGHOST=127.0.0.1
SHOP_PGPORT=5432
SHOP_PGUSER=b2b_shop
SHOP_PGPASSWORD=change-me
SHOP_PGDATABASE=b2b_shop
STORE_NAME=Wholesale Shop
CURRENCY=EGP
GUEST_ORDERING_ENABLED=true
DOWN_PAYMENT_PERCENT=0
PUBLIC_PRICES=true
ACCOUNT_APPROVAL_ENABLED=true
DEFAULT_PAYMENT_METHOD=transfer
```

Run the backend and frontend:

```bash
npm run api
npm run web
```

B2B API runs on `http://localhost:4100`.

## Build

```bash
npm run build
npm run typecheck
```

## Docker Deployment

Start the B2B shop and its PostgreSQL database:

```bash
docker compose up --build -d
```

Check status:

```bash
docker compose ps
docker compose logs -f b2b
```

The compose file defines:

| Service | Purpose | Internal port |
| --- | --- | --- |
| `b2b` | B2B backend + built frontend | `4100` |
| `b2b-postgres` | B2B PostgreSQL database | `5432` |

Persistent volume:

| Volume | Stores |
| --- | --- |
| `b2b-postgres-data` | B2B PostgreSQL data |

The B2B database schema is created automatically by the server on startup.

## Coolify Deployment

Use **Docker Compose** deployment in Coolify and point it to `docker-compose.yaml`.

No public `ports` are exposed directly. The app exposes internal port `4100`, and Coolify can route the public domain through `SERVICE_URL_B2B_4100`.

Set production variables in Coolify:

```env
SERVICE_REALBASE64_64_B2B=generate-a-strong-secret
SERVICE_PASSWORD_B2B_POSTGRES=generate-a-strong-db-password
SHOP_PGUSER=b2b_shop
SHOP_PGDATABASE=b2b_shop
POS_API_URL=https://pos.goldencrown.com.eg
B2B_USERNAME=b2b
B2B_PIN=change-this-pin
STORE_NAME=Wholesale Shop
CURRENCY=EGP
GUEST_ORDERING_ENABLED=true
DOWN_PAYMENT_PERCENT=0
PUBLIC_PRICES=true
ACCOUNT_APPROVAL_ENABLED=true
DEFAULT_PAYMENT_METHOD=transfer
```

If this B2B repository is deployed separately from the POS repository, set `POS_API_URL` to the public or private reachable URL of the POS API. It defaults to `https://pos.goldencrown.com.eg` for this deployment.

## Production Notes

- Change all default secrets, passwords, and staff PINs before publishing.
- Keep PostgreSQL private and expose only the B2B HTTP service through Coolify.
- Back up the `b2b-postgres-data` volume.
- If you have old B2B SQLite data, migrate it before switching production traffic to this PostgreSQL version.
- The staff admin panel is part of the B2B application. Staff authentication is delegated to the POS employee login.

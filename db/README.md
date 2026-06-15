# Local PostgreSQL Setup

This folder contains the local PostgreSQL schema and sample business data for the Electron app.

Default connection values:

```text
host: localhost
port: 5432
user: postgres
database: vue_electron
```

Create a local connection file before running the Electron app:

```powershell
Copy-Item db/local.env.example db/local.env
```

Then edit `db/local.env` and put the PostgreSQL password you set during installation:

```text
PGHOST=localhost
PGPORT=5432
PGUSER=postgres
PGPASSWORD=your-password
PGDATABASE=vue_electron
```

Run setup after PostgreSQL is installed:

```powershell
npm run db:setup
```

Drop and recreate the local database:

```powershell
npm run db:reset
```

Optional environment variables:

```powershell
$env:PGHOST="localhost"
$env:PGPORT="5432"
$env:PGUSER="postgres"
$env:PGDATABASE="vue_electron"
$env:PGPASSWORD="your-password"
npm run db:setup
```

The Electron app reads `db/local.env` automatically. The file is ignored by git so the local database password is not committed.

Included tables:

- `departments`
- `app_users`
- `customers`
- `products`
- `closing_batches`
- `sales_closing_rows`
- `validation_issues`
- `mail_queue`
- `mail_attachments`
- `sync_outbox`

The seed data includes six customers, six products, one June 2026 closing batch, validation issues, mail queue rows, attachment records, and one pending sync outbox item.

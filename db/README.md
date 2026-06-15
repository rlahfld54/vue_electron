# Local PostgreSQL Setup

This folder contains the local PostgreSQL schema and sample business data for the Electron app.

Default connection values:

```text
host: localhost
port: 5432
user: postgres
database: vue_electron
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

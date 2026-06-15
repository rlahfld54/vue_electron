const fs = require('fs')
const path = require('path')
const { Client } = require('pg')

function loadLocalEnv() {
  const envPath = path.join(__dirname, 'local.env')
  const examplePath = path.join(__dirname, 'local.env.example')
  const targetPath = fs.existsSync(envPath) ? envPath : examplePath

  if (!fs.existsSync(targetPath)) return

  fs.readFileSync(targetPath, 'utf8')
    .split(/\r?\n/)
    .forEach((line) => {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) return

      const separatorIndex = trimmed.indexOf('=')
      if (separatorIndex < 1) return

      const key = trimmed.slice(0, separatorIndex).trim()
      const value = trimmed.slice(separatorIndex + 1).trim().replace(/^["']|["']$/g, '')

      if (!process.env[key]) {
        process.env[key] = value
      }
    })
}

function config(database) {
  return {
    host: process.env.PGHOST || 'localhost',
    port: Number(process.env.PGPORT || 5432),
    user: process.env.PGUSER || 'postgres',
    password: String(process.env.PGPASSWORD ?? ''),
    database,
    connectionTimeoutMillis: 3000
  }
}

function quoteIdentifier(value) {
  return `"${String(value).replaceAll('"', '""')}"`
}

async function withClient(database, fn) {
  const client = new Client(config(database))
  await client.connect()

  try {
    return await fn(client)
  } finally {
    await client.end()
  }
}

async function main() {
  loadLocalEnv()

  const database = process.env.PGDATABASE || 'vue_electron'
  const adminDatabase = process.env.PGADMIN_DATABASE || 'postgres'
  const reset = process.argv.includes('--reset')
  const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8')
  const seedSql = fs.readFileSync(path.join(__dirname, 'seed.sql'), 'utf8')

  console.log(`Using PostgreSQL ${process.env.PGHOST || 'localhost'}:${process.env.PGPORT || 5432} as ${process.env.PGUSER || 'postgres'}.`)

  await withClient(adminDatabase, async (client) => {
    if (reset) {
      console.log(`Dropping database '${database}'...`)
      await client.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1', [database])
      await client.query(`DROP DATABASE IF EXISTS ${quoteIdentifier(database)}`)
    }

    const existing = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [database])
    if (existing.rowCount === 0) {
      console.log(`Creating database '${database}'...`)
      await client.query(`CREATE DATABASE ${quoteIdentifier(database)} WITH ENCODING 'UTF8' TEMPLATE template0`)
    } else {
      console.log(`Database '${database}' already exists.`)
    }
  })

  await withClient(database, async (client) => {
    console.log('Applying schema...')
    await client.query(schemaSql)

    console.log('Inserting seed data...')
    await client.query(seedSql)
  })

  console.log(`Done. Local PostgreSQL database '${database}' is ready.`)
}

main().catch((error) => {
  if (error.message?.includes('password authentication failed') || error.message?.includes('SASL')) {
    console.error('PostgreSQL authentication failed. Check db/local.env PGUSER and PGPASSWORD.')
  } else {
    console.error(error.message)
  }

  process.exit(1)
})

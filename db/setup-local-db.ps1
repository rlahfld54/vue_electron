param(
  [string]$HostName = $(if ($env:PGHOST) { $env:PGHOST } else { "localhost" }),
  [int]$Port = $(if ($env:PGPORT) { [int]$env:PGPORT } else { 5432 }),
  [string]$User = $(if ($env:PGUSER) { $env:PGUSER } else { "postgres" }),
  [string]$AdminDatabase = $(if ($env:PGADMIN_DATABASE) { $env:PGADMIN_DATABASE } else { "postgres" }),
  [string]$Database = $(if ($env:PGDATABASE) { $env:PGDATABASE } else { "vue_electron" }),
  [switch]$Reset
)

$ErrorActionPreference = "Stop"

$psql = Get-Command psql -ErrorAction SilentlyContinue
if (-not $psql) {
  throw "psql command was not found. Install PostgreSQL first, then add PostgreSQL bin folder to PATH."
}

$dbDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$schemaFile = Join-Path $dbDir "schema.sql"
$seedFile = Join-Path $dbDir "seed.sql"

function Invoke-Psql {
  param(
    [string]$DatabaseName,
    [string[]]$Arguments
  )

  & psql -h $HostName -p $Port -U $User -d $DatabaseName @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "psql failed with exit code $LASTEXITCODE."
  }
}

Write-Host "Using PostgreSQL server ${HostName}:$Port as user '$User'."

if ($Reset) {
  Write-Host "Reset requested. Dropping database '$Database' if it exists..."
  Invoke-Psql -DatabaseName $AdminDatabase -Arguments @("-c", "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$Database';")
  Invoke-Psql -DatabaseName $AdminDatabase -Arguments @("-c", "DROP DATABASE IF EXISTS ""$Database"";")
}

$exists = & psql -h $HostName -p $Port -U $User -d $AdminDatabase -tAc "SELECT 1 FROM pg_database WHERE datname = '$Database';"
if ($LASTEXITCODE -ne 0) {
  throw "Could not check database existence."
}

if (-not ($exists -match "1")) {
  Write-Host "Creating database '$Database'..."
  Invoke-Psql -DatabaseName $AdminDatabase -Arguments @("-c", "CREATE DATABASE ""$Database"" WITH ENCODING 'UTF8' TEMPLATE template0;")
} else {
  Write-Host "Database '$Database' already exists."
}

Write-Host "Applying schema..."
Invoke-Psql -DatabaseName $Database -Arguments @("-f", $schemaFile)

Write-Host "Inserting seed data..."
Invoke-Psql -DatabaseName $Database -Arguments @("-f", $seedFile)

Write-Host "Done. Local PostgreSQL database '$Database' is ready."

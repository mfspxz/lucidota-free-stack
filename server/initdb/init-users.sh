#!/bin/bash
# Runs once, on first postgres init (empty data volume).
# Creates least-privilege users + databases for n8n and authentik.
# Passwords come from the environment (.env) — never hardcoded here.
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    CREATE USER n8n WITH PASSWORD '$N8N_DB_PASSWORD';
    CREATE DATABASE n8n OWNER n8n;
    CREATE USER authentik WITH PASSWORD '$AUTHENTIK_DB_PASSWORD';
    CREATE DATABASE authentik OWNER authentik;
EOSQL

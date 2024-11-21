#!/bin/bash
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    CREATE DATABASE beauty_bot;
    CREATE USER beauty_user WITH PASSWORD 'beauty_password';
    GRANT ALL PRIVILEGES ON DATABASE beauty_bot TO beauty_user;
EOSQL
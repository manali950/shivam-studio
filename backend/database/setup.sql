-- setup.sql — one-time database bootstrap. Run as a PostgreSQL superuser (e.g. `postgres`):
--
--   psql -U postgres -v owner_pw="'choose-a-password'" -v app_pw="'choose-another'" -f database/setup.sql
--
-- Creates: database `shivamstudio`, owner role `shivamstudio_owner` (migrations + seed) and runtime role `shivamstudio_app`
-- (NOSUPERUSER, NOBYPASSRLS — row-level security always applies to it). Safe to re-run: existing objects are kept.
SELECT format('CREATE ROLE shivamstudio_owner LOGIN PASSWORD %L NOSUPERUSER NOBYPASSRLS', :owner_pw)
 WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'shivamstudio_owner') \gexec
SELECT format('CREATE ROLE shivamstudio_app LOGIN PASSWORD %L NOSUPERUSER NOBYPASSRLS', :app_pw)
 WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'shivamstudio_app') \gexec
SELECT 'CREATE DATABASE shivamstudio OWNER shivamstudio_owner'
 WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'shivamstudio') \gexec
\connect shivamstudio
GRANT ALL ON SCHEMA public TO shivamstudio_owner;
GRANT USAGE ON SCHEMA public TO shivamstudio_app;
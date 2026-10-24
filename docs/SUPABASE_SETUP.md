# Running ProcureGuard-AI on Supabase

Supabase is managed PostgreSQL. The backend only needs a connection string, so moving from the local Postgres to Supabase is configuration, not code. The platform keeps its own JWT login and role checks; Supabase Auth, Storage and Realtime are not used.

## 1. Connect

1. Create a project at supabase.com and note the database password.
2. **Project Settings → Database → Connection string**. Choose **Transaction pooler** (works over IPv4; the direct `db.<ref>.supabase.co` host is IPv6-only on the free tier).
3. Put it in `.env` as `DATABASE_URL`, with the password **URL-encoded** (a `@`, `#`, `/` or `%` in the password breaks the URL otherwise):

   ```bash
   python -c "import urllib.parse; print(urllib.parse.quote('your password here', safe=''))"
   ```

   ```env
   DATABASE_URL=postgresql://postgres.<project-ref>:<ENCODED-PASSWORD>@aws-0-<region>.pooler.supabase.com:6543/postgres
   ```

4. With docker compose, leave `COMPOSE_PROFILES` empty so the local `postgres` container is not started. Without docker, just start the backend.
5. Start the backend. Tables are created on first start. Check `GET /health` and the Supabase **Table Editor**.

## 2. What the backend does for you

| Behaviour | Why |
| :-- | :-- |
| Adds `sslmode=require` to Supabase URLs | The connection is encrypted unless your URL says otherwise. |
| No client-side pool on port 6543 | The transaction pooler already pools connections. Other ports use a normal pool (`DB_POOL_SIZE`, `DB_MAX_OVERFLOW`); `DB_POOL=null` forces no pool. |
| Enables **row-level security** on every table at start-up | See below. Disable with `SUPABASE_ENABLE_RLS=0`. |
| Reads `.env` before connecting | `DATABASE_URL` in `.env` is honoured when you run `uvicorn` directly. |

### Why row-level security matters

Supabase publishes the `public` schema through an automatic REST API that anyone holding the project's public (`anon`) key can call. A table without row-level security is readable that way, including `users` (password hashes) and the document vault. With row-level security on and no policies, the public roles see nothing. The backend connects as the `postgres` role, which bypasses it, so the application is unaffected. `tests/test_database_config.py` reproduces this on a real PostgreSQL: a public role reads the rows before the step and sees none after it.

If you add tables later, restart the backend (it enables security on every table it knows) or run `ALTER TABLE "<name>" ENABLE ROW LEVEL SECURITY` yourself.

## 3. Accounts

`PROCUREGUARD_ENV=development` (default) creates the demo accounts with the published demo password. For a real deployment set `PROCUREGUARD_ENV=production`, which creates **no** demo accounts and requires `JWT_SECRET`; set `BOOTSTRAP_ADMIN_EMAIL` and `BOOTSTRAP_ADMIN_PASSWORD` (12+ characters) to create the first administrator, then create auditors from the API (`POST /api/auth/register` as that admin).

## 4. Tested and not tested

* **Tested against a real PostgreSQL server** (embedded, via `pip install pgserver`): table creation for every model, row-level security, and the whole application end to end (start-up, seeding, logins, role checks, Agent 4).
* **Not tested against a live Supabase project**, which needs an account and credentials. The Supabase-specific parts are the URL handling (unit-tested), TLS and the pooler choice; if a connection fails, check the password encoding first, then that you used the pooler string.

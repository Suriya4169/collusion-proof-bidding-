# Access control

Who may call what, how that is enforced, and how it is tested. The rules live in one file, `backend/src/core/access.py`, and are applied in `backend/src/main.py`.

## Roles

| Role | Who | Can |
| :-- | :-- | :-- |
| `msme` | A vendor | Use the vendor tools; read and change **its own** enterprise's data |
| `government_auditor` | A reviewer | Use the auditor tools; **read** any enterprise's data, never change it |
| `admin` | An administrator | Everything a vendor or reviewer can, and create reviewer or admin accounts |

## Who may call what

| Area | Endpoints | msme | auditor | admin |
| :-- | :-- | :-- | :-- | :-- |
| Public | `POST /api/auth/login`, `POST /api/auth/register` (vendors only), `GET /health`, `GET /api/behavior/health`, `/docs` | yes | yes | yes |
| Own profile | `GET /api/auth/me` | yes | yes | yes |
| Vendor tools | `/api/tender/analyze`, `/api/payments/track`, `/api/msme/register` | yes | no | yes |
| Shared tools | `/api/diff`, `/api/tenders*`, `/api/jobs*`, `/api/orchestrator/analyze` | yes | yes | yes |
| Enterprise list | `GET /api/msme/all` | own only | all | all |
| Per-enterprise data | `/api/documents/{id}`, `/api/matchmaker/{id}`, `/api/notifications/{id}` | own | read | yes |
| Changing enterprise data | document upload, extract, delete; mark notifications read | own | no | yes |
| Reviewer tools | `/api/cartel/*`, `/api/v1/agent/solvency/*`, notification scan and daemon status | no | yes | yes |
| Bot detection | `POST /api/behavior/submit` | yes | no | yes |
| Bot detection | `POST /analyze`, `GET /signals`, `GET /signals/{id}`, `GET /summary`, `POST /signals/{id}/review` | no | yes | yes |
| MCP server | `/mcp/` | no | yes | yes |
| Machine to machine | `/api/m2m/v1/*` | `X-ProcureGuard-Key` only | | |

A request with no token gets **401**; a valid token with the wrong role, or for another enterprise's data, gets **403**.

## Ownership

A vendor account is linked to the enterprise on the account (`UserModel.msme_id`) and to any enterprise it registers (`UserEnterpriseModel`). Anything keyed by an enterprise id (vault, matchmaker, notifications) is checked against those links, so changing the id in a URL does not reach another company's data. The enterprise list a vendor sees contains only its own enterprises.

## Accounts

* Anyone can register a **vendor** account. Reviewer and admin accounts can only be created by a signed-in admin. The role field in the public form can no longer grant a privilege.
* An enterprise can be linked to one account at registration. Linking is first come, first served: nothing verifies that the registrant owns the Udyam number (that needs an OTP or KYC step).
* `PROCUREGUARD_ENV=development` (default) creates three demo accounts with the published demo password. `PROCUREGUARD_ENV=production` creates none; set `BOOTSTRAP_ADMIN_EMAIL` and `BOOTSTRAP_ADMIN_PASSWORD` (12+ characters) to create the first admin. `SEED_DEMO_USERS=1|0` overrides.
* A deactivated account is refused on its next request, even with a token that has not expired.

## Secrets and configuration

| Variable | What it does | If missing |
| :-- | :-- | :-- |
| `JWT_SECRET` | Signs login tokens (32+ characters) | Development: a random per-process key (logins do not survive a restart). Production: the server refuses to start |
| `M2M_MASTER_KEY` | The `X-ProcureGuard-Key` for machine clients; compared in constant time | The M2M gateway answers 503 instead of accepting a built-in key |
| `DATABASE_URL` | PostgreSQL or Supabase (see [SUPABASE_SETUP.md](SUPABASE_SETUP.md)) | SQLite file |
| `CORS_ORIGINS` | Browser origins allowed to call the API | `http://localhost:3000,http://127.0.0.1:3000` |

No secret is built into the source. Earlier versions shipped defaults for the JWT secret, the M2M key and the database password; anyone with the repository could forge an admin token with them. These variables are read when first needed, so values in `.env` are honoured (the file is loaded after the routes are imported).

## How it is enforced and tested

* Router-wide role guards and per-route ownership dependencies, all built from `core/access.py`.
* `backend/tests/test_access_control.py` drives the real application through its OpenAPI schema and calls **every operation without credentials**: any operation that does not answer 401, and is not on the short public list, fails the test. Adding a new route without a guard fails the build.
* The same file checks the role matrix, ownership, registration, the old hard-coded secret (a token signed with it is rejected), the M2M key and deactivated accounts.

## Known limits

* No rate limiting or lockout on login, and tokens last 24 hours with no revocation list (deactivating the account does lock it out).
* The browser keeps the token in `localStorage`, which a cross-site-scripting bug could read. A cookie with `HttpOnly` would be safer and needs a CSRF design.
* TLS is the job of the proxy in front of the API; this repository does not terminate it.

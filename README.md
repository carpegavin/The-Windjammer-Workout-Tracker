# The Windjammer Workout Tracker

A private, single-owner workout tracker built with HTML, CSS, JavaScript, Express, and MongoDB. Record cardio and resistance exercises, continue a workout, and inspect recent-session statistics.

## Data safety

Starting or deploying the server **never seeds or clears the database**. The `Procfile` runs only `npm start`. Production requires explicit database and authentication settings. Use HTTPS for hosted deployments.

Keep an independent backup before changing an existing database. Use separate development and test databases. Never point tests or demo seeding at personal workout records. This is one owner's password-protected dataset, not a multi-user service.

Never commit passwords, session secrets, connection strings, exported records, or backups. Hosting secrets belong in the host's environment settings.

## Local setup

Prerequisites: Node.js 24 LTS, npm, and a reachable MongoDB database. Node 24 is pinned in `.node-version` and the package engine range.

```sh
npm ci
npm run build
```

Copy `.env.example` to `.env` and fill in your own secrets. `npm start` loads `.env` if present; host environment values take precedence.

| Variable | Purpose |
| --- | --- |
| `NODE_ENV` | `development` locally; `production` when hosted. |
| `PORT` | Normally `3000` locally; supplied by Render when hosted. |
| `MONGODB_URI` | Connection string including the intended database name. |
| `APP_PASSWORD` | Owner login password, at least 12 characters. Choose a long, unique value. |
| `SESSION_SECRET` | Independent random secret, at least 32 characters. Changing it invalidates existing sessions. |

Generate a session secret locally:

```sh
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
```

Run `npm start`, open `http://localhost:3000`, and sign in. `npm run watch` is available for development. `/healthz` exposes database readiness without workout data; `/login` is the sign-in page.

When changing the owner password, also rotate `SESSION_SECRET` to invalidate previously issued sessions. Sign-out clears the current browser's session cookie; sessions otherwise expire after eight hours.

Demo fixtures are optional and never erase existing records. They are restricted to a database literally named `windjammer_demo`, require `SEED_DEMO=1`, and refuse to run in production. Set these values only in a separate disposable development configuration, then run `npm run seed`. Do not use your personal database for demonstrations.

## Verification

```sh
npm test
npm run build
```

The regression suite does not use a production database. A passing suite does not prove a particular hosted database is reachable. Check authenticated saving, reload persistence, and restart persistence on a fresh deployment before importing existing records.

Integration tests start and stop their own disposable MongoDB process. The first run downloads an official MongoDB binary into the ignored `node_modules/.cache` directory; this requires network access and disk space. No existing `MONGODB_URI` is read by those tests.

The build copies Chart.js and its license from the locked npm dependency into generated `public/vendor` assets. Run it after installing or changing dependencies. Generated vendor files are not committed.

## Free deployment: Render + MongoDB Atlas

The supplied `render.yaml` selects branch `fix/workout-reliability` and Render's **Free** Node web service. It builds with `npm ci --omit=dev && npm run build` and starts with `npm start`. It provisions no paid services, disks, databases, or seed jobs.

### 1. Prepare Atlas

1. Sign in to MongoDB Atlas and select a **Free / M0** cluster. Do not choose Flex or a dedicated tier.
2. Leave **Add Backups** off for a $0 deployment: that optional subscription is paid, as detailed below.
3. Create a database user restricted to the application's database. Start with a fresh database until any migration is checked.
4. Obtain the driver connection string and include the database name. Keep credentials in local `.env` or Render's secrets only. Encode special characters as required by MongoDB's connection-string format.
5. Configure Atlas Network Access with the Render service's outbound IP ranges once available. Avoid allowing all internet addresses.

### 2. Deploy on Render

1. Sign in to Render, connect this repository, and select `fix/workout-reliability`.
2. Create a Blueprint from `render.yaml`, or a Node web service with the same settings. Confirm the compute plan displays **Free / $0** before provisioning.
3. Supply secret values for `MONGODB_URI`, `APP_PASSWORD`, and `SESSION_SECRET`; retain `NODE_ENV=production`.
4. Copy the service's displayed outbound IP ranges into Atlas Network Access. See [Render outbound IP guidance](https://render.com/docs/outbound-ip-addresses). Retry deployment after this change if the first connection failed.
5. Verify `/healthz`, sign in over HTTPS, save an exercise, reload it, and restart the service. Records must survive. Verify signed-out API requests cannot retrieve workouts.

Do not select a paid plan or accept billing to complete this free path. If a provider requires a card or displays a charge, stop and review it. Account signup and accepting provider terms are separate user actions.

The manifest intentionally deploys the repair branch. Update its branch only after the fixes have been merged into the intended release branch; this configuration does not merge anything into `main`.

### Limits and costs

Render Free sleeps after 15 minutes idle and can take about a minute to wake. Services share 750 instance-hours per workspace per month. Local files are temporary; records belong in Atlas. With no payment method, overages can suspend services or builds. [Render Free documentation](https://render.com/docs/free).

Atlas Free includes 0.5 GB and may pause after 30 days with no connections. Retain exports before long inactivity. [Atlas Free limits](https://www.mongodb.com/docs/atlas/reference/free-shared-limitations/).

Atlas's optional Free-cluster backup preview takes daily snapshots and retains four. It costs $0.10/day, capped at $3/month, and requires a payment method. **Keep this subscription off to remain at $0.** [Backup documentation](https://www.mongodb.com/docs/atlas/backup/cloud-backup/free-cluster-backup/).

Pricing was checked November 14, 2026. Review current displayed prices before creating resources. This is a small personal-project setup, not an always-on availability guarantee. [Render Blueprint reference](https://render.com/docs/blueprint-spec).

## Backups and recovery

Use MongoDB Database Tools to export the application database to a private local backup outside this repository. Use an interactive password prompt or connection profile rather than exposing credentials in shell history. Protect exported personal data.

Restore into a **new database** first, verify record counts and sample workouts, and only then consider switching the connection string. Replica sets are not backups against deletion or bad writes. No backup, restore, or migration runs during app startup.

## Project structure

- `public/`: pages, forms, summaries, charts, and styling.
- `routes/`: authenticated API and page routes.
- `models/`: workout and exercise schema.
- `server.js`: configuration, authentication, database readiness, and HTTP startup.
- `seeders/`: explicitly invoked development fixtures, never startup.
- `tests/`: regression checks.
- `render.yaml`: free service settings; secrets supplied separately.

## License

GNU General Public License v3.0. See [LICENSE](LICENSE).

Original project: Gavin H Phill, 2021.


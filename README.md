# dd_services

Shared backend infrastructure for collaboration apps, built at TH Köln in
2022–2023: users can join sessions (also as ad-hoc guests), share files in
them and get live updates.

## What it is

dd_services is a general-purpose, self-hostable backend for collaborative
applications: a lightweight alternative to paid cloud collaboration
platforms that anyone can run on their own infrastructure and quickly extend
with their own applications. It provides the building blocks almost every
collaborative app needs:

- **who** takes part: users, either ad-hoc guests or logged-in accounts;
- **where** they work together: sessions with owners, participants and
  sub-sessions, which expire on their own;
- **what** they share: files (images, text, audio, PDF);
- **what changed**: live updates for sessions and users.

An application on top keeps only its own domain logic and works on the same
users, sessions and files as every other application. Because each service
publishes its changes as events, new services can be added that react to
them and build on the shared data for their own use case. Several apps can
thus complement each other. One example is a brainstorming in several
steps, each done by its own app on the same session and files:

1. **PictShareIt** (the frontend prototype for this backend): participants
   join a session, collect pictures and other material, upload it together
   and may already discuss it.
2. **MixMonster** then takes the collected images and starts creative
   processes from random mixes of them (planned connection, not built).

**Ad hoc first, persistent when needed.** Collaboration should start without
any setup: anyone can join a session as a guest, without an account, for
example by scanning a QR code; such sessions and guests expire on their own.
At the same time the platform turns what happens ad hoc into
lasting data: logged-in users can keep sessions for up to six months and
copy files into their own permanent storage. Moving a guest's work into an
account is part of this idea but not built yet.

> **Status:** unfinished research prototype, no longer developed. It runs
> locally with Docker Compose; it was never hardened for production.

## Architecture

| Part | What it does |
|---|---|
| `gateway/` | Apollo Gateway composing the three GraphQL subgraphs below |
| `users/` | Accounts and ad-hoc users; authentication via Keycloak, own access/refresh tokens |
| `sessions/` | Collaboration sessions with owners, participants and child sessions |
| `files/` | File metadata (GraphQL) plus signed upload/download links served over REST |
| `subscriptions/` | GraphQL subscriptions: turns Kafka change events into live updates via Redis Pub/Sub |
| `kafka/` | Kafka + ZooKeeper; every service publishes change events (state before and after) |
| `dbs/` | MongoDB replica set (one leader, two backups), accessed through Prisma |

The GraphQL services apply rate limiting and query depth limiting. The
diagram is in [`docs/architecture.drawio`](docs/architecture.drawio) (open
with [draw.io](https://app.diagrams.net)); the whiteboard sketch it started
from is [`docs/first-design-sketch.jpeg`](docs/first-design-sketch.jpeg).

## How it works

A client logs in (as an ad-hoc guest or through Keycloak) and gets its own
access and refresh token, creates or joins sessions, uploads files into them
through signed links and subscribes to live updates of its sessions. Every
service publishes its database changes to Kafka; the other services keep
their own copies of what they need from those events.

- [`docs/api.md`](docs/api.md): endpoints, the order of API calls (login,
  sessions, invites, upload, download, subscriptions) with example
  operations, and the internal event flow.
- [`docs/security.md`](docs/security.md): passwords and identities, tokens,
  authorization rules, signed upload/download links, infrastructure, and
  what is not implemented.
- [`docs/known-issues.md`](docs/known-issues.md): bugs and security gaps
  found while writing that documentation.

## Run it locally

Requires Docker with Docker Compose.

1. Copy [`.env.example`](.env.example) to `.env` and fill in the values.
2. Download the Keycloak client adapter config for your realm and save it as
   `users/keycloak.json`.
3. First start: `./start.sh` creates the data folders, the MongoDB replica set
   and the keys, then starts all containers.
4. Later starts: `docker-compose up`. `./reset.sh` deletes all local state.

`dd_services.postman_collection.json` holds end-to-end tests of the API; set
its variables (Keycloak server, realm, client, secret, test user) in Postman.

## Licence

[MIT](LICENSE)

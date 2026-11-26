# dd_services

Shared backend infrastructure for collaboration apps, built at TH Köln in
2022–2023: users can join sessions (also as ad-hoc guests), share files in
them and get live updates.

## What it is

dd_services was meant as a small cloud platform that several applications
use together instead of each building its own backend. It provides the
building blocks almost every collaborative app needs:

- **who** takes part: users, either ad-hoc guests or logged-in accounts;
- **where** they work together: sessions with owners, participants and
  sub-sessions, which expire on their own;
- **what** they share: files (images, text, audio, PDF);
- **what changed**: live updates for sessions and users.

Each application keeps only its own domain logic and works on the same
users, sessions and files as the others. Because every service publishes
its changes as events, new services can be added that react to them and
build on the shared data for their own use case.

The intended picture was a set of apps that complement each other along a
workflow, for example a brainstorming session that moves through several
steps and methods:

- **PictShareIt** (the frontend prototype for this backend): participants
  join a session, for example by QR code, and collect pictures and other
  files in it.
- **MixMonster** was planned to connect as well, so it could work with the
  images collected in a session.
- Further method-specific apps or services could pick up the same session
  and its files for the next step.

Only the shared core (users, sessions, files, live updates) and the start
of PictShareIt were built; the connection of other apps such as MixMonster
remained a plan.

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

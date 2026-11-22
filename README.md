# dd_services

Backend for ad-hoc collaboration prototypes, built at TH Köln in 2022–2023:
users can join sessions (also as ad-hoc guests), share files in them and get
live updates. It is used by the PictShareIt prototype.

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

#!/bin/bash

set -e
DELAY=20

mongosh <<EOF
use admin
db.auth("$MONGO_INITDB_ROOT_USERNAME", "$MONGO_INITDB_ROOT_PASSWORD")

var config = {
    "_id": "$REPLICA_SET_NAME",
    "version": 1,
    "members": [
        {
            "_id": 1,
            "host": "$LEADER_DATABASE_HOST:$DATABASE_PORT",
            "priority": 2
        },
        {
            "_id": 2,
            "host": "${BACKUP_DATABASE_1_HOST}:$DATABASE_PORT",
            "priority": 1
        },
        {
            "_id": 3,
            "host": "${BACKUP_DATABASE_2_HOST}:$DATABASE_PORT",
            "priority": 1
        }
    ]
};
rs.initiate(config, { force: true });
EOF

echo "****** Waiting for ${DELAY} seconds for replicaset configuration to be applied ******"

sleep $DELAY

mongosh <<EOF
use admin
db.auth("$MONGO_INITDB_ROOT_USERNAME", "$MONGO_INITDB_ROOT_PASSWORD")

rs.status()

use dd_services_users
db.createCollection("users", { changeStreamPreAndPostImages: { enabled: true } })
db.createUser({
  user: "$USERS_DATABASE_USER",
  pwd: "$USERS_DATABASE_PASSWORD",
  roles: [{ role: "readWrite", db: "dd_services_users" }]
})

use dd_services_files
db.createCollection("files", { changeStreamPreAndPostImages: { enabled: true } })
db.createCollection("userSessions", { changeStreamPreAndPostImages: { enabled: true } })
db.createUser({
  user: "$FILES_DATABASE_USER",
  pwd: "$FILES_DATABASE_PASSWORD",
  roles: [{ role: "readWrite", db: "dd_services_files" }]
})

use dd_services_sessions
db.createCollection("sessions", { changeStreamPreAndPostImages: { enabled: true } })
db.createUser({
  user: "$SESSIONS_DATABASE_USER",
  pwd: "$SESSIONS_DATABASE_PASSWORD",
  roles: [{ role: "readWrite", db: "dd_services_sessions" }]
})

use dd_services_subscriptions
db.createCollection("subscriptions", { changeStreamPreAndPostImages: { enabled: true } })
db.createUser({
  user: "$SUBSCRIPTIONS_DATABASE_USER",
  pwd: "$SUBSCRIPTIONS_DATABASE_PASSWORD",
  roles: [{ role: "readWrite", db: "dd_services_subscriptions" }]
})
EOF
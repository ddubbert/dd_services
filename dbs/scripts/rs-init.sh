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
use $USERS_DATABASE_NAME

rs.status();

db.createUser({
  user: "$USERS_DATABASE_USER",
  pwd: "$USERS_DATABASE_PASSWORD",
  roles: [{ role: "readWrite", db: "$USERS_DATABASE_NAME" }]
})

use $FILES_DATABASE_NAME

db.createUser({
  user: "$FILES_DATABASE_USER",
  pwd: "$FILES_DATABASE_PASSWORD",
  roles: [{ role: "readWrite", db: "$FILES_DATABASE_NAME" }]
})

use $SESSIONS_DATABASE_NAME

db.createUser({
  user: "$SESSIONS_DATABASE_USER",
  pwd: "$SESSIONS_DATABASE_PASSWORD",
  roles: [{ role: "readWrite", db: "$SESSIONS_DATABASE_NAME" }]
})
EOF
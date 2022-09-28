#!/bin/bash

set -e
DELAY=20

mongosh <<EOF
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
use $MONGO_INITDB_DATABASE

rs.status();

db.createCollection('$USERS_COLLECTION_NAME');
db.createCollection('$FILES_COLLECTION_NAME');
db.createCollection('$SESSIONS_COLLECTION_NAME');

db.createRole(
   {
     role: "$USERS_COLLECTION_USER", 
     privileges: [
       { resource: { db: "$MONGO_INITDB_DATABASE", collection: "$USERS_COLLECTION_NAME" }, actions: [ "find", "insert", "remove", "update", "useUUID", "bypassDocumentValidation" ] }
     ],
     roles: []
   }
)

db.createRole(
   {
     role: "$FILES_COLLECTION_USER", 
     privileges: [
       { resource: { db: "$MONGO_INITDB_DATABASE", collection: "$FILES_COLLECTION_NAME" }, actions: [ "find", "insert", "remove", "update", "useUUID", "bypassDocumentValidation" ] }
     ],
     roles: []
   }
)

db.createRole(
   {
     role: "$SESSIONS_COLLECTION_USER", 
     privileges: [
       { resource: { db: "$MONGO_INITDB_DATABASE", collection: "$SESSIONS_COLLECTION_NAME" }, actions: [ "find", "insert", "remove", "update", "useUUID", "bypassDocumentValidation" ] }
     ],
     roles: []
   }
)

db.createUser({
  user: '$USERS_COLLECTION_USER',
  pwd: '$USERS_COLLECTION_PASSWORD',
  roles: ["$USERS_COLLECTION_USER"]
})

db.createUser({
  user: '$FILES_COLLECTION_USER',
  pwd: '$FILES_COLLECTION_PASSWORD',
  roles: ["$FILES_COLLECTION_USER"]
})

db.createUser({
  user: '$SESSIONS_COLLECTION_USER',
  pwd: '$SESSIONS_COLLECTION_PASSWORD',
  roles: ["$SESSIONS_COLLECTION_USER"]
})
EOF
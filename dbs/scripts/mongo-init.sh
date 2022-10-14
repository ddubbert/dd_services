#!/bin/bash

set -e
echo "hallo i bims eine nachrichtenluemmellei"

mongosh <<EOF
use admin

db.createUser({
  user: "$MONGO_INITDB_ROOT_USERNAME",
  pwd: "$MONGO_INITDB_ROOT_PASSWORD",
  roles: ["root"]
})
EOF
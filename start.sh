#!/bin/bash

DELAY=20

docker-compose up -d

echo "****** Waiting for ${DELAY} seconds for containers to go up ******"
sleep $DELAY

docker exec leader_db /scripts/rs-init.sh
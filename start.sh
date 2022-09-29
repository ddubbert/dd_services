#!/bin/bash

DELAY=20

mkdir -p ./kafka/data
mkdir -p ./kafka/data/kafka_1
mkdir -p ./kafka/data/zookeeper_1

mkdir -p ./dbs/leader/config
mkdir -p ./dbs/leader/data
mkdir -p ./dbs/leader/logs
touch ./dbs/leader/logs/mongo.log || echo "leader logs are reused"

mkdir -p ./dbs/backup_1/config
mkdir -p ./dbs/backup_1/data
mkdir -p ./dbs/backup_1/logs
touch ./dbs/backup_1/logs/mongo.log || echo "backup_1 logs are reused"

mkdir -p ./dbs/backup_2/config
mkdir -p ./dbs/backup_2/data
mkdir -p ./dbs/backup_2/logs
touch ./dbs/backup_2/logs/mongo.log || echo "backup_2 logs are reused"

docker-compose up -d

echo "****** Waiting for ${DELAY} seconds for containers to go up ******"
sleep $DELAY

docker exec leader_db /scripts/rs-init.sh
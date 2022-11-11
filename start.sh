#!/bin/bash

source .env
DELAY=40

rm -rf ./kafka/data
mkdir -p ./kafka/data
mkdir -p ./kafka/data/kafka_1
mkdir -p ./kafka/data/zookeeper_1

rm -rf ./dbs/leader
mkdir -p ./dbs/leader/config
mkdir -p ./dbs/leader/data
mkdir -p ./dbs/leader/logs
touch ./dbs/leader/logs/mongo.log || echo "leader logs are reused"

rm -rf ./dbs/backup_1
mkdir -p ./dbs/backup_1/config
mkdir -p ./dbs/backup_1/data
mkdir -p ./dbs/backup_1/logs
touch ./dbs/backup_1/logs/mongo.log || echo "backup_1 logs are reused"

rm -rf ./dbs/backup_2
mkdir -p ./dbs/backup_2/config
mkdir -p ./dbs/backup_2/data
mkdir -p ./dbs/backup_2/logs
touch ./dbs/backup_2/logs/mongo.log || echo "backup_2 logs are reused"

rm -rf ./dbs/keyfile
mkdir -p ./dbs/keyfile
openssl rand -base64 756 > ./dbs/keyfile/keyfile.key

rm -f ./users/accessKey.pem
rm -f ./users/refreshKey.pem
rm -f ./users/accessPublicKey.pem
rm -f ./users/refreshPublicKey.pem
rm -f ./files/accessKey.pem
rm -f ./sessions/accessKey.pem
openssl genrsa -passout pass:${REFRESH_KEY_PASSPHRASE} -out ./users/refreshKey.pem -aes256 4096
openssl rsa -passin pass:${REFRESH_KEY_PASSPHRASE} -pubout -in ./users/refreshKey.pem -out ./users/refreshPublicKey.pem

openssl genrsa -passout pass:${ACCESS_KEY_PASSPHRASE} -out ./users/accessKey.pem -aes256 4096
openssl rsa -passin pass:${ACCESS_KEY_PASSPHRASE} -pubout -in ./users/accessKey.pem -out ./users/accessPublicKey.pem
cp ./users/accessPublicKey.pem ./sessions/accessKey.pem
cp ./sessions/accessKey.pem ./files/accessKey.pem

docker-compose up -d

echo "****** Waiting for ${DELAY} seconds for containers to go up ******"
sleep $DELAY

docker exec leader_db /scripts/rs-init.sh
#!/bin/bash
rm -rf ./redisCache
rm -rf ./kafka/data
rm -rf ./dbs/leader
rm -rf ./dbs/backup_1
rm -rf ./dbs/backup_2
rm -rf ./dbs/keyfile
rm -f ./users/accessKey.pem
rm -f ./users/refreshKey.pem
rm -f ./users/accessPublicKey.pem
rm -f ./users/refreshPublicKey.pem
rm -f ./files/accessKey.pem
rm -f ./files/signing.pem
rm -f ./files/public
rm -f ./sessions/accessKey.pem
rm -f ./subscriptions/accessKey.pem
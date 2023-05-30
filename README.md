# dd_services

Vor dem ersten Start ist im users-Ordner zunächst eine "keycloak.json" Datei anzulegen, welche für jeden Client vom jeweiligen Keycloak-Server heruntergeladen werden kann. Beim ersten Start muss die start.sh ausgeführt werden. Für alle weiteren Startprozesse / wenn die Container bereits vorhanden und eingerichtet sind, kann docker-compose up genutzt werden.

Zum starten wird ein .env-File mit folgenden Attributen benötigt (values sind nur Beispiele und sollten kontextbedingt angepasst werden):

REPLICA_SET_NAME=dd_services_db_replica

DATABASE_PORT=27017

ROOT_DATABASE_NAME=dd_services_db

DATABASE_HOST=leader_db

BACKUP_DATABASE_1_HOST=backup_db_1

BACKUP_DATABASE_2_HOST=backup_db_2

ADMIN_USERNAME=adminUser

ADMIN_PASSWORD=adminUserPW

ACCESS_KEY_PASSPHRASE=hello

REFRESH_KEY_PASSPHRASE=hello

USERS_HOST=users

USERS_PORT=80

USERS_DATABASE_NAME=users

USERS_DATABASE_USER=usersDatabaseUser

USERS_DATABASE_PASSWORD=usersDatabasePW

FILES_HOST=files

FILES_PORT=80

FILES_UPLOAD_PORT=8081

FILES_DATABASE_NAME=files

FILES_DATABASE_USER=filesDatabaseUser

FILES_DATABASE_PASSWORD=filesDatabasePW

SESSIONS_HOST=sessions

SESSIONS_PORT=80

SESSIONS_DATABASE_NAME=sessions

SESSIONS_DATABASE_USER=sessionsDatabaseUser

SESSIONS_DATABASE_PASSWORD=sessionsDatabasePW


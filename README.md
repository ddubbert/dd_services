# dd_services

Zum starten wird ein .env-File mit folgenden Attributen benötigt:

DATABASE_PORT=...
REPLICA_SET_NAME=...

ADMIN_USERNAME=...
ADMIN_PASSWORD=...
LEADER_DATABASE_HOST=...
DATABASE_NAME=...

BACKUP_DATABASE_1_HOST=...
BACKUP_DATABASE_2_HOST=...

USERS_COLLECTION_NAME=...
USERS_COLLECTION_USER=...
USERS_COLLECTION_PASSWORD=...

FILES_COLLECTION_NAME=...
FILES_COLLECTION_USER=...
FILES_COLLECTION_PASSWORD=...

SESSIONS_COLLECTION_NAME=...
SESSIONS_COLLECTION_USER=...
SESSIONS_COLLECTION_PASSWORD=...

Beim ersten Start muss die start.sh ausgeführt werden. Für alle weiteren Startprozesse / wenn die Container bereits vorhanden und eingerichtet sind, kann docker-compose up genutzt werden.
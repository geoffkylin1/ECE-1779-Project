#!/bin/sh
set -eu

usage() {
    echo "Usage: $0 DATABASE_URL_FILE POSTGRES_PASSWORD_FILE JWT_SECRET_FILE" >&2
    exit 2
}

[ "$#" -eq 3 ] || usage

database_url_file="$1"
postgres_password_file="$2"
jwt_secret_file="$3"

for secret_file in "$database_url_file" "$postgres_password_file" "$jwt_secret_file"; do
    if [ ! -r "$secret_file" ]; then
        echo "Secret file is not readable: $secret_file" >&2
        exit 1
    fi
done

for secret_name in splitmate_database_url splitmate_postgres_password splitmate_jwt_secret; do
    if docker secret inspect "$secret_name" >/dev/null 2>&1; then
        echo "Secret already exists; no secrets were changed: $secret_name" >&2
        echo "Use versioned secret names and update the stack when rotating secrets." >&2
        exit 1
    fi
done

create_secret() {
    secret_name="$1"
    secret_file="$2"

    docker secret create "$secret_name" "$secret_file" >/dev/null
    echo "Created Docker secret: $secret_name"
}

create_secret splitmate_database_url "$database_url_file"
create_secret splitmate_postgres_password "$postgres_password_file"
create_secret splitmate_jwt_secret "$jwt_secret_file"

#!/bin/sh
set -eu

load_secret() {
    variable_name="$1"
    file_path="$2"

    if [ ! -r "$file_path" ]; then
        echo "Secret file for ${variable_name} is not readable: ${file_path}" >&2
        exit 1
    fi

    secret_value="$(cat "$file_path")"
    export "${variable_name}=${secret_value}"
}

if [ -n "${DATABASE_URL_FILE:-}" ]; then
    load_secret DATABASE_URL "$DATABASE_URL_FILE"
fi

if [ -n "${JWT_SECRET_FILE:-}" ]; then
    load_secret JWT_SECRET "$JWT_SECRET_FILE"
fi

exec "$@"

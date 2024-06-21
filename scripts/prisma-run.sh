#!/usr/bin/env bash

set -o errexit  # abort on nonzero exit status
set -o nounset  # abort on unbound variable
set -o pipefail # don't hide errors within pipes

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &>/dev/null && pwd)
SCHEMA_DIR=$SCRIPT_DIR/../schemas

for schema in $SCHEMA_DIR/*/schema.prisma; do
    $SCRIPT_DIR/../node_modules/.bin/prisma $@ --schema=$schema
done

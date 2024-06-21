#!/usr/bin/env bash
#
# Deploy the prisma schema to the production databases.

set -o errexit  # abort on nonzero exit status
set -o nounset  # abort on unbound variable
set -o pipefail # don't hide errors within pipes

# The connection URLs to the databases can be configured by creating a
# `.env.prisma` file in the root of the repository.
ENV_FILE=".env.prisma"

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &>/dev/null && pwd)
SCHEMA_DIR=$SCRIPT_DIR/../schemas

export $(cat $SCRIPT_DIR/../$ENV_FILE | xargs)

for schema in $SCHEMA_DIR/*/schema.prisma; do
    $SCRIPT_DIR/../node_modules/.bin/prisma migrate deploy --schema=$schema
done

#!/usr/bin/env bash

set -o errexit  # abort on nonzero exit status
set -o nounset  # abort on unbound variable
set -o pipefail # don't hide errors within pipes

export DOCKER_DEFAULT_PLATFORM=linux/amd64

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &>/dev/null && pwd)
APPS_DIR=$SCRIPT_DIR/../apps
COMMIT_SHA=$(git rev-parse --short HEAD)

for folder in $APPS_DIR/*; do
    app=$(basename $folder)
    image="registry.digitalocean.com/thor-node/$app"

    docker build \
        --file Dockerfile \
        --tag "$image:$COMMIT_SHA" \
        --build-arg "NEST_APP=$app" \
        .

    docker push "$image:$COMMIT_SHA"
done

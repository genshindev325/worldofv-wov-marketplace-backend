#!/usr/bin/env bash

set -o errexit  # abort on nonzero exit status
set -o nounset  # abort on unbound variable
set -o pipefail # don't hide errors within pipes

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &>/dev/null && pwd)

APP_NAME="$1"

if [ -z "$APP_NAME" ]; then
    echo "No app name provided"
    exit 1
fi

source "$SCRIPT_DIR/docker-login.sh"

export DOCKER_DEFAULT_PLATFORM=linux/amd64
export DOCKER_BUILDKIT=1

IMAGE="$DOCKER_REGISTRY/$DOCKER_ENDPOINT/$APP_NAME"
CACHE_IMAGE="$DOCKER_REGISTRY/$DOCKER_ENDPOINT/bitbucket-cache"
COMMIT_SHORT_SHA=$(echo $BITBUCKET_COMMIT | head -c 8)

docker build \
    --file Dockerfile \
    --cache-from "$CACHE_IMAGE:$BITBUCKET_BRANCH","$IMAGE:$BITBUCKET_BRANCH" \
    --tag "$IMAGE:$BITBUCKET_BRANCH" \
    --tag "$IMAGE:$COMMIT_SHORT_SHA" \
    --build-arg "BUILDKIT_INLINE_CACHE=1" \
    --build-arg "NEST_APP=$APP_NAME" \
    .

docker push "$IMAGE:$COMMIT_SHORT_SHA"
docker push "$IMAGE:$BITBUCKET_BRANCH"

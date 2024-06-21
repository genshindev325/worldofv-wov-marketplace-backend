#!/usr/bin/env bash
#
# Build and upload an image of the build stage to the registry to use as a
# remote cache in the subsequent steps.

set -o errexit  # abort on nonzero exit status
set -o nounset  # abort on unbound variable
set -o pipefail # don't hide errors within pipes

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &>/dev/null && pwd)

source "$SCRIPT_DIR/docker-login.sh"

export DOCKER_DEFAULT_PLATFORM=linux/amd64
export DOCKER_BUILDKIT=1

CACHE_IMAGE="$DOCKER_REGISTRY/$DOCKER_ENDPOINT/bitbucket-cache"

docker build \
    --file Dockerfile \
    --cache-from "$CACHE_IMAGE:$BITBUCKET_BRANCH" \
    --tag "$CACHE_IMAGE:$BITBUCKET_BRANCH" \
    --build-arg "BUILDKIT_INLINE_CACHE=1" \
    --target "build-deps" \
    .

docker push "$CACHE_IMAGE:$BITBUCKET_BRANCH"

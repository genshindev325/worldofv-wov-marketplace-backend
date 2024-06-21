#!/usr/bin/env bash

set -o errexit  # abort on nonzero exit status
set -o nounset  # abort on unbound variable
set -o pipefail # don't hide errors within pipes

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &>/dev/null && pwd)
PROTO_DIR=$SCRIPT_DIR/../protos
OUT_DIR=$SCRIPT_DIR/../generated/ts-proto

mkdir -p $OUT_DIR

# WARNING: make sure the configuration matches the loader options in libs/grpc-options!

protoc \
    --experimental_allow_proto3_optional \
    --plugin=./node_modules/.bin/protoc-gen-ts_proto \
    --proto_path=$PROTO_DIR \
    --ts_proto_opt=addGrpcMetadata=true \
    --ts_proto_opt=env=node \
    --ts_proto_opt=esModuleInterop=true \
    --ts_proto_opt=nestJs=true \
    --ts_proto_opt=snakeToCamel=false \
    --ts_proto_opt=stringEnums=true \
    --ts_proto_opt=unrecognizedEnum=false \
    --ts_proto_opt=useOptionals=messages \
    --ts_proto_opt=useSnakeTypeName=false \
    --ts_proto_out=$OUT_DIR $PROTO_DIR/**/*.proto

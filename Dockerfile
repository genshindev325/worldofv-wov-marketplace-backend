FROM node:lts-slim AS base

RUN export DEBIAN_FRONTEND=noninteractive \
    && apt-get update \
    && apt-get install -y openssl \
    && rm -rf /var/lib/apt/lists/*


FROM base AS build-deps

RUN export DEBIAN_FRONTEND=noninteractive \
    && apt-get update \
    && apt-get install -y curl unzip \
    && rm -rf /var/lib/apt/lists/*

ARG PROTOC_VERSION=22.2
RUN curl -fsSL -o /tmp/protoc.zip https://github.com/protocolbuffers/protobuf/releases/download/v${PROTOC_VERSION}/protoc-${PROTOC_VERSION}-linux-x86_64.zip \
    && unzip /tmp/protoc.zip -x readme.txt -d /usr/local \
    && rm /tmp/protoc.zip \
    && chmod -R 755 /usr/local/include/google \ 
    && chmod a+x /usr/local/bin/protoc

WORKDIR /source

COPY package*.json ./
RUN npm ci

COPY scripts ./scripts

COPY schemas ./schemas
RUN npm run prisma:generate

COPY protos ./protos
RUN npm run proto:generate


FROM base AS build-app

WORKDIR /source

COPY --from=build-deps /source /source
COPY ./ ./

ARG NEST_APP

RUN npm run build ${NEST_APP} && npm prune --omit=dev && npm cache clean --force


FROM base

WORKDIR /app

COPY --from=build-app /source/node_modules /app/node_modules
COPY --from=build-app /source/dist /app/dist
COPY --from=build-app /source/protos /app/protos

ARG NEST_APP
ENV NEST_APP=${NEST_APP}

CMD node dist/apps/${NEST_APP}/main.js
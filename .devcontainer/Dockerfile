FROM mcr.microsoft.com/vscode/devcontainers/javascript-node:18

RUN sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list' \
    && wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | apt-key add - \
    && apt-get update \
    && apt-get install -y --no-install-recommends postgresql-client redis-tools clang-format \
    && apt-get autoremove -y \
    && apt-get clean -y \
    && rm -rf /var/lib/apt/lists/*

ARG DOCTL_VERSION=1.92.0
RUN curl -fsSL https://github.com/digitalocean/doctl/releases/download/v${DOCTL_VERSION}/doctl-${DOCTL_VERSION}-linux-amd64.tar.gz \
    | tar xvz -C /usr/local/bin

ARG TERRAFORM_VERSION=1.4.0
RUN curl -fsSL -o /tmp/terraform.zip https://releases.hashicorp.com/terraform/${TERRAFORM_VERSION}/terraform_${TERRAFORM_VERSION}_linux_amd64.zip \
    && unzip /tmp/terraform.zip -d /usr/local/bin \
    && rm /tmp/terraform.zip

ARG PROTOC_VERSION=22.2
RUN curl -fsSL -o /tmp/protoc.zip https://github.com/protocolbuffers/protobuf/releases/download/v${PROTOC_VERSION}/protoc-${PROTOC_VERSION}-linux-x86_64.zip \
    && unzip /tmp/protoc.zip -x readme.txt -d /usr/local \
    && rm /tmp/protoc.zip \
    && chmod -R 755 /usr/local/include/google \ 
    && chmod a+x /usr/local/bin/protoc

USER node

RUN npm install -g @nestjs/cli

# Preserve bash history and CLI credentials on container rebuild.
# See https://code.visualstudio.com/remote/advancedcontainers/persist-bash-history

RUN mkdir -p /home/node/.bash_history /home/node/.terraform.d /home/node/.config/doctl \
    && touch /home/node/.bash_history/bash_history \
    && chown -R node /home/node 

ENV HISTFILE=/home/node/.bash_history/bash_history
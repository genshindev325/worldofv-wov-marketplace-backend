#!/usr/bin/env sh

# This script needs to run using `sh` since the hashicorp/terraform image
# does not include bash.

export TF_IN_AUTOMATION="1"
export TF_CLI_ARGS="-no-color"

COMMIT_SHORT_SHA=$(echo $BITBUCKET_COMMIT | head -c 8)

cd "$(dirname $0)/../terraform"

terraform fmt -check
terraform init -input=false
terraform apply -input=false -auto-approve -var "services_tag=${COMMIT_SHORT_SHA}"

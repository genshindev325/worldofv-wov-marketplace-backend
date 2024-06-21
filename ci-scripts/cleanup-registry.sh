#!/usr/bin/env bash
#
# Clean up old images from the digitalocean registry leaving only the latest 3
# tags.

set -o errexit # abort on nonzero exit status

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &>/dev/null && pwd)
APPS_DIR=$SCRIPT_DIR/../apps
DOCTL_VERSION=1.92.0

echo "Downloading doctl..."

curl -fsSL https://github.com/digitalocean/doctl/releases/download/v${DOCTL_VERSION}/doctl-${DOCTL_VERSION}-linux-amd64.tar.gz |
    tar xvz -C /usr/local/bin &>/dev/null

echo "Downloaded doctl."
echo

doctl auth init --access-token "$DIGITALOCEAN_TOKEN"

for folder in $APPS_DIR/*; do
    app=$(basename $folder)

    echo "Fetching tags for '$app'"
    echo

    readarray -t images_to_delete <<<$(
        doctl registry repository list-manifests "$app" --format UpdatedAt,Tags --no-header |
            sort |
            head -n-3
    )

    if [ ${#images_to_delete[@]} -eq 0 ]; then
        echo "No tags to delete for '$app', skipping."
        echo
        continue
    else
        echo "Found ${#images_to_delete[@]} tags to delete for '$app'."
        echo
    fi

    for line in "${images_to_delete[@]}"; do
        for tag in $(echo $line | tr -s ' ' | cut -d ' ' -f5 - | sed -E 's/\[|\]//g'); do
            echo "Deleting '$app:$tag'"
            doctl registry repository delete-tag --force $app $tag
            echo
        done
    done
done

if doctl registry garbage-collection get-active &>/dev/null; then
    echo "Garbage collection already active."
else
    echo "Starting garbage collection..."
    doctl registry garbage-collection start --force --include-untagged-manifests &>/dev/null
    echo "Started garbage collection."
fi

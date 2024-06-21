#!/usr/bin/env bash
#
# Remove all commit tags from the digitalocean registry leaving only tags newer
# than the chosen threshold date.
#
# Example: scripts/cleanup-registry.sh '1 days ago' -f -r

set -o errexit # abort on nonzero exit status

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &>/dev/null && pwd)
APPS_DIR=$SCRIPT_DIR/../apps

while [[ $# -gt 0 ]]; do
    case $1 in
    -f | --force)
        FORCE=true
        shift
        ;;
    -r | --remove)
        COLLECT_GARBAGE=true
        shift
        ;;
    -* | --*)
        echo "Unknown option $1"
        exit 1
        ;;
    *)
        THRESHOLD="$1"
        shift
        ;;
    esac
done

if [ -z "$THRESHOLD" ]; then
    echo "No date threshold provided."
    exit 1
fi

# Tags older than this instant in time will be deleted.
oldest_timestamp=$(date +%s -d "$THRESHOLD")

for folder in $APPS_DIR/*; do
    app=$(basename $folder)

    echo "Fetching tags for '$app'"
    echo

    tags_to_delete=()
    tags_to_keep=()

    data=$(doctl registry repository list-manifests "$app" --format UpdatedAt,Tags --no-header)

    while read line; do
        timestamp=$(echo $line | tr -s ' ' | cut -d' ' -f1,2 - | xargs -0 date +%s -d)
        tags=$(echo $line | tr -s ' ' | cut -d ' ' -f5 - | sed -E 's/\[|\]//g')

        if [ $timestamp -lt $oldest_timestamp ]; then
            tags_to_delete+=(${tags[@]})
        else
            tags_to_keep+=(${tags[@]})
        fi
    done <<<$data

    if [ ${#tags_to_delete[@]} -eq 0 ]; then
        echo "No tags to delete for '$app', skipping."
        echo
        continue
    fi

    if [ ${#tags_to_keep[@]} -eq 0 ]; then
        echo "Error: The current date threshold would delete all tags for '$app'"
        exit 1
    fi

    echo "The following tags will be DELETED:"
    echo "${tags_to_delete[@]}" | tr ' ' '\n' | sed "s/^/\t/"
    echo
    echo "The following tags will be left in place after deletion:"
    echo "${tags_to_keep[@]}" | tr ' ' '\n' | sed "s/^/\t/"
    echo

    if [ -z "$FORCE" ]; then
        while true; do
            read -r -p "Are you sure? [y/n]: " reply
            echo

            case $reply in
            [yY])
                break
                ;;
            [nN])
                echo "Aborting."
                exit 0
                ;;
            *)
                continue
                ;;
            esac
        done
    fi

    for tag in "${tags_to_delete[@]}"; do
        echo "Deleting '$app:$tag'"
        doctl registry repository delete-tag --force $app $tag
        echo
    done
done

if [ -n "$COLLECT_GARBAGE" ]; then
    if doctl registry garbage-collection get-active &>/dev/null; then
        echo "Garbage collection already active"
    else
        echo "Starting garbage collection"
        doctl registry garbage-collection start --force --include-untagged-manifests &>/dev/null
        echo "Started garbage collection"
    fi
fi

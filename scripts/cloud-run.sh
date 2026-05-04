#!/usr/bin/env bash
# Cloud Run deploy + env sync (.env keys must match variables named in .env.example).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG="${SCRIPT_DIR}/cloud-run.config"

usage() {
    cat <<EOF
Usage: $(basename "$0") <command>

  deploy              Docker build + push + deploy image (enables APIs + creates Artifact Registry repo if missing).

  create-registry     Only enable APIs and create the Artifact Registry repo (same as deploy does automatically).

  sync-env             Push env from .env to Cloud Run (only keys named in .env.example; PORT is skipped so Cloud Run can set it).

  deploy-and-sync      deploy + sync-env

  env-only             Print the --update-env-vars payload only (keep private).

Requires: Docker, gcloud, Node.js. Configure once:
  cp scripts/cloud-run.config.example scripts/cloud-run.config
  nano scripts/cloud-run.config

GCP secrets (JWT, etc.) can still be wired in Cloud Console or:
  gcloud run services update "\$GCP_SERVICE_NAME" --region="\$GCP_REGION" --set-secrets=...
EOF
}

load_config() {
    if [[ ! -f "$CONFIG" ]]; then
        echo "Missing $CONFIG"
        echo "Run: cp scripts/cloud-run.config.example scripts/cloud-run.config"
        exit 1
    fi
    # shellcheck source=/dev/null
    source "$CONFIG"

    GCP_PROJECT_ID="${GCP_PROJECT_ID:-$(gcloud config get-value project 2>/dev/null)}"
    if [[ -z "$GCP_PROJECT_ID" || "$GCP_PROJECT_ID" == "(unset)" ]]; then
        echo "Set GCP_PROJECT_ID in cloud-run.config or: gcloud config set project PROJECT_ID"
        exit 1
    fi

    : "${GCP_REGION:?Set GCP_REGION in cloud-run.config}"
    : "${GCP_ARTIFACT_REPO:?Set GCP_ARTIFACT_REPO in cloud-run.config}"
    : "${GCP_IMAGE_NAME:?Set GCP_IMAGE_NAME in cloud-run.config}"
    : "${GCP_SERVICE_NAME:?Set GCP_SERVICE_NAME in cloud-run.config}"
}

registry_host() {
    echo "${GCP_REGION}-docker.pkg.dev"
}

image_uri() {
    echo "$(registry_host)/${GCP_PROJECT_ID}/${GCP_ARTIFACT_REPO}/${GCP_IMAGE_NAME}:latest"
}

compose_update_env_args() {
    node "${SCRIPT_DIR}/generate-cloud-run-env.mjs"
}

ensure_google_apis() {
    gcloud services enable \
        artifactregistry.googleapis.com \
        run.googleapis.com \
        --project="${GCP_PROJECT_ID}" \
        --quiet
}

ensure_artifact_repo() {
    ensure_google_apis
    if gcloud artifacts repositories describe "${GCP_ARTIFACT_REPO}" \
        --project="${GCP_PROJECT_ID}" \
        --location="${GCP_REGION}" &>/dev/null; then
        return 0
    fi
    echo "Repository '${GCP_ARTIFACT_REPO}' not found in ${GCP_REGION}. Creating it..."
    gcloud artifacts repositories create "${GCP_ARTIFACT_REPO}" \
        --project="${GCP_PROJECT_ID}" \
        --repository-format=docker \
        --location="${GCP_REGION}" \
        --description="Terminal API Docker images"
}

run_create_registry() {
    load_config
    ensure_artifact_repo
    echo "Done. Configure Docker if you have not yet:"
    echo "  gcloud auth configure-docker $(registry_host)"
}

run_sync_env() {
    load_config
    local pairs
    pairs="$(compose_update_env_args)"
    if [[ -z "$pairs" ]]; then
        echo "No env pairs to sync (.env vs .env.example); check ROOT .env matches allowed keys."
        exit 1
    fi
    echo "Applying --update-env-vars for keys declared in .env that appear in .env.example ..."
    # shellcheck disable=SC2086
    gcloud run services update "${GCP_SERVICE_NAME}" \
        --project="${GCP_PROJECT_ID}" \
        --region="${GCP_REGION}" \
        --platform=managed \
        --update-env-vars="${pairs}"
}

run_deploy() {
    load_config
    ensure_artifact_repo
    local img
    img="$(image_uri)"

    # Cloud Run runs amd64/Linux; ARM Macs otherwise build arm64 or a multi-arch index Cloud Run rejects
    docker build --platform="${GCP_DOCKER_PLATFORM:-linux/amd64}" -t "${img}" "${ROOT}"
    docker push "${img}"

    AUTH_FLAG=()
    if [[ "${GCP_ALLOW_UNAUTHENTICATED:-true}" == "true" ]]; then
        AUTH_FLAG=(--allow-unauthenticated)
    else
        AUTH_FLAG=(--no-allow-unauthenticated)
    fi

    gcloud run deploy "${GCP_SERVICE_NAME}" \
        --project="${GCP_PROJECT_ID}" \
        --image="${img}" \
        --region="${GCP_REGION}" \
        --platform=managed \
        "${AUTH_FLAG[@]}"

    echo ""
    echo "Deployed: ${img}"
}

case "${1:-}" in
    deploy)
        shift || true
        run_deploy "$@"
        ;;
    create-registry)
        shift || true
        run_create_registry "$@"
        ;;
    sync-env)
        shift || true
        run_sync_env "$@"
        ;;
    deploy-and-sync)
        shift || true
        run_deploy "$@"
        run_sync_env "$@"
        ;;
    env-only)
        load_config
        compose_update_env_args
        echo ""
        ;;
    -h|--help|help|'')
        usage
        ;;
    *)
        echo "Unknown command: $1"
        usage
        exit 1
        ;;
esac

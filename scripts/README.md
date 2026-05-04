# Scripts

Helpers for deploying this Express app to **Google Cloud Run** with Docker.

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/)
- [Google Cloud SDK](https://cloud.google.com/sdk/docs/install) (`gcloud`), logged in and with a billing-enabled project
- [Node.js](https://nodejs.org/) (used to build the env payload for `gcloud`)

## One-time setup

1. Copy the config template and edit values:

   ```bash
   cp scripts/cloud-run.config.example scripts/cloud-run.config
   ```

   `scripts/cloud-run.config` is gitignored. Set region, Artifact Registry repo name, image name, and Cloud Run service name. Optionally set `GCP_PROJECT_ID`; otherwise the script uses `gcloud config get-value project`.

2. Authenticate Docker to Artifact Registry (once per machine; use your region from `cloud-run.config`):

   ```bash
   gcloud auth configure-docker REGION-docker.pkg.dev
   ```

   Example: `gcloud auth configure-docker asia-south1-docker.pkg.dev`

## Commands

Run from the **repository root** or from `scripts/` (paths below assume repo root):

| Command | What it does |
|--------|----------------|
| `./scripts/cloud-run.sh deploy` | Enables Cloud Run + Artifact Registry APIs if needed, creates the Artifact Registry Docker repo if missing, builds the image, pushes it, deploys Cloud Run |
| `./scripts/cloud-run.sh create-registry` | Only APIs + Artifact Registry repo + prints the `configure-docker` hint |
| `./scripts/cloud-run.sh sync-env` | Updates Cloud Run env vars from your root `.env` (see below) |
| `./scripts/cloud-run.sh deploy-and-sync` | `deploy` then `sync-env` |
| `./scripts/cloud-run.sh env-only` | Prints the raw `--update-env-vars` string (secrets; do not share) |

Npm equivalents: `npm run cloud-run:deploy`, `npm run cloud-run:create-registry`, `npm run cloud-run:sync-env`, `npm run cloud-run:deploy-and-sync`, `npm run cloud-run:env-only`.

Use `./scripts/cloud-run.sh help` for the built-in usage text.

## Environment variables (`sync-env`)

- **Allowed names** come from **`/.env.example`**: uncommented lines like `FOO=`, and commented optional lines shaped like `# REDIS_URL=`.
- **Values** are read from **`/.env`** (repo root).
- **`PORT`** is never sent to Cloud Run so the platform-provided listening port stays correct.
- `sync-env` uses `gcloud run services update --update-env-vars`, so variables you only set in the console or via secrets are **not removed** unless you overwrite the same keys.

Prefer [Secret Manager](https://cloud.google.com/secret-manager/docs) for production secrets and attach them with `gcloud run services update … --set-secrets=…` as needed.

## Files in this folder

| File | Purpose |
|------|--------|
| `cloud-run.sh` | Main deploy / env / registry script |
| `generate-cloud-run-env.mjs` | Builds the gcloud `--update-env-vars` string from `.env.example` + `.env` |
| `cloud-run.config.example` | Template copied to `cloud-run.config` |
| `cloud-run.config` | Your local GCP settings (not committed) |

## Troubleshooting

- **`Repository … not found` on push** — Run `./scripts/cloud-run.sh create-registry`, or `./scripts/cloud-run.sh deploy` (creates the repo automatically). Confirm `GCP_ARTIFACT_REPO` matches the Docker repository name in GCP.
- **Permission denied pushing** — Run `gcloud auth configure-docker REGION-docker.pkg.dev` and retry `docker push`.
- **`Missing cloud-run.config`** — Copy `cloud-run.config.example` to `cloud-run.config`.
- **`must support amd64/linux`** — You built an ARM-only or incompatible multi-arch image (common on Apple Silicon). `./scripts/cloud-run.sh deploy` builds with `--platform linux/amd64`. Override via `GCP_DOCKER_PLATFORM` in `cloud-run.config` if needed.
- **Container didn’t listen on PORT / startup timeout** — Ensure env is synced (`./scripts/cloud-run.sh sync-env`) so Mongo and JWT vars exist on the service. The process binds to **`0.0.0.0`** as soon as it starts and finishes Mongo/Redis afterward. Check Cloud Run logs. For **Atlas**, allow **`0.0.0.0/0`** (or private networking) so Cloud Run can reach your cluster. Verify with **`GET /api/health`**: **503** while bootstrapping, **200** when ready.

Parent folder also has **`Dockerfile`** and **`.dockerignore`** used by deploy.

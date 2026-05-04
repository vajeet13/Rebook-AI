/**
 * Reads keys from ../.env.example and values from ../.env, outputs a single line
 * for: gcloud run services update/deploy ... --update-env-vars "<output>"
 *
 * Lines in .env.example that define vars (COMMENT lines like "# REDIS_URL=" too)
 * establish the allowlist; only those keys may be synced.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

/** @returns {Set<string>} */
function parseAllowedKeys(examplePath) {
    const keys = new Set();
    if (!fs.existsSync(examplePath)) {
        console.error(`Missing ${examplePath}`);
        process.exit(1);
    }
    const text = fs.readFileSync(examplePath, 'utf8');
    for (const line of text.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        let m = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=/);
        if (!m && trimmed.startsWith('#')) {
            const after = trimmed.replace(/^#\s*/, '');
            m = after.match(/^([A-Za-z_][A-Za-z0-9_]*)=/);
        }
        if (m) keys.add(m[1]);
    }
    return keys;
}

/** @returns {Record<string, string>} */
function parseEnvFile(envPath) {
    const out = {};
    if (!fs.existsSync(envPath)) {
        console.error(`Missing ${envPath} — create it from .env.example`);
        process.exit(1);
    }
    const text = fs.readFileSync(envPath, 'utf8');
    for (const line of text.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eq = trimmed.indexOf('=');
        if (eq === -1) continue;
        const key = trimmed.slice(0, eq).trim();
        if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
        let val = trimmed.slice(eq + 1);
        val = val.replace(/\s+$/, '');
        if (
            (val.startsWith('"') && val.endsWith('"')) ||
            (val.startsWith("'") && val.endsWith("'"))
        ) {
            val = val.slice(1, -1);
        }
        out[key] = val;
    }
    return out;
}

/**
 * gcloud `--update-env-vars` is a dict flag: commas separate KEY=VALUE pairs, so
 * values like `8.8.8.8,1.1.1.1` break parsing ("Bad syntax for dict arg").
 * Use an alternate delimiter (tab) per `gcloud topic escaping`.
 * @see https://cloud.google.com/sdk/gcloud/reference/topic/escaping
 */
const GCLOUD_ENV_PAIR_DELIM = '\t';

const allowed = parseAllowedKeys(path.join(root, '.env.example'));
const fromEnv = parseEnvFile(path.join(root, '.env'));

// Cloud Run sets PORT on the container; do not override from .env.
const SKIP_ON_CLOUD_RUN = new Set(['PORT']);

const pairs = [];
for (const key of [...allowed].sort()) {
    if (SKIP_ON_CLOUD_RUN.has(key)) continue;
    if (!(key in fromEnv)) continue;
    const val = String(fromEnv[key]);
    if (val.includes(GCLOUD_ENV_PAIR_DELIM)) {
        console.error(
            `[generate-cloud-run-env] ${key} contains a tab; use a different delimiter or omit this key.`
        );
        process.exit(1);
    }
    pairs.push(`${key}=${val}`);
}

if (pairs.length === 0) {
    process.stdout.write('');
} else {
    const body = pairs.join(GCLOUD_ENV_PAIR_DELIM);
    process.stdout.write(`^${GCLOUD_ENV_PAIR_DELIM}^${body}`);
}

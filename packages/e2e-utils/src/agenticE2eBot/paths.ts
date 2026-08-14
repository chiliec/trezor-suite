import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Runtime output stays next to the bot (same pattern as fixBot/reports), not
// in repo-root reports/ or os.tmpdir(). Resolved from this file so Playwright
// (cwd: suite/e2e) and the tsx scripts still share the same paths.
export const AGENTIC_E2E_BOT_DIR = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = resolve(AGENTIC_E2E_BOT_DIR, '../../../..');

export const agenticArtifactPath = (fileName: string): string =>
    join(AGENTIC_E2E_BOT_DIR, 'reports', fileName);

export const agenticBrowserPath = (fileName = ''): string =>
    join(AGENTIC_E2E_BOT_DIR, 'reports/browser', fileName);

export function readArtifactJson(fileName: string): unknown {
    return JSON.parse(readFileSync(agenticArtifactPath(fileName), 'utf-8'));
}

export function writeArtifactJson(fileName: string, data: unknown): void {
    const path = agenticArtifactPath(fileName);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);
}

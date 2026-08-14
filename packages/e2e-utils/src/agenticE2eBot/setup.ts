import { config as loadDotenv } from 'dotenv';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

import { error, log } from '../logger';
import {
    killHarnessBrowser,
    killHarnessBrowserOnExitSignals,
    writeBrowserState,
} from './browserState';
import { REPO_ROOT, agenticArtifactPath, agenticBrowserPath, readArtifactJson } from './paths';
import { PrContextSchema } from './schemas';

const SETUP_SPEC = 'agentic/agenticSetup.test.ts';
const SETUP_CONFIG = 'playwright-config/playwright-agentic.config.ts';
const SETUP_READY_FILE = 'setup-ready';
const SETUP_TIMEOUT_MS = 600_000;

async function runOnboardingSpec({
    model,
    suiteUrl,
}: {
    model: string;
    suiteUrl: string;
}): Promise<void> {
    const readyFile = agenticArtifactPath(SETUP_READY_FILE);
    rmSync(readyFile, { force: true });

    // Detached so Playwright outlives this setup process; the agent attaches
    // over CDP to the still-running browser.
    const child = spawn(
        'playwright',
        ['test', SETUP_SPEC, '--config', SETUP_CONFIG, `--project=${model}`],
        {
            cwd: join(REPO_ROOT, 'suite/e2e'),
            env: {
                ...process.env,
                BASE_URL: suiteUrl,
                AGENTIC_E2E_READY_FILE: readyFile,
            },
            stdio: 'inherit',
            detached: true,
        },
    );
    // Spawn can fail before a pid exists; refuse to continue without one.
    if (child.pid === undefined) {
        throw new Error('failed to start playwright');
    }
    // Track the browser immediately so failure/interrupt cleanup can kill it
    // even when onboarding never becomes ready.
    writeBrowserState(child.pid);

    const deadline = Date.now() + SETUP_TIMEOUT_MS;
    while (!existsSync(readyFile)) {
        if (child.exitCode !== null) {
            throw new Error(`onboarding spec exited ${child.exitCode} before becoming ready`);
        }
        if (Date.now() > deadline) {
            throw new Error('onboarding spec timed out');
        }
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Drop the child's handle so this process can exit while Playwright stays
    // alive for the agent session.
    child.unref();
}

async function main(): Promise<void> {
    killHarnessBrowserOnExitSignals();
    mkdirSync(agenticBrowserPath(), { recursive: true });
    loadDotenv({ path: join(REPO_ROOT, 'packages/e2e-utils/.env'), quiet: true });

    const context = PrContextSchema.parse(readArtifactJson('context.json'));
    log('━━━ Agentic E2E setup ━━━');
    log(`Suite:  ${context.suiteUrl}`);
    log(`Model:  ${context.deviceModel}`);

    await killHarnessBrowser();
    await runOnboardingSpec({
        model: context.deviceModel,
        suiteUrl: context.suiteUrl,
    });

    log('Setup done. Browser stays running for the agent session.');
}

main().catch(async e => {
    error(`setup failed: ${e instanceof Error ? e.message : e}`);
    await killHarnessBrowser().catch(() => {});
    process.exitCode = 1;
});

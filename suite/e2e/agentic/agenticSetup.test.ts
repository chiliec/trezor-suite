import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';

import { TrezorUserEnvLink } from '@trezor/trezor-user-env-link';

import { BRIDGE_VERSION } from '../support/bridge';
import { mockRemoteMessageSystem } from '../support/common';
import { test as suiteTest } from '../support/fixtures';
import { enhancePage } from '../support/testExtends/enhancePage';

const CDP_URL = 'http://127.0.0.1:9222';

// The agent's Playwright MCP attaches over CDP (:9222) and only sees the
// browser's DEFAULT context. Playwright test normally puts its page in an
// isolated context that is invisible over CDP, so these fixtures re-attach to
// the Playwright-launched browser via CDP and onboard in the default context —
// otherwise the agent inherits a bare about:blank tab instead of the session.
/* eslint-disable react-hooks/rules-of-hooks */
const test = suiteTest.extend({
    // Depending on `browser` makes Playwright launch its Chromium (with the
    // CDP port from the agentic config) before we re-attach to it.
    context: async ({ browser: _launched }, use) => {
        const cdpBrowser = await chromium.connectOverCDP(CDP_URL);
        const [defaultContext] = cdpBrowser.contexts();
        if (!defaultContext) {
            // Creating a context here instead would put onboarding back into an
            // isolated context the agent cannot see — fail rather than fall back.
            throw new Error('harness browser has no default context over CDP');
        }
        await use(defaultContext);
    },
    // Mirrors webSetup(), but with an absolute BASE_URL and explicit viewport —
    // CDP contexts carry neither the project baseURL nor the configured viewport.
    page: async ({ context }, use, testInfo) => {
        if (!process.env.BASE_URL) {
            throw new Error('BASE_URL is required — run via agentic-e2e:setup');
        }
        await TrezorUserEnvLink.startBridge(BRIDGE_VERSION);
        const page = context.pages()[0] ?? (await context.newPage());
        const { viewport } = testInfo.project.use;
        if (viewport) {
            await page.setViewportSize(viewport);
        }
        await page.context().addInitScript(() => {
            window.Playwright = true;
        });
        await page.goto(process.env.BASE_URL);
        await mockRemoteMessageSystem(page);
        enhancePage(page);
        await use(page);
    },
});
/* eslint-enable react-hooks/rules-of-hooks */

test.use({
    deviceSetup: {
        mnemonic: 'mnemonic_academic',
        passphrase_protection: true,
    },
});

test.describe('Agentic E2E setup', { tag: ['@T1B1', '@T2T1', '@T3B1', '@T3T1', '@T3W1'] }, () => {
    test('complete onboarding', async ({ onboardingPage, dashboardPage, settingsPage }) => {
        await test.step('Complete onboarding', async () => {
            await onboardingPage.completeOnboarding();
        });

        await test.step('Enable networks', async () => {
            await settingsPage.changeNetworks({
                enableNetworks: ['eth', 'btc', 'sol'],
            });
        });

        await test.step('Open hidden wallet', async () => {
            await dashboardPage.openDeviceSwitcher();
            await dashboardPage.addHiddenWallet(process.env.AGENTIC_E2E_PASSPHRASE!);
        });

        await test.step('Signal readiness and stay alive', async () => {
            // Stay alive so the agent can attach over CDP to this Playwright browser.
            test.info().setTimeout(0);
            writeFileSync(process.env.AGENTIC_E2E_READY_FILE, '');
            await new Promise(() => {});
        });
    });
});

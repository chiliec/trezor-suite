import { captureConsoleIntegration } from '@sentry/core';
import * as Sentry from '@sentry/react-native';

import { ALLOW_REPORT_TAG, redactSentryEvent } from '@suite-common/sentry';
import { getEnv, isDebugEnv, isDetoxTestBuild } from '@suite-native/config';

import { ignoreErrors } from './ignoreErrors';

export const setSentryContext = Sentry.setContext;

export const setSentryTag = Sentry.setTag;

export const addSentryBreadcrumb = Sentry.addBreadcrumb;

export const withSentryScope = Sentry.withScope;

export const captureSentryException = Sentry.captureException;

export const captureSentryMessage = Sentry.captureMessage;

export const allowSentryReport = (value: boolean) => {
    Sentry.setTag(ALLOW_REPORT_TAG, value);
};

export const setSentryUser = (instanceId: string) => {
    Sentry.setUser({ id: instanceId });
};

/**
 * The @sentry/react-native default `breadcrumbsIntegration` records every `console.*` call as a
 * `console`-category breadcrumb whose message is the joined arguments. Across the shared wallet
 * code (wallet-core/wallet-utils) those arguments routinely include confidential data (exact
 * amounts, addresses, xpubs) — and once the user consents to analytics, `redactSentryEvent` no
 * longer strips breadcrumbs, so they would be attached to error events and sent to Sentry.
 * The browser/desktop config (suite/sentry config.ts) drops console breadcrumbs for exactly this
 * reason; mirror that here so native is not the outlier.
 */
const beforeBreadcrumb = (breadcrumb: Sentry.Breadcrumb): Sentry.Breadcrumb | null =>
    breadcrumb.category === 'console' ? null : breadcrumb;

export const initSentry = () => {
    Sentry.init({
        dsn: 'https://d473f56df60c4974ae3f3ce00547c2a9@o117836.ingest.sentry.io/4504214699245568',
        enableAutoSessionTracking: false,
        environment: isDetoxTestBuild() ? 'test' : getEnv(),
        beforeBreadcrumb,
        // Important: must be a function to keep default Sentry integrations; an array would mean ONLY those specific integrations.
        integrations: defaults => [
            // remove consoleLoggingIntegration, which sends console.errors as logs
            ...defaults.filter(i => i.name !== 'ConsoleLogs'),
            // use this instead, which sends console.errors as error events
            captureConsoleIntegration({ levels: ['error'] }),
        ],
        enableLogs: true,
        beforeSend: redactSentryEvent,
        ignoreErrors,

        // You can put EXPO_PUBLIC_IS_SENTRY_ON_DEBUG_BUILD_ENABLED=true to `.env.development.local` to debug Sentry locally.
        enabled:
            !isDebugEnv() || process.env.EXPO_PUBLIC_IS_SENTRY_ON_DEBUG_BUILD_ENABLED === 'true',
    });
};

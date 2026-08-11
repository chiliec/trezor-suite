import { captureStartupPerformanceReport } from './startupPerformance';

let jsBundleEvaluatedAtMs: number | undefined;
let hasReportedAppLoad = false;

export const markStartupJsBundleEvaluated = () => {
    if (jsBundleEvaluatedAtMs) return;

    jsBundleEvaluatedAtMs = Date.now();
};

export const reportStartupAppLoaded = () => {
    if (hasReportedAppLoad) return;

    if (!jsBundleEvaluatedAtMs) return;

    hasReportedAppLoad = true;

    const endedAtMs = Date.now();
    const appLoadDurationMs = endedAtMs - jsBundleEvaluatedAtMs;

    captureStartupPerformanceReport({
        startedAtMs: jsBundleEvaluatedAtMs,
        endedAtMs,
        measurements: {
            appLoad: appLoadDurationMs,
        },
    });

    if (__DEV__) {
        // eslint-disable-next-line no-console
        console.table({ appLoad: appLoadDurationMs });
    }
};

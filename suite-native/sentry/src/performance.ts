import { type TransactionEvent } from '@sentry/core';

import { sanitizeNavigationPerformanceTransaction } from './navigationPerformance';
import { sanitizeStartupPerformanceTransaction } from './startupPerformance';

let isPerformanceReportAllowed: boolean | undefined;

export const setPerformanceReportAllowed = (isAllowed: boolean) => {
    isPerformanceReportAllowed = isAllowed;
};

export const beforeSendPerformanceTransaction = (
    event: TransactionEvent,
): TransactionEvent | null => {
    if (isPerformanceReportAllowed !== true) return null;

    return (
        sanitizeStartupPerformanceTransaction(event) ??
        sanitizeNavigationPerformanceTransaction(event)
    );
};

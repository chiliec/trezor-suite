import { createWeakMapSelector, returnStableArrayIfEmpty } from '@suite-common/redux-utils';

import { isTransactionNotification } from './notificationsUtils';
import {
    type NotificationEntry,
    type NotificationsRootState,
    type ToastPayload,
    type TransactionBroadcastNotificationType,
} from './types';

const createMemoizedSelector = createWeakMapSelector.withTypes<NotificationsRootState>();

export const selectNotifications = (state: NotificationsRootState) => state.notifications;

export const selectHasUnseenNotifications = (state: NotificationsRootState): boolean =>
    state.notifications?.some(n => !n.seen && isTransactionNotification(n)) ?? false;

export const selectVisibleNotificationsByType = createMemoizedSelector(
    [
        selectNotifications,
        (_state: NotificationsRootState, notificationType: ToastPayload[keyof ToastPayload]) =>
            notificationType,
    ],
    (notifications, notificationType) =>
        returnStableArrayIfEmpty(
            notifications.filter(
                notification => notification.type === notificationType && !notification.closed,
            ),
        ),
);

const transactionBroadcastNotificationTypes: TransactionBroadcastNotificationType[] = [
    'tx-sent',
    'raw-tx-sent',
    'tx-revoked',
    'tx-approved',
    'tx-exchange',
    'tx-staked',
    'tx-unstaked',
    'tx-claimed',
    'tx-yield-deposit',
    'tx-yield-withdraw',
    'tx-yield-claim',
];

type TransactionBroadcastNotification = Extract<
    NotificationEntry,
    { type: TransactionBroadcastNotificationType }
>;

const isTransactionBroadcastNotification = (
    notification: NotificationEntry,
): notification is TransactionBroadcastNotification =>
    'txid' in notification &&
    transactionBroadcastNotificationTypes.includes(
        notification.type as TransactionBroadcastNotificationType,
    );

export const selectTransactionBroadcastNotificationByTxid = createMemoizedSelector(
    [selectNotifications, (_state: NotificationsRootState, txid: string) => txid],
    (notifications, txid): TransactionBroadcastNotification | undefined =>
        notifications.find(
            (notification): notification is TransactionBroadcastNotification =>
                isTransactionBroadcastNotification(notification) && notification.txid === txid,
        ),
);

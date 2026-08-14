import { createMigration } from '@suite/idb-migration-utils';
import { type NetworkSymbol } from '@suite-common/wallet-config';

import { type SuiteDBSchema } from 'src/storage/definitions';

export default createMigration<SuiteDBSchema>('26.9.0', async (_db, tx) => {
    const store = tx.objectStore('walletSettings');
    const settings = await store.get('wallet');

    if (!settings) return;

    // The stored value may still have the old shape, hence the widening cast.
    const { hideSuspiciousTransactions } = settings as {
        hideSuspiciousTransactions?: Partial<Record<NetworkSymbol, boolean>>;
    };

    if (!hideSuspiciousTransactions) return;

    // The per-network `hideSuspiciousTransactions` boolean was replaced by the per-network
    // `suspiciousTransactionsFilter` value; only enabled entries carry information.
    settings.suspiciousTransactionsFilter = Object.fromEntries(
        Object.entries(hideSuspiciousTransactions)
            .filter(([, isHidden]) => isHidden)
            .map(([symbol]) => [symbol, 'hideSuspicious']),
    );
    // @ts-expect-error The field no longer exists in the schema.
    delete settings.hideSuspiciousTransactions;

    await store.put(settings, 'wallet');
});

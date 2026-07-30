import { createThunk } from '@suite-common/redux-utils';
import { selectNetworkTokenDefinitions } from '@suite-common/token-definitions';
import { advancedSearchTransactions } from '@suite-common/transaction-search';
import {
    TRANSACTIONS_MODULE_PREFIX,
    createSimpleTargetId,
    selectAccountTransactionsMarkedAsNotScam,
    selectBaseCurrency,
    selectHistoricFiatRates,
    selectTransactions,
} from '@suite-common/wallet-core';
import { type Account, type ExportFileType } from '@suite-common/wallet-types';
import { getAccountTransactions } from '@suite-common/wallet-utils';

import { selectAccountLabelsForSearch } from 'src/selectors/suite/selectAccountLabelsForSearch';
import { formatData, getExportedFileName } from 'src/utils/wallet/exportTransactionsUtils';

export const exportTransactionsThunk = createThunk(
    `${TRANSACTIONS_MODULE_PREFIX}/exportTransactions`,
    async (
        {
            account,
            defaultAccountName,
            type,
            searchQuery,
        }: {
            account: Account;
            defaultAccountName: string;
            type: ExportFileType;
            searchQuery: string;
        },
        { getState, extra },
    ) => {
        const { services } = extra;
        // Get state of transactions
        const allTransactions = selectTransactions(getState());
        const historicFiatRates = selectHistoricFiatRates(getState());
        const baseCurrencyCode = selectBaseCurrency(getState());
        const tokenDefinitions = selectNetworkTokenDefinitions(getState(), account.symbol) || {};
        const txsMarkedAsNotScam = selectAccountTransactionsMarkedAsNotScam(
            getState(),
            account.key,
        );

        const accountLabels = selectAccountLabelsForSearch(getState(), account);
        const accountName = accountLabels.accountLabel || defaultAccountName;

        const transactions = getAccountTransactions(account.key, allTransactions)
            .filter(transaction => transaction.blockHeight !== -1)
            .map(transaction => ({
                ...transaction,
                targets: transaction.targets.map(target => ({
                    ...target,
                    outputLabel: accountLabels.outputLabels
                        .get(transaction.txid)
                        ?.get(createSimpleTargetId(target)),
                })),
            }));

        const filteredTransaction =
            searchQuery.trim() !== ''
                ? advancedSearchTransactions(transactions, accountLabels, searchQuery)
                : transactions;

        // getAccountTransactions doesn't guarantee transactions will be sorted
        filteredTransaction.sort((t1, t2) => (t2.blockTime || 0) - (t1.blockTime || 0));

        // Prepare data in right format
        const data = await formatData(
            {
                symbol: account.symbol,
                accountName,
                type,
                transactions: filteredTransaction,
                baseCurrencyCode,
            },
            tokenDefinitions,
            txsMarkedAsNotScam,
            historicFiatRates,
        );

        // Save file
        const fileName = getExportedFileName(accountName, type);

        services.saveAs(data, fileName);
    },
);

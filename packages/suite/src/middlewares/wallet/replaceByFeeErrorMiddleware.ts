import { type MiddlewareAPI } from 'redux';

import { transactionsActions } from '@suite-common/wallet-core/';
import { isPending, isRbfTransaction } from '@suite-common/wallet-utils';

import { type Action, type AppState, type Dispatch } from 'src/types/suite';

import { replaceByFeeErrorThunk } from '../../actions/wallet/send/replaceByFeeErrorThunk';

export const replaceByFeeErrorMiddleware =
    (api: MiddlewareAPI<Dispatch, AppState>) =>
    (next: Dispatch) =>
    (action: Action): Action => {
        next(action);

        if (!transactionsActions.addTransaction.match(action)) {
            return action;
        }

        const { transactions } = action.payload;
        const precomposedTx = api.getState().wallet.send?.precomposedTx;

        if (precomposedTx === undefined) {
            return action;
        }

        if (!isRbfTransaction(precomposedTx)) {
            return action;
        }

        const addedTransaction = transactions.find(tx => tx.txid === precomposedTx.prevTxid);

        // blockHeight is always present and 0 for a mempool tx, so `!== undefined` also matched a
        // still-PENDING predecessor - showing "already mined" and cancelling the replacement that is
        // in flight. Only a mined predecessor may abort the replacement.
        if (addedTransaction && !isPending(addedTransaction)) {
            api.dispatch(replaceByFeeErrorThunk());
        }

        return action;
    };

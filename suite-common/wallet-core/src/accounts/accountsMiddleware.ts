import { createMiddlewareWithExtraDeps } from '@suite-common/redux-utils';

import { accountsActions } from './accountsActions';
import { isAccountStaleSelector } from './accountsRefreshTimeReducer';
import { fetchAndUpdateAccountThunk } from './accountsThunks';

export const prepareAccountsMiddleware = createMiddlewareWithExtraDeps(
    (action, { dispatch, next, getState }) => {
        // propagate action to reducers (the accountsRefreshTime slice records the refresh timestamp
        // off the account entity, reacting to createAccount/updateAccount/removeAccount)
        next(action);

        if (
            accountsActions.updateSelectedAccount.match(action) &&
            action.payload.status === 'loaded'
        ) {
            const accountKey = action.payload.account.key;

            if (isAccountStaleSelector(getState(), accountKey)) {
                dispatch(fetchAndUpdateAccountThunk({ accountKey }));
            }
        }

        return action;
    },
);

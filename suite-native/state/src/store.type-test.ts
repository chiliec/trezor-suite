import { type ThunkAction, type UnknownAction } from '@reduxjs/toolkit';

import { createThunk } from '@suite-common/redux-utils';
import { type NativeServices } from '@suite-native/services';

import { type FullPersistedAppState, type Store, type StoreWithExtra } from './store';

type AvailableState = Pick<FullPersistedAppState, 'wallet'>;
type UnavailableState = {
    unavailable: {
        value: string;
    };
};
type AvailableExtraDependencies = {
    services: Pick<NativeServices, 'getLanguage'>;
};
type UnavailableExtraDependencies = {
    services: {
        unavailableDependency: () => void;
    };
};
type ThunkArgument = { value: number };
type ThunkPayload = { value: string };

const compatibleThunk = createThunk<
    ThunkPayload,
    ThunkArgument,
    { state: AvailableState; extra: AvailableExtraDependencies }
>('test/compatibleThunk', () => ({ value: 'result' }));
const incompatibleStateThunk = createThunk<void, void, { state: UnavailableState }>(
    'test/incompatibleStateThunk',
    () => {},
);
const incompatibleExtraDependenciesThunk = createThunk<
    void,
    void,
    { extra: UnavailableExtraDependencies }
>('test/incompatibleExtraDependenciesThunk', () => {});

const verifyStoreType = (store: Store) => {
    const state: FullPersistedAppState = store.getState();
    const { payload }: { payload: number } = store.dispatch({ type: 'test', payload: 1 });

    const thunk: ThunkAction<
        string,
        FullPersistedAppState,
        StoreWithExtra['extra'],
        UnknownAction
    > = (_dispatch, _getState, { services }) => {
        const typedServices: StoreWithExtra['services'] = services;

        void typedServices;

        return 'result';
    };
    const thunkResult: string = store.dispatch(thunk);

    const thunkPromise = store.dispatch(compatibleThunk({ value: 1 }));
    const { requestId }: { requestId: string } = thunkPromise;
    const { arg: argument }: { arg: ThunkArgument } = thunkPromise;
    const unwrappedPayload: Promise<ThunkPayload> = thunkPromise.unwrap();

    thunkPromise.abort();
    thunkPromise.then(action => {
        if (compatibleThunk.fulfilled.match(action)) {
            const { payload: thunkPayload }: { payload: ThunkPayload } = action;
            const { arg: actionArgument }: { arg: ThunkArgument } = action.meta;

            void thunkPayload;
            void actionArgument;
        }
    });

    // @ts-expect-error The Native store does not provide the state required by this thunk.
    store.dispatch(incompatibleStateThunk());

    // @ts-expect-error The Native store does not provide the extra dependency required by this thunk.
    store.dispatch(incompatibleExtraDependenciesThunk());

    // @ts-expect-error Dispatch only accepts Redux actions or compatible thunks.
    store.dispatch('not an action');

    void state;
    void payload;
    void thunkResult;
    void requestId;
    void argument;
    void unwrappedPayload;
};

void verifyStoreType;

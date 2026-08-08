import { createThunk } from '@suite-common/redux-utils';

import { type SuiteServices } from 'src/support/extraDependencies';

import { type AppState, type SuiteStore } from './store';

type AvailableState = Pick<AppState, 'wallet'>;
type UnavailableState = {
    unavailable: {
        value: string;
    };
};
type AvailableExtraDependencies = {
    services: Pick<SuiteServices, 'getLanguage'>;
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

const verifyStoreDispatch = (dispatch: SuiteStore['store']['dispatch']) => {
    const thunkPromise = dispatch(compatibleThunk({ value: 1 }));
    const { requestId }: { requestId: string } = thunkPromise;
    const { arg: argument }: { arg: ThunkArgument } = thunkPromise;
    const unwrappedPayload: Promise<ThunkPayload> = thunkPromise.unwrap();

    thunkPromise.abort();
    thunkPromise.then(action => {
        if (compatibleThunk.fulfilled.match(action)) {
            const { payload }: { payload: ThunkPayload } = action;
            const { arg: actionArgument }: { arg: ThunkArgument } = action.meta;

            void payload;
            void actionArgument;
        }
    });

    // @ts-expect-error The Suite store does not provide the state required by this thunk.
    dispatch(incompatibleStateThunk());

    // @ts-expect-error The Suite store does not provide the extra dependency required by this thunk.
    dispatch(incompatibleExtraDependenciesThunk());

    void requestId;
    void argument;
    void unwrappedPayload;
};

void verifyStoreDispatch;

import { type Action, type AsyncThunk, type Reducer, type ThunkAction } from '@reduxjs/toolkit';

export interface AnyAction extends Action {
    [extraProps: string]: any;
}

type CompatibleThunkAction<TReturn, TState, TExtra> = (
    dispatch: never,
    getState: () => TState,
    extra: TExtra,
) => TReturn;

/**
 * Dispatches plain actions and thunks whose state and dependencies are available in the store.
 *
 * A thunk is a function receiving `dispatch`, `getState`, and `extra`. The store must prove that
 * its complete state can be used wherever the thunk's smaller state is expected, and likewise for
 * extra dependencies. The first parameter is `never` because checking nested dispatch again would
 * create a circular type. `never` fits every possible dispatch parameter without weakening the
 * state and dependency checks.
 *
 * `TReturn` is inferred from the whole thunk function. For Redux Toolkit thunks, that preserves the
 * promise's `abort`, `unwrap`, `requestId`, and `arg` members instead of reducing it to `Promise`.
 */
export type SelectiveThunkDispatch<TState, TExtra, TAction extends Action> = {
    <TReturn>(thunkAction: CompatibleThunkAction<TReturn, TState, TExtra>): TReturn;
    <TDispatchedAction extends TAction>(action: TDispatchedAction): TDispatchedAction;
    <TReturn, TDispatchedAction extends TAction>(
        action: TDispatchedAction | CompatibleThunkAction<TReturn, TState, TExtra>,
    ): TDispatchedAction | TReturn;
};

/**
 * Original thunk type in Redux before redux-toolkit
 */
export type OriginalReduxThunk<TPayload, TReturn = void> = (
    payload: TPayload,
) => ThunkAction<TReturn, any, any, AnyAction>;

// This SuiteCompatible types should be used only in places where you need support
// for both redux-toolkit and legacy redux stuff like it is in externalDependencies.
// Primary you should use types like ActionCreatorWithPayload from redux-toolkit!
export type SuiteCompatibleThunk<TPayload, TReturn = void> =
    | AsyncThunk<TReturn, TPayload, Record<never, never>>
    | OriginalReduxThunk<TPayload, TReturn>;

export type ActionType = string;

interface TypeGuard<T> {
    (value: any): value is T;
}
interface HasMatchFunction<T> {
    match: TypeGuard<T>;
}
type Matcher<T> = HasMatchFunction<T> | TypeGuard<T>;
type ActionFromMatcher<M extends Matcher<any>> = M extends Matcher<infer T> ? T : never;

type AnyAsyncThunk = {
    pending: {
        match: (action: any) => action is any;
    };
    fulfilled: {
        match: (action: any) => action is any;
    };
    rejected: {
        match: (action: any) => action is any;
    };
};
export type ActionsFromAsyncThunk<T extends AnyAsyncThunk> =
    | ActionFromMatcher<T['pending']>
    | ActionFromMatcher<T['fulfilled']>
    | ActionFromMatcher<T['rejected']>;

export type ReducerState<TReducer extends Reducer<any, any>> =
    TReducer extends Reducer<infer TState, any> ? TState : never;

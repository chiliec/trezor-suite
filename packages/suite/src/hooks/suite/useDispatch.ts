import { useDispatch as useReduxDispatch } from 'react-redux';

import { type UnknownAction } from '@reduxjs/toolkit';

import { type SelectiveThunkDispatch } from '@suite-common/redux-utils';

import { type SuiteExtra } from 'src/support/extraDependencies';
import { type AppState } from 'src/types/suite';

type SuiteDispatch = SelectiveThunkDispatch<AppState, SuiteExtra, UnknownAction>;

export const useDispatch: () => SuiteDispatch = useReduxDispatch;

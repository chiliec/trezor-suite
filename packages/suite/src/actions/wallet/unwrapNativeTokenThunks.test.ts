import { configureMockStore } from '@suite-common/test-utils';
import { type YieldFlowDisplayToken } from '@suite-common/wallet-core';
import { type Account } from '@suite-common/wallet-types';
import { mockWalletAccount } from '@suite-common/wallet-types/mocks';

import { submitUnwrapNativeTokenThunk } from './unwrapNativeTokenThunks';

const mockComposeYieldUnwrapTransactionThunk = jest.fn();
const mockOpenDeferredModal = jest.fn();
const mockSendYieldTransaction = jest.fn();

jest.mock('@suite-common/wallet-core', () => ({
    ...jest.requireActual('@suite-common/wallet-core'),
    composeYieldUnwrapTransactionThunk: (payload: unknown) =>
        mockComposeYieldUnwrapTransactionThunk(payload),
}));

jest.mock('@suite/modal', () => ({
    openDeferredModal: (payload: unknown) => mockOpenDeferredModal(payload),
}));

jest.mock('./stablecoin-yield/signingHelpers', () => ({
    sendYieldTransaction: (payload: unknown) => mockSendYieldTransaction(payload),
}));

const account = mockWalletAccount({ symbol: 'eth' }) as Account;

const token: YieldFlowDisplayToken & { contractAddress: string } = {
    networkSymbol: 'eth',
    symbol: 'WETH',
    decimals: 18,
    contractAddress: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
};

describe('submitUnwrapNativeTokenThunk', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockComposeYieldUnwrapTransactionThunk.mockImplementation(() => () => ({
            unwrap: () =>
                Promise.resolve({
                    type: 'action-ready',
                    unsignedTransaction: '{}',
                }),
        }));
        mockOpenDeferredModal.mockImplementation(() => () => Promise.resolve({ value: false }));
    });

    it('uses the shared unwrap composition from wallet-core', async () => {
        const store = configureMockStore({ extra: {}, preloadedState: {} });

        await store
            .dispatch(
                submitUnwrapNativeTokenThunk({
                    account,
                    token,
                    unwrapAmount: '1',
                }),
            )
            .unwrap();

        expect(mockComposeYieldUnwrapTransactionThunk).toHaveBeenCalledWith({
            account,
            token,
            unwrapAmount: '1',
        });
        expect(mockOpenDeferredModal).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'earn-yield-tx-simulation',
                data: expect.objectContaining({ flow: 'unwrap' }),
            }),
        );
    });

    it('does not log the raw broadcast error (which can embed the signed tx hex) to console.error', async () => {
        const store = configureMockStore({ extra: {}, preloadedState: {} });
        mockOpenDeferredModal.mockImplementation(
            () => () => Promise.resolve({ value: true, resolve: jest.fn() }),
        );

        // A failed EVM broadcast throws with the node's rejection message, which (via viem)
        // echoes the full raw signed transaction hex and the from-address — confidential data.
        const confidentialTx =
            '0x02f8b10182...deadbeefaddress0xabc1234signedserializedtransactionhexSECRET';
        mockSendYieldTransaction.mockRejectedValue(
            new Error(`Push_TransactionFailed: RPC error, request: ${confidentialTx}`),
        );

        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        await store
            .dispatch(
                submitUnwrapNativeTokenThunk({
                    account,
                    token,
                    unwrapAmount: '1',
                }),
            )
            .unwrap();

        // Serialize each logged arg the way Sentry's captureConsoleIntegration does
        // (Error → message + stack, which JSON.stringify would drop as non-enumerable).
        const serializeArg = (arg: unknown) =>
            arg instanceof Error ? `${arg.message}\n${arg.stack ?? ''}` : String(arg);
        const loggedText = consoleErrorSpy.mock.calls.flat().map(serializeArg).join('\n');

        expect(consoleErrorSpy).toHaveBeenCalled();
        expect(loggedText).not.toContain(confidentialTx);
        expect(loggedText).not.toContain('SECRET');

        consoleErrorSpy.mockRestore();
    });

    it('uses the parent yield flow identity when provided', async () => {
        const store = configureMockStore({ extra: {}, preloadedState: {} });
        mockOpenDeferredModal.mockImplementation(
            () => () => Promise.resolve({ value: true, resolve: jest.fn() }),
        );
        mockSendYieldTransaction.mockResolvedValue({ txid: '0xunwrap' });

        await store
            .dispatch(
                submitUnwrapNativeTokenThunk({
                    account,
                    token,
                    unwrapAmount: '1',
                    yieldFlow: {
                        flowKey: 'yield-flow',
                        flowType: 'redeem',
                    },
                }),
            )
            .unwrap();

        expect(mockSendYieldTransaction).toHaveBeenCalledWith(
            expect.objectContaining({
                flowKey: 'yield-flow',
                flowType: 'redeem',
            }),
        );
    });
});

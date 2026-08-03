import type { Horizon } from '@stellar/stellar-sdk';

import { BigNumber } from '@trezor/utils';

import { toStroops } from '../../constants';
import * as fixtures from './__fixtures__/transactions.fixture';

import { buildSendTransaction, identifyTransaction, transformTransaction } from './index';

describe('transactions', () => {
    describe('toStroops', () => {
        fixtures.toStroops.forEach(({ description, input, expectedOutput }) => {
            it(description, () => {
                const result = toStroops(input);
                expect(result).toEqual(new BigNumber(expectedOutput));
            });
        });
    });

    describe('transformTransaction', () => {
        fixtures.transformTransactionInputs.forEach(f => {
            it(f.description, () => {
                const resp = transformTransaction(f.tx);
                expect(resp).toEqual(f.result);
            });
        });
    });

    describe('buildSendTransaction', () => {
        fixtures.buildSendTransaction.forEach(({ description, input, expectedOutput }) => {
            it(description, () => {
                const result = buildSendTransaction({
                    descriptor: input.descriptor,
                    sequence: input.sequence,
                    fee: input.fee,
                    destinationActivated: input.destinationActivated,
                    destination: input.destination,
                    amount: input.amount,
                    asset: input.asset,
                    destinationTag: input.destinationTag,
                    isTestnet: input.isTestnet,
                });
                expect(result).toEqual(expectedOutput);
            });
        });
    });

    describe('identifyTransaction (untrusted Horizon record hardening)', () => {
        // Horizon backends are user-selectable (custom backends), so a single malformed record
        // must degrade to 'unknown' rather than throw out of the whole account-history .map().
        const baseRawTx = {
            hash: 'deadbeef',
            ledger_attr: 123,
            source_account: 'not-a-valid-stellar-address',
            fee_charged: '100',
            created_at: '2020-01-01T00:00:00Z',
            successful: true,
            envelope_xdr: 'this-is-not-valid-xdr',
        } as unknown as Horizon.ServerApi.TransactionRecord;

        it('does not throw on a malformed created_at (explicit-throw thrower before the guard)', () => {
            const rawTx = {
                ...baseRawTx,
                created_at: 'definitely-not-a-date',
            } as unknown as Horizon.ServerApi.TransactionRecord;

            let result: ReturnType<typeof identifyTransaction> | undefined;
            expect(() => {
                result = identifyTransaction(rawTx);
            }).not.toThrow();
            expect(result?.type).toBe('unknown');
            expect(result?.createdAt).toBeUndefined();
            expect(result?.hash).toBe('deadbeef');
        });

        it('does not throw on a missing fee_charged and a malformed source_account', () => {
            const rawTx = {
                ...baseRawTx,
                fee_charged: undefined,
                source_account: '???',
                fee_account: undefined,
            } as unknown as Horizon.ServerApi.TransactionRecord;

            let result: ReturnType<typeof identifyTransaction> | undefined;
            expect(() => {
                result = identifyTransaction(rawTx);
            }).not.toThrow();
            expect(result?.type).toBe('unknown');
            expect(result?.fee).toBe('');
            expect(result?.feeSource).toBe('');
        });

        it('does not throw on an unparseable envelope_xdr', () => {
            expect(() => identifyTransaction(baseRawTx)).not.toThrow();
            expect(identifyTransaction(baseRawTx).type).toBe('unknown');
        });
    });
});

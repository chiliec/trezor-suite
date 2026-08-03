import { type Account } from '@suite-common/wallet-types';

import {
    getAccountAutocompoundBalanceFixtures,
    getAccountEverstakeStakingPoolFixtures,
    getEthAccountTotalStakingBalanceFixtures,
    getUnstakeAmountByEthereumDataHexFixtures,
} from './__fixtures__/ethereumStakingUtils';
import {
    getAccountAutocompoundBalance,
    getAccountEverstakeStakingPool,
    getEthAccountTotalStakingBalance,
    getUnstakeAmountByEthereumDataHex,
} from './ethereumStakingUtils';

describe('getAccountEverstakeStakingPool', () => {
    getAccountEverstakeStakingPoolFixtures.forEach(({ description, account, expected }) => {
        it(description, () => {
            const result = getAccountEverstakeStakingPool(account as unknown as Account);
            expect(result).toEqual(expected);
        });
    });
});

describe('getAccountEverstakeStakingPool with malformed backend data', () => {
    // The Everstake pool balance fields come verbatim from an untrusted backend (blockbook /
    // evm-rpc) with no numeric validation. `fromWei` -> `toBN` throws on non-integer / NaN /
    // negative / infinite values, and this getter is reached from Redux selectors during render
    // with persisted account data, so an unguarded throw is a persistent render-crash DoS.
    const malformedValues = [
        { description: 'non-numeric string', value: 'not_a_number' },
        { description: 'empty string', value: '' },
        { description: 'non-integer (decimal) wei', value: '1.5' },
        { description: 'negative value', value: '-1000000000000000000' },
        { description: 'missing field (undefined)', value: undefined },
        { description: 'null value', value: null },
    ];

    malformedValues.forEach(({ description, value }) => {
        it(`does not throw and returns undefined for a pool with ${description}`, () => {
            const account = {
                networkType: 'ethereum',
                misc: {
                    stakingPools: [
                        {
                            name: 'Everstake',
                            autocompoundBalance: value,
                            claimableAmount: '500000000000000000',
                            depositedBalance: '3000000000000000000',
                            pendingBalance: '100000000000000000',
                            pendingDepositedBalance: '200000000000000000',
                            restakedReward: '150000000000000000',
                            withdrawTotalAmount: '500000000000000000',
                        },
                    ],
                },
            } as unknown as Account;

            expect(() => getAccountEverstakeStakingPool(account)).not.toThrow();
            expect(getAccountEverstakeStakingPool(account)).toBeUndefined();
        });
    });

    it('degrades gracefully in downstream getters when the pool is malformed', () => {
        const account = {
            networkType: 'ethereum',
            misc: {
                stakingPools: [{ name: 'Everstake', autocompoundBalance: 'garbage' }],
            },
        } as unknown as Account;

        expect(() => getAccountAutocompoundBalance(account)).not.toThrow();
        expect(getAccountAutocompoundBalance(account)).toBe('0');
        expect(() => getEthAccountTotalStakingBalance(account)).not.toThrow();
        expect(getEthAccountTotalStakingBalance(account)).toBe('0');
    });
});

describe('getAccountAutocompoundBalance', () => {
    getAccountAutocompoundBalanceFixtures.forEach(({ description, account, expectedBalance }) => {
        it(description, () => {
            const result = getAccountAutocompoundBalance(account as unknown as Account);
            expect(result).toEqual(expectedBalance);
        });
    });
});

describe('getEthAccountTotalStakingBalance', () => {
    getEthAccountTotalStakingBalanceFixtures.forEach(
        ({ description, account, expectedBalance }) => {
            it(description, () => {
                const result = getEthAccountTotalStakingBalance(account as unknown as Account);
                expect(result).toEqual(expectedBalance);
            });
        },
    );
});

describe('getUnstakeAmountByEthereumDataHex', () => {
    getUnstakeAmountByEthereumDataHexFixtures.forEach(f => {
        it(f.description, () => {
            const result = getUnstakeAmountByEthereumDataHex(f.transactionData);
            expect(result).toBe(f.expectedAmountWei);
        });
    });
});

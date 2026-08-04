import { bech32 } from '@scure/base';

import { type AdaPools } from '@suite-common/earn-staking-api';
import { type NetworkSymbol, getNetworkFeatures } from '@suite-common/wallet-config';
import {
    CARDANO_EVERSTAKE_STAKING_POOL,
    CARDANO_POOL_SATURATION_SAFE_THRESHOLD,
    EVERSTAKE_POOLS,
    FIVE_BINARIES_POOLS,
} from '@suite-common/wallet-constants';
import {
    type Account,
    type StakeType,
    type SupportedCardanoNetworkSymbols,
    type WalletAccountTransaction,
    supportedCardanoNetworkSymbols,
} from '@suite-common/wallet-types';
import { PROTO } from '@trezor/connect';
import { BigNumber, isArrayMember } from '@trezor/utils';

import { asAmountSubunit } from './AmountTypes';
import { subunitsToUnits } from './amountUtils';

export function isSupportedAdaStakingNetworkSymbol(
    symbol: NetworkSymbol,
): symbol is SupportedCardanoNetworkSymbols {
    return isArrayMember(symbol, supportedCardanoNetworkSymbols);
}

export const getCardanoStakingSymbols = (networkSymbols: NetworkSymbol[]) =>
    networkSymbols.reduce((acc, networkSymbol) => {
        if (
            isSupportedAdaStakingNetworkSymbol(networkSymbol) &&
            getNetworkFeatures(networkSymbol).includes('staking')
        ) {
            acc.push(networkSymbol);
        }

        return acc;
    }, [] as SupportedCardanoNetworkSymbols[]);

export const isCardanoStakingActive = (account: Account | null) => {
    if (!account?.misc || account.networkType !== 'cardano') return false;

    const { isActive } = account.misc.staking;

    return isActive;
};

export const getCardanoAccountPoolId = (account?: Account) => {
    if (account?.networkType !== 'cardano') return null;

    const poolId = account.misc?.staking?.poolId;

    return poolId || null;
};

export const isCardanoStakedWithEverstake = (
    account: Account,
    cardanoStakingPools?: AdaPools['pools'],
) => {
    const accountPoolId = getCardanoAccountPoolId(account);
    if (!accountPoolId) return false;

    // EVERSTAKE_POOLS is the definitive list — migration should only be offered to users
    // outside the Everstake ecosystem entirely, not between Everstake pools.
    if (EVERSTAKE_POOLS.includes(accountPoolId)) return true;

    return cardanoStakingPools?.some(pool => pool.id === accountPoolId) ?? false;
};

export const isCardanoStakedOutsideEverstake = (
    account: Account,
    cardanoStakingPools: AdaPools['pools'],
) => {
    if (!getCardanoAccountPoolId(account)) return false;

    return !isCardanoStakedWithEverstake(account, cardanoStakingPools);
};

export const isCardanoStakedWithFiveBinaries = (account: Account) => {
    const accountPoolId = getCardanoAccountPoolId(account);
    if (!accountPoolId) return false;

    return FIVE_BINARIES_POOLS.includes(accountPoolId);
};

export const poolBech32ToHex = (poolId: string): string => {
    const decoded = bech32.decode(poolId as `${string}1${string}`);
    const bytes = bech32.fromWords(decoded.words);

    return Buffer.from(bytes).toString('hex');
};

// poolBech32ToHex throws (bech32.decode) on a malformed pool id; this returns null instead
// so callers reached during render can fall back safely rather than crash.
const tryPoolBech32ToHex = (poolId: string): string | null => {
    try {
        return poolBech32ToHex(poolId);
    } catch {
        return null;
    }
};

export const selectBestCardanoPool = (pools?: AdaPools['pools']) => {
    if (!pools || pools.length === 0) return CARDANO_EVERSTAKE_STAKING_POOL;

    // find the one within the threshold
    const bestPool = pools.find(pool => pool.saturation < CARDANO_POOL_SATURATION_SAFE_THRESHOLD);

    // otherwise pick the last one (lowest saturation)
    const selectedPool = bestPool ?? pools[pools.length - 1];
    if (!selectedPool) return CARDANO_EVERSTAKE_STAKING_POOL;

    // A pool id from the earn-staking backend is only schema-validated as a string, not as a
    // decodable bech32 pool id. poolBech32ToHex (bech32.decode) throws on a malformed id, and
    // selectBestCardanoPool runs inside a render-time selector (selectPoolStatsApy) as well as
    // during tx composition — a throw here would crash the render. Fall back to the Everstake
    // pool when the selected id cannot be decoded instead of throwing.
    const hex = tryPoolBech32ToHex(selectedPool.id);
    if (hex === null) return CARDANO_EVERSTAKE_STAKING_POOL;

    return {
        hex,
        bech32: selectedPool.id,
    };
};

// https://cips.cardano.org/cip/CIP-0129 governance key header bytes for DRep ids.
const CIP129_DREP_KEY_HASH_HEADER = 0x22;
const CIP129_DREP_SCRIPT_HASH_HEADER = 0x23;

export const validateCardanoDrep = (drepId: string): boolean => {
    try {
        const { prefix, words } = bech32.decode(drepId as `${string}1${string}`);
        if (prefix !== 'drep' && prefix !== 'drep_script') return false;

        const bytes = bech32.fromWords(words);
        if (bytes.length !== 28 && bytes.length !== 29) return false;

        if (prefix === 'drep_script' && bytes.length !== 28) return false;

        // CIP-129 (29-byte) ids carry a header byte that must map to a supported
        // DRep type; otherwise parseDrepCip129 would throw. Keep validation aligned
        // with parsing so a bech32-valid but unsupported-header id is rejected here
        // instead of throwing later during transaction composition.
        if (
            bytes.length === 29 &&
            bytes[0] !== CIP129_DREP_KEY_HASH_HEADER &&
            bytes[0] !== CIP129_DREP_SCRIPT_HASH_HEADER
        ) {
            return false;
        }

        return true;
    } catch {
        return false;
    }
};

// https://cips.cardano.org/cip/CIP-0129
const parseDrepCip129 = (bytes: number[]) => {
    const header = bytes[0];
    const hex = Buffer.from(bytes.slice(1)).toString('hex');

    switch (header) {
        case CIP129_DREP_KEY_HASH_HEADER:
            return { type: PROTO.CardanoDRepType.KEY_HASH, hex };
        case CIP129_DREP_SCRIPT_HASH_HEADER:
            return { type: PROTO.CardanoDRepType.SCRIPT_HASH, hex };
        default:
            throw new Error(`Unsupported DRep id CIP-129 header: ${header}`);
    }
};

// https://cips.cardano.org/cip/CIP-0105#drep-keys-1
// Legacy
const parseDrepCip105 = (bytes: number[], prefix: string) => {
    const hex = Buffer.from(bytes).toString('hex');

    switch (prefix) {
        case 'drep':
            return { type: PROTO.CardanoDRepType.KEY_HASH, hex };
        case 'drep_script':
            return { type: PROTO.CardanoDRepType.SCRIPT_HASH, hex };
        default:
            throw new Error(`Unsupported DRep id CIP-105 prefix: ${prefix}`);
    }
};

export const parseDrepBech32 = (drepId: string): { type: PROTO.CardanoDRepType; hex: string } => {
    if (!validateCardanoDrep(drepId)) throw new Error('Not a DRep bech32');

    const { words, prefix } = bech32.decode(drepId as `${string}1${string}`);
    const bytes = Array.from(bech32.fromWords(words));

    if (bytes.length === 28) {
        return parseDrepCip105(bytes, prefix);
    }

    if (bytes.length === 29) {
        return parseDrepCip129(bytes);
    }

    throw new Error(`Unsupported DRep payload length: ${bytes.length}`);
};

export const getAdaAccountTotalStakingBalance = (account: Account) =>
    account?.networkType === 'cardano' && account.misc?.staking?.isActive
        ? subunitsToUnits({
              value: asAmountSubunit(new BigNumber(account.balance)),
              symbol: account.symbol,
          }).toString()
        : null;

type CardanoSpecific = NonNullable<WalletAccountTransaction['cardanoSpecific']>;
export const subtypeToStakeTypeMap: Record<Required<CardanoSpecific>['subtype'], StakeType> = {
    stake_delegation: 'stake',
    stake_registration: 'stake',
    stake_deregistration: 'unstake',
    withdrawal: 'claim',
    governance_delegation: 'change-delegate',
};

export const isCardanoStakingTx = (transaction: WalletAccountTransaction) =>
    transaction.cardanoSpecific?.subtype && !transaction.tokens.length;

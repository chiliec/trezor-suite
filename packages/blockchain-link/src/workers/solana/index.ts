import type {
    AccountInfo,
    MessageTypes,
    Response,
    SubscriptionAccountInfo,
    TokenDetailByMint,
    TokenInfo,
    Transaction,
} from '@trezor/blockchain-link-types';
import { CustomError, MESSAGES, RESPONSES } from '@trezor/blockchain-link-types';
import { solanaUtils } from '@trezor/blockchain-link-utils';
import { getSuiteVersion } from '@trezor/env-utils';
import {
    SOLANA_DECIMALS,
    SOLANA_MAINNET_GENESIS_HASH,
    tokenProgramsInfo,
} from '@trezor/network-solana/constants';
import solana from '@trezor/network-solana/runtime';
import type {
    AccountInfoBase,
    Address,
    ParsedTransactionWithMeta,
    Signature,
    Slot,
    SolanaAPI,
    SolanaRpcResponse,
    SolanaTokenAccountInfo,
    SolanaValidParsedTxWithMeta,
} from '@trezor/network-solana/types';
import { type IntervalId } from '@trezor/type-utils';
import { BigNumber, createDeferred, createLazy, isNotNullOrUndefined } from '@trezor/utils';

import { BaseWorker, CONTEXT, type ContextType } from '../baseWorker';

type Context = ContextType<SolanaAPI> & {
    getTokenMetadata: () => Promise<TokenDetailByMint>;
    onNetworkDisconnect: () => void;
};
type Request<T> = T & Context;

type SignatureWithSlot = {
    signature: Signature;
    slot: Slot;
};

// The `getSignaturesForAddress` result is raw JSON from a user-selectable Solana RPC backend; the
// @solana/kit rpc layer performs no response-shape validation, so a malformed or malicious backend
// may return a non-array (or omit it). A bare `.map` on such a value throws synchronously and
// rejects the whole getAllSignatures call, which aborts account discovery / getAccountInfo
// (per-account history DoS). Guard the array shape before mapping.
export const transformSignatureInfos = (
    signaturesInfos: readonly { signature: Signature; slot: Slot }[] | undefined,
): SignatureWithSlot[] =>
    Array.isArray(signaturesInfos)
        ? signaturesInfos.map(info => ({ signature: info.signature, slot: info.slot }))
        : [];

// A token transfer's counterparty (`from`/`to` when it isn't the user's own descriptor) is taken
// verbatim from the parsed instruction data of an untrusted, user-selectable Solana RPC backend.
// `address()` validates base58 and throws on a malformed value, so mapping a transaction page without
// this guard lets a single poison token transfer reject the whole `Promise.all` and abort the entire
// history page (per-account getAccountInfo DoS). Fall back to the raw string so the record survives.
export const resolveTransferOwner = async (
    owner: string,
    descriptor: string,
    validate: (owner: string) => Address,
    resolveAtaOwner: (validatedOwner: Address) => Promise<string>,
): Promise<string> => {
    if (owner === descriptor) return owner;

    let validatedOwner: Address;
    try {
        validatedOwner = validate(owner);
    } catch {
        return owner;
    }

    return await resolveAtaOwner(validatedOwner);
};

const getAllSignatures = async (
    api: SolanaAPI,
    descriptor: MessageTypes.GetAccountInfo['payload']['descriptor'],
    fullHistory = false,
) => {
    const { address } = await solana();
    let lastSignature: SignatureWithSlot | undefined;
    let keepFetching = true;
    let allSignatures: SignatureWithSlot[] = [];

    const defaultValueLimit = 100; // default value of getSignaturesForAddress
    while (keepFetching) {
        const signaturesInfos = await api.rpc
            .getSignaturesForAddress(address(descriptor), {
                before: lastSignature?.signature,
                limit: defaultValueLimit,
            })
            .send();

        const signatures = transformSignatureInfos(signaturesInfos);
        lastSignature = signatures[signatures.length - 1];
        keepFetching = signatures.length === defaultValueLimit && fullHistory;
        allSignatures = [...allSignatures, ...signatures];
    }

    return allSignatures;
};

const fetchTransactionPage = async (
    api: SolanaAPI,
    signatures: Signature[],
): Promise<ParsedTransactionWithMeta[]> =>
    (
        await Promise.all(
            signatures.map(signature =>
                api.rpc
                    .getTransaction(signature, {
                        encoding: 'jsonParsed',
                        maxSupportedTransactionVersion: 0,
                        commitment: 'confirmed',
                    })
                    .send(),
            ),
        )
    ).filter(isNotNullOrUndefined);

export const isValidTransaction = (
    tx: ParsedTransactionWithMeta,
): tx is SolanaValidParsedTxWithMeta =>
    // This type-predicate must guarantee everything solanaUtils.transformTransaction / getDetails
    // dereference *unconditionally* while mapping a whole account-history page — an untrusted or
    // compromised RPC (endpoint is user-selectable / MITM-able and the `jsonParsed` response is not
    // schema-validated) can return an otherwise-valid tx that omits one of these fields, and a single
    // throw fails the entire page `.map` (poison one record → fail entire page). Concretely:
    //   - `transaction.signatures[0]` → txid (solana.ts getDetails / transformTransaction)
    //   - `transaction.message.accountKeys.map(...)` (getNativeEffects, reached first)
    //   - `transaction.message.instructions.some(...)` (getTxType)
    //   - `meta.preBalances[i]` / `meta.postBalances[i]` (extractAccountBalanceDiff)
    //   - `meta.fee.toString()` (getNativeTransferTxType)
    // Their TS types mark them non-optional, so downstream code trusts them; validate them here so
    // malformed records are dropped at the boundary instead of crashing the page.
    !!(
        tx?.meta &&
        tx.transaction &&
        tx.blockTime &&
        tx.transaction.signatures?.length &&
        Array.isArray(tx.transaction.message?.accountKeys) &&
        Array.isArray(tx.transaction.message?.instructions) &&
        Array.isArray(tx.meta.preBalances) &&
        Array.isArray(tx.meta.postBalances) &&
        tx.meta.fee != null
    );

const pushTransaction = async (request: Request<MessageTypes.PushTransaction>) => {
    const rawTx = request.payload.hex.startsWith('0x')
        ? request.payload.hex.slice(2)
        : request.payload.hex;
    const api = await request.connect();
    const { sendAndConfirmTransaction } = await solana();

    const signature = await sendAndConfirmTransaction(rawTx, api);

    return {
        type: RESPONSES.PUSH_TRANSACTION,
        payload: signature,
    } as const;
};

const getAccountInfo = async (request: Request<MessageTypes.GetAccountInfo>) => {
    const { payload } = request;
    const { details = 'basic' } = payload;
    const api = await request.connect();
    const { address, getSolanaStakingData } = await solana();

    const publicKey = address(payload.descriptor);

    const { value: accountInfo } = await api.rpc
        .getAccountInfo(publicKey, { encoding: 'base64' })
        .send();

    const tokenMetadata = await request.getTokenMetadata();

    const getTokenAccountsForProgram = (programPublicKey: string) =>
        api.rpc
            .getTokenAccountsByOwner(
                publicKey,
                { programId: address(programPublicKey) } /* filter */,
                { encoding: 'jsonParsed' },
            )
            .send();

    const tokenAccounts = (
        await Promise.all(
            Object.values(tokenProgramsInfo).map(programInfo =>
                getTokenAccountsForProgram(programInfo.publicKey),
            ),
        )
    )
        // `res.value` and its records come from an untrusted, user-selectable RPC backend and
        // are not runtime-validated; drop non-array pages and null/malformed records so a single
        // poison token account cannot crash the derefs below (and transformTokenInfo) via
        // `acc.account.data` and fail the whole getAccountInfo request.
        .flatMap(res => (Array.isArray(res?.value) ? res.value : []))
        .filter(acc => acc?.account?.data != null);

    const recognisedWithBalance = tokenAccounts.filter(acc => {
        const info = acc.account.data.parsed?.info;
        const mint = info?.mint;
        const amount = info?.tokenAmount?.amount;

        return mint && tokenMetadata[mint] && amount !== '0';
    });

    const recognizedAccountsPubkeys = recognisedWithBalance.map(a => a.pubkey);

    const getAllTxIds = async (tokenAccountPubkeys: string[]) => {
        const sortedTokenAccountPubkeys = [...tokenAccountPubkeys].sort();

        const allAccounts = [payload.descriptor, ...sortedTokenAccountPubkeys];

        const allTxIds =
            details === 'txs' || details === 'txids'
                ? Array.from(
                      new Set(
                          (
                              await Promise.all(
                                  allAccounts.map(account => getAllSignatures(api, account)),
                              )
                          )
                              .flat()
                              .sort((a, b) => Number(b.slot - a.slot))
                              .map(it => it.signature),
                      ),
                  )
                : [];

        return allTxIds;
    };

    const getEpoch = async (): Promise<number> => {
        const cachedEpoch = await request.state.cache.get('epoch');

        if (cachedEpoch) {
            return cachedEpoch;
        }

        // for parallel requests we store the promise in the cache immediately
        const deferred = createDeferred<number>();
        request.state.cache.set('epoch', deferred.promise, 3_600_000);

        const { epoch } = await api.rpc.getEpochInfo().send();
        deferred.resolve(Number(epoch));

        return deferred.promise;
    };

    // Fetch token info only if the account owns tokens
    let tokens: TokenInfo[] = [];
    if (tokenAccounts.length > 0) {
        tokens = solanaUtils.transformTokenInfo(tokenAccounts, tokenMetadata);
    }

    if (details === 'txids') {
        const txids = await getAllTxIds(recognizedAccountsPubkeys);
        const solEpoch = await getEpoch();

        const account: AccountInfo = {
            descriptor: payload.descriptor,
            balance: '0',
            availableBalance: '0',
            empty: txids.length === 0,
            history: {
                total: txids.length,
                unconfirmed: 0,
                txids,
            },
            tokens,
            misc: { solEpoch },
        };

        return {
            type: RESPONSES.GET_ACCOUNT_INFO,
            payload: account,
        } as const;
    }

    // token account's owner is the wallet
    const getATAOwnerAddress = async (address: Address) => {
        const { value: accountInfo } = await api.rpc
            .getAccountInfo(address, {
                encoding: 'jsonParsed',
            })
            .send();

        if (!accountInfo?.data || 'parsed' in accountInfo.data === false) {
            return address;
        }

        return (accountInfo.data.parsed?.info as { owner?: string })?.owner ?? address;
    };

    const getTransactionPage = async (
        txIds: Signature[],
        tokenAccountsInfos: SolanaTokenAccountInfo[],
    ) => {
        if (txIds.length === 0) {
            return [];
        }

        const transactionsPage = await fetchTransactionPage(api, txIds);

        const page = transactionsPage
            .filter(isValidTransaction)
            .map(tx =>
                solanaUtils.transformTransaction(
                    tx,
                    payload.descriptor,
                    tokenAccountsInfos,
                    tokenMetadata,
                ),
            )
            .filter(isNotNullOrUndefined);

        const transactions: Transaction[] = await Promise.all(
            page.map(async tx => {
                const tokens = await Promise.all(
                    tx.tokens.map(async transfer => {
                        // token account address is derived from the wallet address who is owner of that account
                        const from = await resolveTransferOwner(
                            transfer.from,
                            payload.descriptor,
                            address,
                            getATAOwnerAddress,
                        );
                        const to = await resolveTransferOwner(
                            transfer.to,
                            payload.descriptor,
                            address,
                            getATAOwnerAddress,
                        );

                        return {
                            ...transfer,
                            from,
                            to,
                        };
                    }),
                );

                return { ...tx, tokens };
            }),
        );

        return transactions;
    };

    const allTxIds = await getAllTxIds(recognizedAccountsPubkeys);

    const pageNumber = payload.page ? payload.page - 1 : 0;
    // for the first page of txs, payload.page is undefined, for the second page is 2
    const pageSize = payload.pageSize || 5;

    const pageStartIndex = pageNumber * pageSize;
    const pageEndIndex = Math.min(pageStartIndex + pageSize, allTxIds.length);

    const txIdPage = allTxIds.slice(pageStartIndex, pageEndIndex);

    const tokenAccountsInfos = tokenAccounts.map(a => ({
        address: a.pubkey,
        mint: a.account.data.parsed?.info?.mint,
        decimals: a.account.data.parsed?.info?.tokenAmount?.decimals,
    }));

    const transactionPage =
        details === 'txs' ? await getTransactionPage(txIdPage, tokenAccountsInfos) : undefined;

    const { value: balance } = await api.rpc.getBalance(publicKey).send();

    let misc: AccountInfo['misc'] | undefined;

    // Not necessary for basic and tokens details
    if (!['basic', 'tokens'].includes(details)) {
        const solEpoch = await getEpoch();
        const [solStakingAccounts, solExternalStakingAccounts] = await Promise.all([
            getSolanaStakingData(api?.rpc, publicKey, solEpoch, 'everstake'),
            getSolanaStakingData(api?.rpc, publicKey, solEpoch, 'non-everstake'),
        ]);

        misc = {
            solStakingAccounts,
            solExternalStakingAccounts,
            solEpoch,
        };

        if (accountInfo) {
            const [accountDataEncoded] = accountInfo.data;
            const accountDataBytes = Buffer.from(accountDataEncoded, 'base64'); // Previously `getBase64Encoder().encode(bytes)` was used
            const accountDataLength = BigInt(accountDataBytes.byteLength);
            const rent = await api.rpc.getMinimumBalanceForRentExemption(accountDataLength).send();

            misc.rent = Number(rent);
        }
    }

    // allTxIds can be empty for non-archive rpc nodes
    const isAccountEmpty = !(allTxIds.length || balance || tokens.length);

    const account: AccountInfo = {
        descriptor: payload.descriptor,
        balance: balance.toString(),
        availableBalance: balance.toString(),
        empty: isAccountEmpty,
        history: {
            total: allTxIds.length,
            unconfirmed: 0,
            transactions: transactionPage,
            txids: txIdPage,
        },
        page: transactionPage
            ? {
                  total: allTxIds.length,
                  index: pageNumber,
                  size: transactionPage.length,
              }
            : undefined,
        tokens,
        misc: { ...misc, owner: accountInfo?.owner },
    };

    // Update token accounts of account stored by the worker since new accounts
    // might have been created. We otherwise would not get proper updates for new
    // token accounts.
    const workerAccount = request.state.getAccount(payload.descriptor);
    if (workerAccount) {
        request.state.addAccounts([{ ...workerAccount, tokens }]);
    }

    return {
        type: RESPONSES.GET_ACCOUNT_INFO,
        payload: account,
    } as const;
};

const getInfo = async (request: Request<MessageTypes.GetInfo>, isTestnet: boolean) => {
    const api = await request.connect();

    const {
        value: { blockhash: blockHash, lastValidBlockHeight: blockHeight },
    } = await api.rpc.getLatestBlockhash({ commitment: 'confirmed' }).send();

    const serverInfo = {
        testnet: isTestnet,
        blockHeight: Number(blockHeight),
        blockHash,
        shortcut: isTestnet ? 'dsol' : 'sol',
        network: isTestnet ? 'dsol' : 'sol',
        url: api.clusterUrl,
        name: 'Solana',
        version: '1', // saving request api.rpc.getVersion().send(), version is not used anyways
        decimals: SOLANA_DECIMALS,
    };

    return {
        type: RESPONSES.GET_INFO,
        payload: { ...serverInfo },
    } as const;
};

const estimateFee = async (request: Request<MessageTypes.EstimateFee>) => {
    const api = await request.connect();
    const { getFees } = await solana();

    const { data: messageHex, newAccountProgramName } = request.payload.specific ?? {};

    if (messageHex == null) {
        throw new Error('Could not estimate fee for transaction.');
    }

    const { baseFee, priorityFee, accountCreationFee, decompiledTransactionMessage } =
        await getFees(messageHex, newAccountProgramName, api);

    const payload = [
        {
            feePerTx: new BigNumber(baseFee.toString())
                .plus(priorityFee.fee)
                .plus(accountCreationFee.toString())
                .toString(10),
            feePerUnit: priorityFee.computeUnitPrice,
            feeLimit: priorityFee.computeUnitLimit,
            feePayer: decompiledTransactionMessage.feePayer.address,
        },
    ];

    return {
        type: RESPONSES.ESTIMATE_FEE,
        payload,
    } as const;
};

// Solana block validity is about 60 seconds (150*400ms), so we add a bit of margin
const BLOCK_SUBSCRIBE_INTERVAL_MS = 50000;
const subscribeBlock = async ({ state, connect, post }: Context) => {
    if (state.getSubscription('block')) return { subscribed: true };
    const api = await connect();

    const fetchBlock = async () => {
        // The Solana RPC backend is untrusted (user-selectable per network, incl. custom URLs).
        // Destructuring `value.blockhash`/`value.lastValidBlockHeight` throws on a malformed
        // response and the network call can reject at any time. Since fetchBlock is invoked
        // fire-and-forget (both directly below and via setInterval), an uncaught throw would
        // surface as an unhandledRejection that tears down the blockchain worker (remote DoS).
        try {
            const {
                value: { blockhash: blockHash, lastValidBlockHeight: blockHeight },
            } = await api.rpc.getLatestBlockhash({ commitment: 'confirmed' }).send();
            if (blockHeight) {
                post({
                    id: -1,
                    type: RESPONSES.NOTIFICATION,
                    payload: {
                        type: 'block',
                        payload: {
                            blockHeight: Number(blockHeight),
                            blockHash,
                        },
                    },
                });
            }
        } catch {
            // drop the malformed/failed block poll; the next interval tick will retry
        }
    };
    fetchBlock();

    // the solana RPC api has subscribe method, see here: https://www.quicknode.com/docs/solana/rootSubscribe
    // but solana block height is updated so often that it slows down the whole application and overloads the the api
    // so we instead use setInterval to check for new blocks every `BLOCK_SUBSCRIBE_INTERVAL_MS`
    const interval = setInterval(fetchBlock, BLOCK_SUBSCRIBE_INTERVAL_MS);
    // we save the interval in the state so we can clear it later
    state.addSubscription('block', interval);

    return { subscribed: true };
};

const unsubscribeBlock = ({ state }: Context) => {
    if (!state.getSubscription('block')) return;
    const interval = state.getSubscription('block') as IntervalId;
    clearInterval(interval);
    state.removeSubscription('block');
};

const extractTokenAccounts = (
    accounts: SubscriptionAccountInfo[],
    tokenMetadata: TokenDetailByMint,
): SubscriptionAccountInfo[] =>
    accounts.flatMap(
        account =>
            account.tokens?.flatMap(
                token =>
                    token.accounts
                        ?.filter(
                            tokenAccount =>
                                tokenAccount.balance !== '0' && tokenMetadata[token.contract],
                        )
                        .map(tokenAccount => ({ descriptor: tokenAccount.publicKey })) || [],
            ) || [],
    );

const findTokenAccountOwner = (
    accounts: SubscriptionAccountInfo[],
    accountDescriptor: string,
): SubscriptionAccountInfo | undefined =>
    accounts.find(account =>
        account.tokens?.find(token =>
            token.accounts?.find(tokenAccount => tokenAccount.publicKey === accountDescriptor),
        ),
    );

let NEXT_ACCOUNT_SUBSCRIPTION_ID = 0;
const ACCOUNT_SUBSCRIPTION_ABORT_CONTROLLERS = new Map<number, AbortController>();
function abortSubscription(id: number) {
    const abortController = ACCOUNT_SUBSCRIPTION_ABORT_CONTROLLERS.get(id);
    ACCOUNT_SUBSCRIPTION_ABORT_CONTROLLERS.delete(id);
    abortController?.abort();
}

const handleAccountNotification = async (
    context: Context,
    accountNotifications: AsyncIterable<SolanaRpcResponse<AccountInfoBase>>,
    account: SubscriptionAccountInfo,
) => {
    const { connect, state, post, getTokenMetadata } = context;
    const { address, isConnectionClosedError } = await solana();
    try {
        for await (const _ of accountNotifications) {
            const api = await connect();
            // get the last transaction signature for the account, since that what triggered this callback
            const [lastSignatureResponse] = await api.rpc
                .getSignaturesForAddress(address(account.descriptor), {
                    limit: 1,
                })
                .send();
            const lastSignature = lastSignatureResponse?.signature;
            if (!lastSignature) return;

            // get the last transaction
            const lastTx = await api.rpc
                .getTransaction(lastSignature, {
                    encoding: 'jsonParsed',
                    maxSupportedTransactionVersion: 0,
                    commitment: 'confirmed',
                })
                .send();

            if (!lastTx || !isValidTransaction(lastTx)) {
                return;
            }

            const tokenMetadata = await getTokenMetadata();
            const tx = solanaUtils.transformTransaction(
                lastTx,
                account.descriptor,
                [],
                tokenMetadata,
            );

            // For token accounts we need to emit an event with the owner account's descriptor
            // since we don't store token accounts in the user's accounts.
            const descriptor =
                findTokenAccountOwner(state.getAccounts(), account.descriptor)?.descriptor ||
                account.descriptor;

            post({
                id: -1,
                type: RESPONSES.NOTIFICATION,
                payload: {
                    type: 'notification',
                    payload: {
                        descriptor,
                        tx,
                    },
                },
            });
        }
    } catch (error) {
        if (isConnectionClosedError(error)) {
            // The WS was closed, we should unsubscribe
            if (account.subscriptionId) abortSubscription(account.subscriptionId);
            state.removeAccounts([account]);
            context.onNetworkDisconnect();
        }
    }
};

const subscribeAccounts = async (context: Context, accounts: SubscriptionAccountInfo[]) => {
    const { connect, state } = context;
    const api = await connect();
    const subscribedAccounts = state.getAccounts();
    const tokenMetadata = await context.getTokenMetadata();
    const tokenAccounts = extractTokenAccounts(accounts, tokenMetadata);
    // we have to subscribe to both system and token accounts
    const newAccounts = [...accounts, ...tokenAccounts].filter(
        account =>
            !subscribedAccounts.some(
                subscribedAccount => account.descriptor === subscribedAccount.descriptor,
            ),
    );

    const { address } = await solana();

    await Promise.all(
        newAccounts.map(async a => {
            const abortController = new AbortController();
            const accountNotifications = await api.rpcSubscriptions
                .accountNotifications(address(a.descriptor), { commitment: 'confirmed' })
                .subscribe({ abortSignal: abortController.signal });
            const subscriptionId = NEXT_ACCOUNT_SUBSCRIPTION_ID++;
            ACCOUNT_SUBSCRIPTION_ABORT_CONTROLLERS.set(subscriptionId, abortController);
            const account: SubscriptionAccountInfo = {
                ...a,
                subscriptionId,
            };
            state.addAccounts([account]);
            handleAccountNotification(context, accountNotifications, account);
        }),
    );

    return { subscribed: newAccounts.length > 0 };
};

const unsubscribeAccounts = (
    { state }: Context,
    accounts: SubscriptionAccountInfo[] | undefined = [],
) => {
    const subscribedAccounts = state.getAccounts();

    accounts.forEach(a => {
        if (a.subscriptionId != null) {
            abortSubscription(a.subscriptionId);
            state.removeAccounts([a]);
        }

        // unsubscribe token accounts as well
        a.tokens?.forEach(t => {
            t.accounts?.forEach(ta => {
                const tokenAccount = subscribedAccounts.find(sa => sa.descriptor === ta.publicKey);
                if (tokenAccount?.subscriptionId != null) {
                    abortSubscription(tokenAccount.subscriptionId);
                    state.removeAccounts([tokenAccount]);
                }
            });
        });
    });
};

const subscribe = async (request: Request<MessageTypes.Subscribe>) => {
    let response: { subscribed: boolean };
    switch (request.payload.type) {
        case 'block':
            response = await subscribeBlock(request);
            break;
        case 'accounts':
            response = await subscribeAccounts(request, request.payload.accounts);
            break;
        default:
            throw new CustomError('worker_unknown_request', `+${request.type}`);
    }

    return {
        type: RESPONSES.SUBSCRIBE,
        payload: response,
    } as const;
};

const unsubscribe = (request: Request<MessageTypes.Unsubscribe>) => {
    switch (request.payload.type) {
        case 'block':
            unsubscribeBlock(request);
            break;
        case 'accounts': {
            unsubscribeAccounts(request, request.payload.accounts);
            break;
        }
        default:
            throw new CustomError('worker_unknown_request', `+${request.type}`);
    }

    return {
        type: RESPONSES.UNSUBSCRIBE,
        payload: { subscribed: request.state.getAccounts().length > 0 },
    } as const;
};

const onRequest = (request: Request<MessageTypes.Message>, isTestnet: boolean) => {
    switch (request.type) {
        case MESSAGES.GET_ACCOUNT_INFO:
            return getAccountInfo(request);
        case MESSAGES.GET_INFO:
            return getInfo(request, isTestnet);
        case MESSAGES.PUSH_TRANSACTION:
            return pushTransaction(request);
        case MESSAGES.ESTIMATE_FEE:
            return estimateFee(request);
        case MESSAGES.SUBSCRIBE:
            return subscribe(request);
        case MESSAGES.UNSUBSCRIBE:
            return unsubscribe(request);
        default:
            throw new CustomError('worker_unknown_request', `+${request.type}`);
    }
};

class SolanaWorker extends BaseWorker<SolanaAPI> {
    protected isConnected(api: SolanaAPI | undefined): api is SolanaAPI {
        return !!api;
    }

    private lazyTokens = createLazy(() => solanaUtils.getTokenMetadata());
    private isTestnet = false;

    async tryConnect(url: string): Promise<SolanaAPI> {
        const { getApi } = await solana();
        const api = getApi(url, `Trezor Suite ${getSuiteVersion()}`);

        this.isTestnet = (await api.rpc.getGenesisHash().send()) !== SOLANA_MAINNET_GENESIS_HASH;

        this.post({ id: -1, type: RESPONSES.CONNECTED });

        return api;
    }

    async messageHandler(event: { data: MessageTypes.Message }) {
        try {
            // skip processed messages
            if (await super.messageHandler(event)) return true;

            const request: Request<MessageTypes.Message> = {
                ...event.data,
                connect: () => this.connect(),
                onNetworkDisconnect: () => {
                    if (this.api) {
                        // Broadcast that we are being disconnected
                        this.post({
                            id: -1,
                            type: RESPONSES.DISCONNECTED,
                            payload: true,
                        });
                    }
                    this.disconnect();
                },
                post: (data: Response) => this.post(data),
                state: this.state,
                getTokenMetadata: this.lazyTokens.getOrInit,
            };

            const response = await onRequest(request, this.isTestnet);
            this.post({ id: event.data.id, ...response });
        } catch (error) {
            this.errorResponse(event.data.id, error);
        }
    }

    disconnect(): void {
        if (!this.api) {
            return;
        }

        this.state.getAccounts().forEach(a => {
            if (a.subscriptionId != null) {
                abortSubscription(a.subscriptionId);
            }
        });

        if (this.state.getSubscription('block')) {
            const interval = this.state.getSubscription('block') as IntervalId;
            clearInterval(interval);
            this.state.removeSubscription('block');
        }

        this.api = undefined;
    }
}

// export worker factory used in src/index
export default function Solana() {
    return new SolanaWorker();
}

if (CONTEXT === 'worker') {
    // Initialize module if script is running in worker context
    const module = new SolanaWorker();
    onmessage = module.messageHandler.bind(module);
}

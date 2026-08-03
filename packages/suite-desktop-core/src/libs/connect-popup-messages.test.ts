// Capture IPC handlers registered by the module under test
const ipcHandlers: Record<string, (...args: any[]) => any> = {};

jest.mock('../typed-electron', () => ({
    ipcMain: {
        handle: (channel: string, handler: (...args: any[]) => any) => {
            ipcHandlers[channel] = handler;
        },
    },
}));

const validateIpcMessage = jest.fn();
jest.mock('@trezor/ipc-proxy', () => ({
    validateIpcMessage: (...args: any[]) => validateIpcMessage(...args),
}));

beforeAll(() => {
    // `addMessage` arms a 5-minute timeout per deferred; fake timers keep tests from
    // leaking real handles when a deferred never resolves (e.g. the spoofed-sender case).
    jest.useFakeTimers();
});

afterAll(() => {
    jest.useRealTimers();
});

beforeEach(() => {
    // `initConnectPopupResponseHandler` registers handlers only once (module-level
    // `initialized` guard), so handlers are intentionally kept across tests.
    validateIpcMessage.mockReset();
    (global as any).logger = { info: jest.fn(), error: jest.fn() };
});

import { addMessage, initConnectPopupResponseHandler } from './connect-popup-messages';

const ipcEvent = { senderFrame: {} };

const getHandler = (channel: string) => {
    initConnectPopupResponseHandler();
    const handler = ipcHandlers[channel];
    if (!handler) {
        throw new Error(`${channel} handler was not registered`);
    }

    return handler;
};

describe('connect-popup-messages connect-popup/response handler', () => {
    it('validates the sender of the IPC message', () => {
        const handler = getHandler('connect-popup/response');

        handler(ipcEvent, { id: 'abc', success: true });

        expect(validateIpcMessage).toHaveBeenCalledWith({ ipcEvent });
    });

    it('does not resolve the deferred when the sender validation throws (spoofed sender)', () => {
        // A pending response is registered by the trusted caller...
        const deferred = addMessage('spoof-target');
        let settled = false;
        deferred.promise.then(
            () => {
                settled = true;
            },
            () => {
                settled = true;
            },
        );

        // ...but a frame that fails sender validation must not be able to route a response into it.
        validateIpcMessage.mockImplementation(() => {
            throw new Error('Invalid sender');
        });

        const handler = getHandler('connect-popup/response');

        expect(() => handler(ipcEvent, { id: 'spoof-target', success: true, payload: {} })).toThrow(
            'Invalid sender',
        );

        return Promise.resolve().then(() => {
            expect(settled).toBe(false);
        });
    });

    it('resolves the deferred for a valid sender', async () => {
        const deferred = addMessage('valid-id');

        const handler = getHandler('connect-popup/response');

        const response = { id: 'valid-id', success: true, payload: { address: 'addr' } };
        handler(ipcEvent, response);

        await expect(deferred.promise).resolves.toEqual(response);
    });
});

describe('connect-popup-messages connect-popup/ready handler', () => {
    it('validates the sender of the IPC message', () => {
        const handler = getHandler('connect-popup/ready');

        handler(ipcEvent);

        expect(validateIpcMessage).toHaveBeenCalledWith({ ipcEvent });
    });
});

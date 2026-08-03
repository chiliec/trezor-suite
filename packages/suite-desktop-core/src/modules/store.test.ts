// Capture IPC handlers registered by the module under test
const ipcHandlers: Record<string, (...args: any[]) => any> = {};

jest.mock('../typed-electron', () => ({
    ipcMain: {
        on: (channel: string, handler: (...args: any[]) => any) => {
            ipcHandlers[channel] = handler;
        },
    },
}));

const validateIpcMessage = jest.fn();
jest.mock('@trezor/ipc-proxy', () => ({
    validateIpcMessage: (...args: any[]) => validateIpcMessage(...args),
}));

let clearSpy: jest.Mock;

beforeEach(() => {
    clearSpy = jest.fn();
    (global as any).logger = { info: jest.fn() };
    validateIpcMessage.mockReset();
    for (const key of Object.keys(ipcHandlers)) {
        delete ipcHandlers[key];
    }
});

import { init } from './store';

const register = () => {
    (init as (deps: any) => void)({ store: { clear: clearSpy } });
    const handler = ipcHandlers['store/clear'];
    if (!handler) {
        throw new Error('store/clear handler was not registered');
    }

    return handler;
};

describe('store/clear IPC handler', () => {
    it('validates the sender of the IPC message', () => {
        const handler = register();
        const ipcEvent = { senderFrame: {} };

        handler(ipcEvent);

        expect(validateIpcMessage).toHaveBeenCalledWith({ ipcEvent });
    });

    it('clears the store for a valid sender', () => {
        const handler = register();

        handler({ senderFrame: {} });

        expect(clearSpy).toHaveBeenCalledTimes(1);
    });

    it('does NOT clear the store when the sender validation throws (spoofed frame)', () => {
        validateIpcMessage.mockImplementation(() => {
            throw new Error('Invalid ipcEvent.senderFrame.url');
        });
        const handler = register();

        expect(() => handler({ senderFrame: {} })).toThrow();
        expect(clearSpy).not.toHaveBeenCalled();
    });
});

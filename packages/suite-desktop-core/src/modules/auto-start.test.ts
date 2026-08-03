// Capture IPC handlers registered by the module under test
const ipcHandlers: Record<string, (...args: any[]) => any> = {};

jest.mock('../typed-electron', () => ({
    ipcMain: {
        on: (channel: string, handler: (...args: any[]) => any) => {
            ipcHandlers[channel] = handler;
        },
        handle: (channel: string, handler: (...args: any[]) => any) => {
            ipcHandlers[channel] = handler;
        },
    },
}));

const validateIpcMessage = jest.fn();
jest.mock('@trezor/ipc-proxy', () => ({
    validateIpcMessage: (...args: any[]) => validateIpcMessage(...args),
}));

const setAutoStartEnabled = jest.fn();
jest.mock('../libs/auto-start', () => ({
    setAutoStartEnabled: (...args: any[]) => setAutoStartEnabled(...args),
    isAutoStartEnabled: jest.fn(() => false),
    linuxAutoStart: jest.fn(),
}));

beforeEach(() => {
    (global as any).logger = { debug: jest.fn() };
    validateIpcMessage.mockReset();
    setAutoStartEnabled.mockReset();
    for (const key of Object.keys(ipcHandlers)) {
        delete ipcHandlers[key];
    }
});

import { init } from './auto-start';

const register = () => {
    (init as () => void)();
    const handler = ipcHandlers['app/auto-start'];
    if (!handler) {
        throw new Error('app/auto-start handler was not registered');
    }

    return handler;
};

describe('app/auto-start IPC handler', () => {
    it('validates the sender of the IPC message', () => {
        const handler = register();
        const ipcEvent = { senderFrame: {} };

        handler(ipcEvent, true);

        expect(validateIpcMessage).toHaveBeenCalledWith({ ipcEvent });
    });

    it('toggles auto-start for a valid sender', () => {
        const handler = register();

        handler({ senderFrame: {} }, true);

        expect(setAutoStartEnabled).toHaveBeenCalledWith(true);
    });

    it('does NOT toggle auto-start when the sender validation throws (spoofed frame)', () => {
        validateIpcMessage.mockImplementation(() => {
            throw new Error('Invalid ipcEvent.senderFrame.url');
        });
        const handler = register();

        expect(() => handler({ senderFrame: {} }, true)).toThrow();
        expect(setAutoStartEnabled).not.toHaveBeenCalled();
    });
});

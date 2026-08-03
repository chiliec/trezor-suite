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

const nativeTheme = {
    themeSource: 'system',
    shouldUseDarkColors: false,
    on: jest.fn(),
};
jest.mock('electron', () => ({
    get nativeTheme() {
        return nativeTheme;
    },
}));

const validateIpcMessage = jest.fn();
jest.mock('@trezor/ipc-proxy', () => ({
    validateIpcMessage: (...args: any[]) => validateIpcMessage(...args),
}));

const setThemeSettings = jest.fn();
const storeMock = {
    getThemeSettings: jest.fn(() => 'system'),
    setThemeSettings,
};
jest.mock('../libs/store', () => ({
    Store: {
        getStore: () => storeMock,
    },
}));

beforeEach(() => {
    (global as any).logger = { info: jest.fn() };
    validateIpcMessage.mockReset();
    setThemeSettings.mockReset();
    nativeTheme.themeSource = 'system';
    for (const key of Object.keys(ipcHandlers)) {
        delete ipcHandlers[key];
    }
});

import { init } from './theme';

const register = () => {
    (init as (params: any) => void)({ mainWindowProxy: { getInstance: () => undefined } });
    const handler = ipcHandlers['theme/change'];
    if (!handler) {
        throw new Error('theme/change handler was not registered');
    }

    return handler;
};

describe('theme/change IPC handler', () => {
    it('validates the sender of the IPC message', () => {
        const handler = register();
        const ipcEvent = { senderFrame: {} };

        handler(ipcEvent, 'dark');

        expect(validateIpcMessage).toHaveBeenCalledWith({ ipcEvent });
    });

    it('applies and persists the theme for a valid sender', () => {
        const handler = register();

        handler({ senderFrame: {} }, 'dark');

        expect(nativeTheme.themeSource).toBe('dark');
        expect(setThemeSettings).toHaveBeenCalledWith('dark');
    });

    it('does NOT change the theme when the sender validation throws (spoofed frame)', () => {
        validateIpcMessage.mockImplementation(() => {
            throw new Error('Invalid ipcEvent.senderFrame.url');
        });
        const handler = register();

        expect(() => handler({ senderFrame: {} }, 'dark')).toThrow();
        expect(setThemeSettings).not.toHaveBeenCalled();
        expect(nativeTheme.themeSource).toBe('system');
    });
});

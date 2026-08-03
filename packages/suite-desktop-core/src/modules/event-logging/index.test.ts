// Capture IPC handlers registered by the module under test
const ipcHandlers: Record<string, (...args: any[]) => any> = {};

jest.mock('../../typed-electron', () => ({
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

let configSpy: jest.Mock;
let levelSpy: jest.Mock;

beforeEach(() => {
    configSpy = jest.fn();
    levelSpy = jest.fn();
    (global as any).logger = {
        set config(options: unknown) {
            configSpy(options);
        },
        set level(level: unknown) {
            levelSpy(level);
        },
    };
    validateIpcMessage.mockReset();
});

import { init } from './index';

const invoke = (payload: unknown) => {
    (init as () => void)();
    const handler = ipcHandlers['logger/config'];
    if (!handler) {
        throw new Error('logger/config handler was not registered');
    }
    const ipcEvent = { senderFrame: {} };
    handler(ipcEvent, payload);

    return ipcEvent;
};

describe('event-logging logger/config handler', () => {
    it('validates the sender of the IPC message', () => {
        const ipcEvent = invoke({ level: 'debug', options: { writeToDisk: true } });

        expect(validateIpcMessage).toHaveBeenCalledWith({ ipcEvent });
    });

    it('strips renderer-controlled outputPath and outputFile before applying config', () => {
        invoke({
            level: 'debug',
            options: {
                writeToDisk: true,
                outputPath: '/etc',
                outputFile: 'cron.d/evil',
            },
        });

        expect(configSpy).toHaveBeenCalledTimes(1);
        const applied = configSpy.mock.calls[0][0];
        expect(applied).not.toHaveProperty('outputPath');
        expect(applied).not.toHaveProperty('outputFile');
        expect(applied).toEqual({ writeToDisk: true });
    });

    it('forwards safe options untouched', () => {
        invoke({
            level: 'warn',
            options: { writeToDisk: true, writeToConsole: false, colors: false },
        });

        expect(levelSpy).toHaveBeenCalledWith('warn');
        expect(configSpy).toHaveBeenCalledWith({
            writeToDisk: true,
            writeToConsole: false,
            colors: false,
        });
    });

    it('passes through an undefined options payload', () => {
        invoke({ level: 'mute', options: undefined });

        expect(configSpy).toHaveBeenCalledWith(undefined);
    });
});

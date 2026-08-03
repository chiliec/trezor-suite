/**
 * Auto start handler
 */
import { validateIpcMessage } from '@trezor/ipc-proxy';

import { isAutoStartEnabled, linuxAutoStart, setAutoStartEnabled } from '../libs/auto-start';
import { ipcMain } from '../typed-electron';
import type { ModuleInit } from './module';

export const SERVICE_NAME = 'auto-start';

export const init: ModuleInit = () => {
    const { logger } = global;

    ipcMain.on('app/auto-start', (ipcEvent, enabled: boolean) => {
        // Reject messages that do not originate from our own renderer (defense-in-depth,
        // consistent with the sibling `app/auto-start/is-enabled` handler below). Without
        // this, any frame able to reach the main process could toggle OS auto-start and, on
        // Linux, cause an autostart `.desktop` file to be written/removed.
        validateIpcMessage({ ipcEvent });

        logger.debug(SERVICE_NAME, 'Auto start ' + (enabled ? 'enabled' : 'disabled'));
        setAutoStartEnabled(enabled);
    });

    ipcMain.handle('app/auto-start/is-enabled', ipcEvent => {
        validateIpcMessage({ ipcEvent });
        const result = isAutoStartEnabled();

        return { success: true, payload: result };
    });

    return {
        onLoad: () => {
            // Update autostart file on Linux, since the AppImage might have been moved
            if (process.platform === 'linux' && isAutoStartEnabled()) {
                linuxAutoStart(true);
            }
        },
    };
};

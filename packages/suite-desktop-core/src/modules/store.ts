import { validateIpcMessage } from '@trezor/ipc-proxy';

import { ipcMain } from '../typed-electron';
import type { ModuleInit } from './module';

export const SERVICE_NAME = 'store';

export const init: ModuleInit = ({ store }) => {
    const { logger } = global;

    ipcMain.on('store/clear', ipcEvent => {
        // Reject messages that do not originate from our own renderer (defense-in-depth,
        // consistent with the other IPC handlers). Without this, any frame able to reach
        // the main process could wipe the entire desktop store, forcing re-onboarding.
        validateIpcMessage({ ipcEvent });

        logger.info(SERVICE_NAME, `Clearing desktop store.`);
        store.clear();
    });
};

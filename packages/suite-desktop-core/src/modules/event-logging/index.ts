import { validateIpcMessage } from '@trezor/ipc-proxy';

import { ipcMain } from '../../typed-electron';
import type { ModuleInit } from '../module';

export const SERVICE_NAME = 'event-logging';

export const init: ModuleInit = () => {
    const { logger } = global;

    ipcMain.on('logger/config', (ipcEvent, { level, options }) => {
        // Reject messages that do not originate from our own renderer (defense-in-depth,
        // consistent with the other IPC handlers).
        validateIpcMessage({ ipcEvent });

        logger.level = level;

        if (options) {
            // The renderer must never control where log files are written on disk. `outputPath`
            // and `outputFile` flow into `fs.createWriteStream(path.join(outputPath, outputFile))`,
            // so a compromised renderer could otherwise create or overwrite arbitrary files outside
            // the app's data directory. These are only ever set from trusted CLI switches at
            // startup, so we strip them from the untrusted IPC payload.
            const safeOptions = { ...options };
            delete safeOptions.outputPath;
            delete safeOptions.outputFile;

            logger.config = safeOptions;
        } else {
            logger.config = options;
        }
    });
};

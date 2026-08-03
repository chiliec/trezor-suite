import { nativeTheme } from 'electron';

import { validateIpcMessage } from '@trezor/ipc-proxy';
import { type SuiteThemeVariant } from '@trezor/suite-desktop-api';

import { Store } from '../libs/store';
import { ipcMain } from '../typed-electron';
import type { ModuleInit } from './module';

const setThemeManually = (theme: SuiteThemeVariant, store: Store) => {
    const { logger } = global;

    logger.info('theme', `Manually setting app window UI to ${theme} theme.`);

    nativeTheme.themeSource = theme;
    store.setThemeSettings(theme);
};

export const SERVICE_NAME = 'theme';

export const init: ModuleInit = ({ mainWindowProxy }) => {
    const { logger } = global;

    const store = Store.getStore();

    const theme = store.getThemeSettings();
    if (theme !== 'system') {
        logger.info(SERVICE_NAME, `Setting app window UI theme to ${theme}.`);
        nativeTheme.themeSource = theme;
    }

    ipcMain.on('theme/change', (ipcEvent, newTheme) => {
        // Reject messages that do not originate from our own renderer (defense-in-depth,
        // consistent with the other IPC handlers). Without this, any frame able to reach
        // the main process could change and persist the app theme.
        validateIpcMessage({ ipcEvent });

        setThemeManually(newTheme, store);
    });

    nativeTheme.on('updated', () => {
        if (store.getThemeSettings() !== 'system') return;

        const newTheme = nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
        logger.info(SERVICE_NAME, `OS theme changed to ${newTheme}.`);
        mainWindowProxy.getInstance()?.webContents.send('theme/system-change', newTheme);
    });
};

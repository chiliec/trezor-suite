import type { ReactElement } from 'react';

export type ReceiveQRCodeMenuProps = {
    children: ReactElement;
    onShareQRCode: () => Promise<void>;
    onSaveQRCode: () => Promise<void>;
    onCopyQRCode: () => Promise<void>;
    onCopyAddress: () => Promise<void>;
};

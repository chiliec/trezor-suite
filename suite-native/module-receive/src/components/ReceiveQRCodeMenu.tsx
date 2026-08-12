// This is the Android implementation selected by Metro as the unsuffixed fallback.
import { ClipboardCopyMenu } from '@suite-native/clipboard';

import type { ReceiveQRCodeMenuProps } from './ReceiveQRCodeMenu.types';

export const ReceiveQRCodeMenu = ({ children, onCopyAddress }: ReceiveQRCodeMenuProps) => (
    <ClipboardCopyMenu onCopy={onCopyAddress}>{children}</ClipboardCopyMenu>
);

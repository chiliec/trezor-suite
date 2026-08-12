// This is the iOS implementation selected by Metro through the `.ios` filename suffix.
import { ClipboardCopyMenu } from '@suite-native/clipboard';
import { useTranslate } from '@suite-native/intl';

import type { ReceiveQRCodeMenuProps } from './ReceiveQRCodeMenu.types';

export const ReceiveQRCodeMenu = ({
    children,
    onShareQRCode,
    onSaveQRCode,
    onCopyQRCode,
    onCopyAddress,
}: ReceiveQRCodeMenuProps) => {
    const { translate } = useTranslate();

    return (
        <ClipboardCopyMenu
            menuActions={[
                {
                    label: translate('moduleReceive.addressActions.shareQRCodeImage'),
                    systemImage: 'square.and.arrow.up',
                    onPress: onShareQRCode,
                },
                {
                    label: translate('moduleReceive.addressActions.saveQRCodeImage'),
                    systemImage: 'square.and.arrow.down',
                    onPress: onSaveQRCode,
                },
                {
                    label: translate('generic.buttons.copy'),
                    systemImage: 'qrcode',
                    onPress: onCopyQRCode,
                },
                {
                    label: translate('moduleReceive.addressActions.copyAddress'),
                    systemImage: 'doc.on.doc',
                    onPress: onCopyAddress,
                },
            ]}
        >
            {children}
        </ClipboardCopyMenu>
    );
};

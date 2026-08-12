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
                    onPress: onShareQRCode,
                },
                {
                    label: translate('moduleReceive.addressActions.saveQRCodeImage'),
                    onPress: onSaveQRCode,
                },
                {
                    label: translate('generic.buttons.copy'),
                    onPress: onCopyQRCode,
                },
                {
                    label: translate('moduleReceive.addressActions.copyAddress'),
                    onPress: onCopyAddress,
                },
            ]}
        >
            {children}
        </ClipboardCopyMenu>
    );
};

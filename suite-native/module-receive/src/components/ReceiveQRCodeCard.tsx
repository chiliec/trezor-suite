// This is the Android implementation selected by Metro as the unsuffixed fallback.
import { Box, Card } from '@suite-native/atoms';
import { ClipboardCopyMenu } from '@suite-native/clipboard';
import { useNativeStyles } from '@trezor/styles-native';

import { receiveQRCodeCardStyle, receiveQRCodeContainerStyle } from './ReceiveQRCodeCard.styles';
import type { ReceiveQRCodeCardProps } from './ReceiveQRCodeCard.types';
import { ReceiveQRCodeContent } from './ReceiveQRCodeContent';

export const ReceiveQRCodeCard = ({
    onCopyAddress,
    ...qrCodeContentProps
}: ReceiveQRCodeCardProps) => {
    const {
        applyStyle,
        utils: { spacings },
    } = useNativeStyles();
    const qrCodeHorizontalPadding = spacings.sp16 * 2;
    const qrCodeVerticalPadding = spacings.sp16 * 2;

    return (
        <ClipboardCopyMenu onCopy={onCopyAddress}>
            <Card noPadding noShadow style={applyStyle(receiveQRCodeCardStyle)}>
                <Box
                    style={applyStyle(receiveQRCodeContainerStyle, {
                        qrCodeSize: qrCodeContentProps.qrCodeSize,
                        paddingHorizontal: qrCodeHorizontalPadding,
                        paddingVertical: qrCodeVerticalPadding,
                    })}
                >
                    <ReceiveQRCodeContent {...qrCodeContentProps} />
                </Box>
            </Card>
        </ClipboardCopyMenu>
    );
};

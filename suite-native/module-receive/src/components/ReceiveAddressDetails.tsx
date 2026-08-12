import { useWindowDimensions } from 'react-native';
import ViewShot from 'react-native-view-shot';

import type { NetworkSymbol } from '@suite-common/wallet-config';
import { type AccountDescriptor, type TokenAddress } from '@suite-common/wallet-types';
import { AddressLabelEditable } from '@suite-native/address';
import { Box, Card, VStack } from '@suite-native/atoms';
import { ClipboardCopyMenu, useCopyToClipboard } from '@suite-native/clipboard';
import { AddressFormatter } from '@suite-native/formatters';
import { TokenIcon } from '@suite-native/icons';
import { useTranslate } from '@suite-native/intl';
import { QRCode } from '@suite-native/qr-code';
import type { StaticSessionId } from '@trezor/connect';
import { prepareNativeStyle, useNativeStyles } from '@trezor/styles-native';

import { ReceiveQRCodeMenu } from './ReceiveQRCodeMenu';
import { useReceiveQRCodeActions } from '../hooks/useReceiveQRCodeActions';

type ReceiveAddressDetailsProps = {
    address: string;
    deviceStaticSessionId: StaticSessionId;
    accountDescriptor: AccountDescriptor;
    networkSymbol: NetworkSymbol;
    tokenContract?: TokenAddress;
    showLabelEdit?: boolean;
};

const addressContainer = prepareNativeStyle(() => ({
    justifyContent: 'center',
    alignItems: 'center',
}));

const cardStyle = prepareNativeStyle(() => ({
    overflow: 'hidden',
}));

const qrCodeCaptureStyle = prepareNativeStyle<{
    qrCodeSize: number;
    paddingHorizontal: number;
    paddingVertical: number;
}>((utils, { qrCodeSize, paddingHorizontal, paddingVertical }) => ({
    width: qrCodeSize + paddingHorizontal,
    height: qrCodeSize + paddingVertical,
    backgroundColor: utils.colors.surfaceFillRaised,
}));

const MAX_RECEIVE_QR_CODE_SIZE = 310;

export const ReceiveAddressDetails = ({
    address,
    deviceStaticSessionId,
    accountDescriptor,
    networkSymbol,
    tokenContract,
    showLabelEdit = true,
}: ReceiveAddressDetailsProps) => {
    const copyToClipboard = useCopyToClipboard();
    const {
        applyStyle,
        utils: { spacings },
    } = useNativeStyles();
    const { width: windowWidth } = useWindowDimensions();
    const { translate } = useTranslate();
    const { qrCodeViewRef, handleCopyQRCode, handleSaveQRCode, handleShareQRCode } =
        useReceiveQRCodeActions();

    const screenHorizontalPadding = spacings.sp16 * 2;
    const cardHorizontalMargin = spacings.sp8 * 2;
    const qrCodeHorizontalPadding = spacings.sp16 * 2;
    const qrCodeVerticalPadding = spacings.sp16 * 2;
    const horizontalOffset =
        screenHorizontalPadding + cardHorizontalMargin + qrCodeHorizontalPadding;
    const qrCodeSize = Math.min(MAX_RECEIVE_QR_CODE_SIZE, windowWidth - horizontalOffset);

    const handleCopyAddress = async () => {
        await copyToClipboard(address, translate('qrCode.addressCopied'));
    };

    return (
        <VStack spacing="sp24" flex={1}>
            <Box marginHorizontal="sp8" marginTop="sp8">
                <ReceiveQRCodeMenu
                    onShareQRCode={handleShareQRCode}
                    onSaveQRCode={handleSaveQRCode}
                    onCopyQRCode={handleCopyQRCode}
                    onCopyAddress={handleCopyAddress}
                >
                    <Card noPadding noShadow style={applyStyle(cardStyle)}>
                        <ViewShot
                            ref={qrCodeViewRef}
                            options={{ fileName: 'trezor-receive-address-qr', format: 'png' }}
                            style={applyStyle(qrCodeCaptureStyle, {
                                qrCodeSize,
                                paddingHorizontal: qrCodeHorizontalPadding,
                                paddingVertical: qrCodeVerticalPadding,
                            })}
                        >
                            <QRCode
                                data={address}
                                qrCodeSize={qrCodeSize}
                                paddingHorizontal="sp16"
                                paddingVertical="sp16"
                                centerIcon={
                                    <TokenIcon
                                        symbol={networkSymbol}
                                        contractAddress={tokenContract}
                                        showNetworkIcon={tokenContract !== undefined}
                                        size="large"
                                    />
                                }
                            />
                        </ViewShot>
                    </Card>
                </ReceiveQRCodeMenu>
            </Box>
            <VStack spacing="sp8" alignItems="center" justifyContent="center" flex={1}>
                {showLabelEdit && (
                    <AddressLabelEditable
                        accountDescriptor={accountDescriptor}
                        address={address}
                        deviceStaticSessionId={deviceStaticSessionId}
                        networkSymbol={networkSymbol}
                        testID="@receive/address-label"
                    />
                )}
                <ClipboardCopyMenu onCopy={handleCopyAddress} style={applyStyle(addressContainer)}>
                    <AddressFormatter
                        value={address}
                        format="long"
                        variant="headline-sm"
                        textAlign="center"
                        testID="@receive/confirmed-receive-address"
                    />
                </ClipboardCopyMenu>
            </VStack>
        </VStack>
    );
};

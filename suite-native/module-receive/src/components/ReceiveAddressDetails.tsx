import { useWindowDimensions } from 'react-native';

import type { NetworkSymbol } from '@suite-common/wallet-config';
import { type AccountDescriptor, type TokenAddress } from '@suite-common/wallet-types';
import { AddressLabelEditable } from '@suite-native/address';
import { Box, Card, VStack } from '@suite-native/atoms';
import { ClipboardCopyMenu } from '@suite-native/clipboard';
import { AddressFormatter } from '@suite-native/formatters';
import { TokenIcon } from '@suite-native/icons';
import { QRCode } from '@suite-native/qr-code';
import type { StaticSessionId } from '@trezor/connect';
import { prepareNativeStyle, useNativeStyles } from '@trezor/styles-native';

type ReceiveAddressDetailsProps = {
    address: string;
    deviceStaticSessionId: StaticSessionId;
    accountDescriptor: AccountDescriptor;
    networkSymbol: NetworkSymbol;
    tokenContract?: TokenAddress;
    showLabelEdit?: boolean;
    onCopyAddress: () => void;
};

const addressContainer = prepareNativeStyle(() => ({
    justifyContent: 'center',
    alignItems: 'center',
}));

const cardStyle = prepareNativeStyle(() => ({
    overflow: 'hidden',
}));

const MAX_RECEIVE_QR_CODE_SIZE = 310;

export const ReceiveAddressDetails = ({
    address,
    deviceStaticSessionId,
    accountDescriptor,
    networkSymbol,
    tokenContract,
    showLabelEdit = true,
    onCopyAddress,
}: ReceiveAddressDetailsProps) => {
    const {
        applyStyle,
        utils: { spacings },
    } = useNativeStyles();
    const { width: windowWidth } = useWindowDimensions();

    const screenHorizontalPadding = spacings.sp16 * 2;
    const cardHorizontalMargin = spacings.sp8 * 2;
    const qrCodeHorizontalPadding = spacings.sp16 * 2;
    const horizontalOffset =
        screenHorizontalPadding + cardHorizontalMargin + qrCodeHorizontalPadding;
    const qrCodeSize = Math.min(MAX_RECEIVE_QR_CODE_SIZE, windowWidth - horizontalOffset);

    return (
        <VStack spacing="sp24" flex={1}>
            <Box marginHorizontal="sp8" marginTop="sp8">
                <ClipboardCopyMenu onCopy={onCopyAddress}>
                    <Card noPadding noShadow style={applyStyle(cardStyle)}>
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
                    </Card>
                </ClipboardCopyMenu>
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
                <ClipboardCopyMenu onCopy={onCopyAddress} style={applyStyle(addressContainer)}>
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

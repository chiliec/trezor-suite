import { type ViewShotRef } from 'react-native-view-shot';
import { useSelector } from 'react-redux';

import { getNetwork } from '@suite-common/wallet-config';
import {
    type AccountsRootState,
    selectAccountDescriptor,
    selectAccountDeviceState,
    selectAccountNetworkSymbol,
} from '@suite-common/wallet-core';
import { type AccountKey, type TokenAddress } from '@suite-common/wallet-types';
import { Box, InlineAlertBox, type InlineAlertBoxProps, VStack } from '@suite-native/atoms';
import { Translation } from '@suite-native/intl';

import { ReceiveAddressDetails } from './ReceiveAddressDetails';

type ReceiveAddressCardProps = {
    accountKey: AccountKey;
    address: string;
    tokenContract?: TokenAddress;
    onCopyAddress: () => void;
    onCopyQRCode: (qrCodeView: ViewShotRef | null) => void;
    onSaveQRCode: (qrCodeView: ViewShotRef | null) => void;
    onShareQRCode: (qrCodeView: ViewShotRef | null) => void;
};

export const ReceiveAddressCard = ({
    accountKey,
    address,
    tokenContract,
    onCopyAddress,
    onCopyQRCode,
    onSaveQRCode,
    onShareQRCode,
}: ReceiveAddressCardProps) => {
    const accountDescriptor = useSelector((state: AccountsRootState) =>
        selectAccountDescriptor(state, accountKey),
    );
    const deviceStaticSessionId = useSelector((state: AccountsRootState) =>
        selectAccountDeviceState(state, accountKey),
    );
    const symbol = useSelector((state: AccountsRootState) =>
        selectAccountNetworkSymbol(state, accountKey),
    );

    if (!accountDescriptor || !deviceStaticSessionId || !symbol) {
        return null;
    }

    const { name: networkName } = getNetwork(symbol);
    const isTokenAddress = tokenContract !== undefined;

    const getCardAlertProps = (): InlineAlertBoxProps | undefined => {
        if (symbol === 'ada') {
            return {
                title: (
                    <Translation id="moduleReceive.receiveAddressCard.alert.longCardanoAddress" />
                ),
                intent: 'info',
            };
        }
        if (isTokenAddress) {
            return {
                title: (
                    <Translation
                        id="moduleReceive.receiveAddressCard.alert.token"
                        values={{ networkName }}
                    />
                ),
                intent: 'info',
            };
        }

        return undefined;
    };

    const cardAlertProps = getCardAlertProps();

    return (
        <VStack spacing="sp16" flex={1}>
            <ReceiveAddressDetails
                accountDescriptor={accountDescriptor}
                address={address}
                deviceStaticSessionId={deviceStaticSessionId}
                networkSymbol={symbol}
                tokenContract={tokenContract}
                showLabelEdit={!isTokenAddress}
                onCopyAddress={onCopyAddress}
                onCopyQRCode={onCopyQRCode}
                onSaveQRCode={onSaveQRCode}
                onShareQRCode={onShareQRCode}
            />
            {cardAlertProps && (
                <Box marginBottom="sp4">
                    <InlineAlertBox {...cardAlertProps} />
                </Box>
            )}
        </VStack>
    );
};

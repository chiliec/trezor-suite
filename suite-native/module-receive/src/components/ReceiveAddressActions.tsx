import { Alert, Share } from 'react-native';

import { useServices } from '@suite-common/dependency-injection';
import { events, selectNativeAnalyticsDep } from '@suite-native/analytics';
import { Button, HStack, VStack, useBottomSheetModal } from '@suite-native/atoms';
import { Translation } from '@suite-native/intl';
import { ReceiveAddressVerificationSource } from '@suite-native/navigation';

import { ReceiveAddressVerificationBottomSheet } from './ReceiveAddressVerificationBottomSheet';

type ReceiveAddressActionsProps = {
    address: string;
    onCopyAddress: () => void;
    onVerifyAddress: (source: ReceiveAddressVerificationSource) => void;
};

export const ReceiveAddressActions = ({
    address,
    onCopyAddress,
    onVerifyAddress,
}: ReceiveAddressActionsProps) => {
    const { analytics } = useServices(selectNativeAnalyticsDep);
    const {
        bottomSheetRef: sharedAddressBottomSheetRef,
        openModal: openSharedAddressBottomSheet,
        closeModal: closeSharedAddressBottomSheet,
    } = useBottomSheetModal();

    const handleVerifySharedAddress = () => {
        closeSharedAddressBottomSheet();
        onVerifyAddress(ReceiveAddressVerificationSource.Shared);
    };

    const handleShareData = async () => {
        try {
            const { action } = await Share.share({
                message: address,
            });

            if (action === Share.dismissedAction) {
                return;
            }

            analytics.report({ type: events.receiveShareAddressEvent.name });
            openSharedAddressBottomSheet();
        } catch (error) {
            Alert.alert('Something went wrong.', error.message);
        }
    };

    return (
        <>
            <VStack spacing="sp8">
                <Button iconLeft="copy" onPress={onCopyAddress} isFullWidth>
                    <Translation id="qrCode.copyButton" />
                </Button>
                <HStack spacing="sp8">
                    <Button
                        iconLeft="shareNetwork"
                        intent="neutral"
                        priority="secondary"
                        onPress={handleShareData}
                        flex={1}
                    >
                        <Translation id="qrCode.shareButton" />
                    </Button>
                    <Button
                        iconLeft="trezorDevices"
                        intent="neutral"
                        priority="secondary"
                        onPress={() => onVerifyAddress(ReceiveAddressVerificationSource.Verified)}
                        flex={1}
                    >
                        <Translation id="moduleReceive.addressActions.verify" />
                    </Button>
                </HStack>
            </VStack>
            <ReceiveAddressVerificationBottomSheet
                ref={sharedAddressBottomSheetRef}
                source={ReceiveAddressVerificationSource.Shared}
                onVerifyAddress={handleVerifySharedAddress}
                onSkipVerification={closeSharedAddressBottomSheet}
            />
        </>
    );
};

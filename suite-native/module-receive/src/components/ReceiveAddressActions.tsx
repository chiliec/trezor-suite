import { useCallback } from 'react';

import { useNavigation } from '@react-navigation/native';

import { useServices } from '@suite-common/dependency-injection';
import { type AccountKey } from '@suite-common/wallet-types';
import { events, selectNativeAnalyticsDep } from '@suite-native/analytics';
import { Button, HStack, VStack } from '@suite-native/atoms';
import { Translation } from '@suite-native/intl';
import {
    ReceiveAddressVerificationSource,
    type ReceiveStackParamList,
    ReceiveStackRoutes,
    type StackNavigationProps,
} from '@suite-native/navigation';

import { ReceiveAddressVerificationBottomSheet } from './ReceiveAddressVerificationBottomSheet';
import { useReceiveAddressCopy } from '../hooks/useReceiveAddressCopy';
import { useReceiveAddressSharing } from '../hooks/useReceiveAddressSharing';

type ReceiveAddressActionsProps = {
    accountKey: AccountKey;
    address: string;
    addressPath: string;
};

type NavigationProp = StackNavigationProps<ReceiveStackParamList, ReceiveStackRoutes>;

export const ReceiveAddressActions = ({
    accountKey,
    address,
    addressPath,
}: ReceiveAddressActionsProps) => {
    const { analytics } = useServices(selectNativeAnalyticsDep);
    const navigation = useNavigation<NavigationProp>();

    const handleVerifyAddress = useCallback(
        (source: ReceiveAddressVerificationSource) => {
            analytics.report({ type: events.receiveStartVerificationEvent.name });
            navigation.navigate(ReceiveStackRoutes.ReceiveAddressVerification, {
                accountKey,
                addressPath,
                source,
            });
        },
        [accountKey, addressPath, analytics, navigation],
    );
    const {
        copiedAddressBottomSheetRef,
        closeCopiedAddressBottomSheet,
        handleCopyAddress,
        handleVerifyCopiedAddress,
    } = useReceiveAddressCopy({ address, onVerifyAddress: handleVerifyAddress });
    const {
        sharedAddressBottomSheetRef,
        closeSharedAddressBottomSheet,
        handleShareAddress,
        handleVerifySharedAddress,
    } = useReceiveAddressSharing({ address, onVerifyAddress: handleVerifyAddress });

    return (
        <>
            <VStack spacing="sp8">
                <Button iconLeft="copy" onPress={handleCopyAddress} isFullWidth>
                    <Translation id="qrCode.copyButton" />
                </Button>
                <HStack spacing="sp8">
                    <Button
                        iconLeft="shareNetwork"
                        intent="neutral"
                        priority="secondary"
                        onPress={handleShareAddress}
                        flex={1}
                    >
                        <Translation id="qrCode.shareButton" />
                    </Button>
                    <Button
                        iconLeft="trezorDevices"
                        intent="neutral"
                        priority="secondary"
                        onPress={() =>
                            handleVerifyAddress(ReceiveAddressVerificationSource.Verified)
                        }
                        flex={1}
                    >
                        <Translation id="moduleReceive.addressActions.verify" />
                    </Button>
                </HStack>
            </VStack>
            <ReceiveAddressVerificationBottomSheet
                ref={copiedAddressBottomSheetRef}
                source={ReceiveAddressVerificationSource.Pasted}
                onVerifyAddress={handleVerifyCopiedAddress}
                onSkipVerification={closeCopiedAddressBottomSheet}
            />
            <ReceiveAddressVerificationBottomSheet
                ref={sharedAddressBottomSheetRef}
                source={ReceiveAddressVerificationSource.Shared}
                onVerifyAddress={handleVerifySharedAddress}
                onSkipVerification={closeSharedAddressBottomSheet}
            />
        </>
    );
};

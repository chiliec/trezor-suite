import { useCallback } from 'react';
import { useSelector } from 'react-redux';

import { type RouteProp, useNavigation, useRoute } from '@react-navigation/native';

import { useServices } from '@suite-common/dependency-injection';
import { parseAccountKey } from '@suite-common/wallet-utils';
import { events, selectNativeAnalyticsDep } from '@suite-native/analytics';
import { ErrorMessage, ScreenFooterGradient, VStack } from '@suite-native/atoms';
import { selectHasFirmwareAuthenticityCheckHardFailedForSelectedDevice } from '@suite-native/device';
import { Translation } from '@suite-native/intl';
import {
    ReceiveAddressVerificationSource,
    type ReceiveStackParamList,
    ReceiveStackRoutes,
    Screen,
    ScreenHeader,
    type StackNavigationProps,
} from '@suite-native/navigation';

import { ReceiveBlockedDeviceCompromisedScreen } from './ReceiveBlockedDeviceCompromisedScreen';
import { ReceiveAddressActions } from '../components/ReceiveAddressActions';
import { ReceiveAddressDetailHeader } from '../components/ReceiveAddressDetailHeader';
import { ReceiveAddressDetails } from '../components/ReceiveAddressDetails';
import { ReceiveAddressReuseWarning } from '../components/ReceiveAddressReuseWarning';
import { ReceiveAddressVerificationBottomSheet } from '../components/ReceiveAddressVerificationBottomSheet';
import { useReceiveAddressCopy } from '../hooks/useReceiveAddressCopy';
import { type ReceiveAddressRootState, selectReceiveAccountAddressByPath } from '../selectors';

type NavigationProp = StackNavigationProps<ReceiveStackParamList, ReceiveStackRoutes>;

export const ReceiveAddressDetailScreen = () => {
    const {
        params: { accountKey, addressPath },
    } = useRoute<RouteProp<ReceiveStackParamList, ReceiveStackRoutes.ReceiveAddressDetail>>();
    const { accountDescriptor, networkSymbol, deviceStaticSessionId } = parseAccountKey(accountKey);

    const address = useSelector((state: ReceiveAddressRootState) =>
        selectReceiveAccountAddressByPath(state, accountKey, addressPath),
    );
    const hasFirmwareAuthenticityCheckHardFailed = useSelector(
        selectHasFirmwareAuthenticityCheckHardFailedForSelectedDevice,
    );
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
    } = useReceiveAddressCopy({
        address: address?.address ?? '',
        onVerifyAddress: handleVerifyAddress,
    });

    if (hasFirmwareAuthenticityCheckHardFailed) {
        return <ReceiveBlockedDeviceCompromisedScreen />;
    }

    if (!address) {
        return (
            <Screen
                header={
                    <ScreenHeader
                        closeActionType="back"
                        title={<Translation id="moduleReceive.addressDetail.title" />}
                    />
                }
            >
                <ErrorMessage errorMessage={<Translation id="generic.unknownError" />} />
            </Screen>
        );
    }

    const isUsed = address.transfers > 0;

    return (
        <>
            <Screen
                header={<ReceiveAddressDetailHeader address={address} symbol={networkSymbol} />}
                footer={
                    <>
                        <ScreenFooterGradient />
                        <VStack paddingHorizontal="sp16" paddingTop="sp8" paddingBottom="sp16">
                            <ReceiveAddressActions
                                address={address.address}
                                onCopyAddress={handleCopyAddress}
                                onVerifyAddress={handleVerifyAddress}
                            />
                        </VStack>
                    </>
                }
                noBottomPadding
            >
                <VStack marginTop="sp8" spacing="sp16" flex={1}>
                    <ReceiveAddressDetails
                        accountDescriptor={accountDescriptor}
                        address={address.address}
                        deviceStaticSessionId={deviceStaticSessionId}
                        networkSymbol={networkSymbol}
                        onCopyAddress={handleCopyAddress}
                    />
                    {isUsed && <ReceiveAddressReuseWarning />}
                </VStack>
            </Screen>
            <ReceiveAddressVerificationBottomSheet
                ref={copiedAddressBottomSheetRef}
                source={ReceiveAddressVerificationSource.Pasted}
                onVerifyAddress={handleVerifyCopiedAddress}
                onSkipVerification={closeCopiedAddressBottomSheet}
            />
        </>
    );
};

import { useCallback, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { useFocusEffect, useNavigation } from '@react-navigation/native';

import { useServices } from '@suite-common/dependency-injection';
import { selectCurrentFreshAddress } from '@suite-common/receive';
import { type AccountKey, type TokenAddress } from '@suite-common/wallet-types';
import { events, selectNativeAnalyticsDep } from '@suite-native/analytics';
import { ErrorMessage, ScreenFooterGradient, VStack } from '@suite-native/atoms';
import { selectHasFirmwareAuthenticityCheckHardFailedForSelectedDevice } from '@suite-native/device';
import { Translation } from '@suite-native/intl';
import {
    type CloseActionType,
    ReceiveAddressVerificationSource,
    type ReceiveStackParamList,
    ReceiveStackRoutes,
    Screen,
    type StackNavigationProps,
} from '@suite-native/navigation';

import { ReceiveAddressActions } from './ReceiveAddressActions';
import { ReceiveAddressCard } from './ReceiveAddressCard';
import { ReceiveAddressLoader } from './ReceiveAddressLoader';
import { ReceiveAddressVerificationBottomSheet } from './ReceiveAddressVerificationBottomSheet';
import { ReceiveDestinationTagInfo } from './ReceiveDestinationTagInfo';
import { ReceiveFreshAddressHeader } from './ReceiveFreshAddressHeader';
import { useReceiveAddressCopy } from '../hooks/useReceiveAddressCopy';
import { setCurrentFreshAddressForFlowEntryThunk } from '../receiveThunks';
import { ReceiveBlockedDeviceCompromisedScreen } from '../screens/ReceiveBlockedDeviceCompromisedScreen';
import { type ReceiveAddressListRootState } from '../selectors';

type ReceiveAddressContentProps = {
    accountKey: AccountKey;
    tokenContract?: TokenAddress;
    closeActionType: CloseActionType;
};

type NavigationProp = StackNavigationProps<ReceiveStackParamList, ReceiveStackRoutes>;

export const ReceiveAddressContent = ({
    accountKey,
    tokenContract,
    closeActionType,
}: ReceiveAddressContentProps) => {
    const dispatch = useDispatch();
    const { analytics } = useServices(selectNativeAnalyticsDep);
    const navigation = useNavigation<NavigationProp>();
    const [initializedAccountKey, setInitializedAccountKey] = useState<AccountKey | null>(null);

    const currentFreshAddress = useSelector((state: ReceiveAddressListRootState) =>
        selectCurrentFreshAddress(state, accountKey),
    );

    useFocusEffect(
        useCallback(() => {
            if (initializedAccountKey === accountKey) {
                return;
            }

            dispatch(setCurrentFreshAddressForFlowEntryThunk({ accountKey }));
            setInitializedAccountKey(accountKey);
        }, [accountKey, dispatch, initializedAccountKey]),
    );

    const handleVerifyAddress = useCallback(
        (source: ReceiveAddressVerificationSource) => {
            if (!currentFreshAddress) {
                return;
            }

            analytics.report({ type: events.receiveStartVerificationEvent.name });
            navigation.navigate(ReceiveStackRoutes.ReceiveAddressVerification, {
                accountKey,
                addressPath: currentFreshAddress.path,
                source,
            });
        },
        [accountKey, analytics, currentFreshAddress, navigation],
    );
    const {
        copiedAddressBottomSheetRef,
        closeCopiedAddressBottomSheet,
        handleCopyAddress,
        handleVerifyCopiedAddress,
    } = useReceiveAddressCopy({
        address: currentFreshAddress?.address ?? '',
        onVerifyAddress: handleVerifyAddress,
    });

    const hasFirmwareAuthenticityCheckHardFailed = useSelector(
        selectHasFirmwareAuthenticityCheckHardFailedForSelectedDevice,
    );
    const hasInitializedCurrentFreshAddress = initializedAccountKey === accountKey;

    if (hasFirmwareAuthenticityCheckHardFailed) {
        return <ReceiveBlockedDeviceCompromisedScreen />;
    }

    if (!hasInitializedCurrentFreshAddress) {
        return (
            <ReceiveAddressLoader tokenContract={tokenContract} closeActionType={closeActionType} />
        );
    }

    if (!currentFreshAddress) {
        return <ErrorMessage errorMessage={<Translation id="generic.unknownError" />} />;
    }

    return (
        <>
            <Screen
                header={
                    <ReceiveFreshAddressHeader
                        accountKey={accountKey}
                        tokenContract={tokenContract}
                        closeActionType={closeActionType}
                    />
                }
                footer={
                    <>
                        <ScreenFooterGradient />
                        <VStack paddingHorizontal="sp16" paddingTop="sp8" paddingBottom="sp16">
                            <ReceiveAddressActions
                                address={currentFreshAddress.address}
                                onCopyAddress={handleCopyAddress}
                                onVerifyAddress={handleVerifyAddress}
                            />
                        </VStack>
                    </>
                }
                noBottomPadding
            >
                <VStack marginTop="sp8" spacing="sp16" flex={1}>
                    <ReceiveAddressCard
                        accountKey={accountKey}
                        address={currentFreshAddress.address}
                        tokenContract={tokenContract}
                        onCopyAddress={handleCopyAddress}
                    />
                    <ReceiveDestinationTagInfo
                        accountKey={accountKey}
                        tokenContract={tokenContract}
                    />
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

import { useCallback } from 'react';
import { Alert, Share } from 'react-native';

import { useServices } from '@suite-common/dependency-injection';
import { events, selectNativeAnalyticsDep } from '@suite-native/analytics';
import { useBottomSheetModal } from '@suite-native/atoms';
import { useTranslate } from '@suite-native/intl';
import { ReceiveAddressVerificationSource } from '@suite-native/navigation';

type UseReceiveAddressSharingParams = {
    address: string;
    onVerifyAddress: (source: ReceiveAddressVerificationSource) => void;
};

export const useReceiveAddressSharing = ({
    address,
    onVerifyAddress,
}: UseReceiveAddressSharingParams) => {
    const { analytics } = useServices(selectNativeAnalyticsDep);
    const {
        bottomSheetRef: sharedAddressBottomSheetRef,
        openModal: openSharedAddressBottomSheet,
        closeModal: closeSharedAddressBottomSheet,
    } = useBottomSheetModal();
    const { translate } = useTranslate();

    const handleVerifySharedAddress = useCallback(() => {
        closeSharedAddressBottomSheet();
        onVerifyAddress(ReceiveAddressVerificationSource.Shared);
    }, [closeSharedAddressBottomSheet, onVerifyAddress]);

    const handleShareAddress = useCallback(async () => {
        try {
            const { action } = await Share.share({ message: address });

            if (action === Share.dismissedAction) {
                return;
            }

            analytics.report({ type: events.receiveShareAddressEvent.name });
            openSharedAddressBottomSheet();
        } catch {
            Alert.alert(translate('generic.unknownError'));
        }
    }, [address, analytics, openSharedAddressBottomSheet, translate]);

    return {
        sharedAddressBottomSheetRef,
        closeSharedAddressBottomSheet,
        handleShareAddress,
        handleVerifySharedAddress,
    };
};

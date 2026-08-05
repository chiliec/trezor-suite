import { useCallback } from 'react';
import { Alert, Share } from 'react-native';

import { EncodingType, File, Paths } from 'expo-file-system';

import { useBottomSheetModal } from '@suite-native/atoms';
import { useTranslate } from '@suite-native/intl';
import { ReceiveAddressVerificationSource } from '@suite-native/navigation';
import { type QRCodeImageRef } from '@suite-native/qr-code';

type UseReceiveAddressSharingParams = {
    address: string;
    onVerifyAddress: (source: ReceiveAddressVerificationSource) => void;
};

const SHARED_QR_CODE_FILE_NAME = 'trezor-receive-address-qr.png';

const getQRCodeImageBase64 = (qrCode: QRCodeImageRef): Promise<string> =>
    new Promise(resolve => {
        qrCode.toDataURL(resolve);
    });

const createQRCodeImageFile = (base64Image: string): File => {
    const file = new File(Paths.cache, SHARED_QR_CODE_FILE_NAME);

    file.create({ overwrite: true });
    file.write(base64Image, { encoding: EncodingType.Base64 });

    return file;
};

export const useReceiveAddressSharing = ({
    address,
    onVerifyAddress,
}: UseReceiveAddressSharingParams) => {
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

    const shareReceiveAddress = useCallback(
        async (content: Parameters<typeof Share.share>[0]) => {
            const { action } = await Share.share(content);

            if (action === Share.dismissedAction) {
                return;
            }

            openSharedAddressBottomSheet();
        },
        [openSharedAddressBottomSheet],
    );

    const handleShareAddress = useCallback(async () => {
        try {
            await shareReceiveAddress({ message: address });
        } catch {
            Alert.alert(translate('generic.unknownError'));
        }
    }, [address, shareReceiveAddress, translate]);

    const handleShareQRCode = useCallback(
        async (qrCode: QRCodeImageRef | null) => {
            if (qrCode === null) {
                Alert.alert(translate('generic.unknownError'));

                return;
            }

            try {
                const base64Image = await getQRCodeImageBase64(qrCode);
                const file = createQRCodeImageFile(base64Image);

                await shareReceiveAddress({
                    url: file.uri,
                    title: translate('moduleReceive.addressActions.shareQRCode'),
                });
            } catch {
                Alert.alert(translate('generic.unknownError'));
            }
        },
        [shareReceiveAddress, translate],
    );

    return {
        sharedAddressBottomSheetRef,
        closeSharedAddressBottomSheet,
        handleShareAddress,
        handleShareQRCode,
        handleVerifySharedAddress,
    };
};

import { useCallback } from 'react';
import { Alert, Share } from 'react-native';
import { type ViewShotRef, captureRef } from 'react-native-view-shot';

import * as Clipboard from 'expo-clipboard';

import { useBottomSheetModal } from '@suite-native/atoms';
import { useTranslate } from '@suite-native/intl';
import { ReceiveAddressVerificationSource } from '@suite-native/navigation';

type UseReceiveAddressSharingParams = {
    address: string;
    onVerifyAddress: (source: ReceiveAddressVerificationSource) => void;
};

const getShareableFileURI = (uri: string): string =>
    uri.startsWith('file://') ? uri : `file://${uri}`;

const captureQRCodeImageURI = (qrCodeView: ViewShotRef): Promise<string> =>
    captureRef(qrCodeView, {
        fileName: 'trezor-receive-address-qr',
        format: 'png',
        result: 'tmpfile',
    });

const captureQRCodeImageBase64 = (qrCodeView: ViewShotRef): Promise<string> =>
    captureRef(qrCodeView, {
        format: 'png',
        result: 'base64',
    });

const saveQRCodeImageToPhotos = async (qrCodeView: ViewShotRef): Promise<void> => {
    // The `legacy` entry point is used intentionally: `saveToLibraryAsync` only requires
    // add-only ("write") photo permission, while the current `Asset.create` API needs full
    // library access, which the app does not request.
    const MediaLibrary = await import('expo-media-library/legacy');
    const permission = await MediaLibrary.requestPermissionsAsync(true);

    if (!permission.granted) {
        return;
    }

    const qrCodeImageURI = await captureQRCodeImageURI(qrCodeView);

    await MediaLibrary.saveToLibraryAsync(getShareableFileURI(qrCodeImageURI));
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

    const handleShareAddress = useCallback(async () => {
        try {
            const { action } = await Share.share({ message: address });

            if (action === Share.dismissedAction) {
                return;
            }

            openSharedAddressBottomSheet();
        } catch {
            Alert.alert(translate('generic.unknownError'));
        }
    }, [address, openSharedAddressBottomSheet, translate]);

    const handleShareQRCode = useCallback(
        async (qrCodeView: ViewShotRef | null) => {
            if (qrCodeView === null) {
                Alert.alert(translate('generic.unknownError'));

                return;
            }

            try {
                const qrCodeImageURI = await captureQRCodeImageURI(qrCodeView);

                await Share.share({
                    url: getShareableFileURI(qrCodeImageURI),
                    title: translate('moduleReceive.addressActions.shareQRCodeImage'),
                });
            } catch {
                Alert.alert(translate('generic.unknownError'));
            }
        },
        [translate],
    );

    const handleCopyQRCode = useCallback(
        async (qrCodeView: ViewShotRef | null) => {
            if (qrCodeView === null) {
                Alert.alert(translate('generic.unknownError'));

                return;
            }

            try {
                const qrCodeImageBase64 = await captureQRCodeImageBase64(qrCodeView);
                await Clipboard.setImageAsync(qrCodeImageBase64);
            } catch {
                Alert.alert(translate('generic.unknownError'));
            }
        },
        [translate],
    );

    const handleSaveQRCode = useCallback(
        async (qrCodeView: ViewShotRef | null) => {
            if (qrCodeView === null) {
                Alert.alert(translate('generic.unknownError'));

                return;
            }

            try {
                await saveQRCodeImageToPhotos(qrCodeView);
            } catch {
                Alert.alert(translate('generic.unknownError'));
            }
        },
        [translate],
    );

    return {
        sharedAddressBottomSheetRef,
        closeSharedAddressBottomSheet,
        handleCopyQRCode,
        handleShareAddress,
        handleShareQRCode,
        handleSaveQRCode,
        handleVerifySharedAddress,
    };
};

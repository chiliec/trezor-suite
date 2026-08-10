import { useCallback, useRef } from 'react';
import { Alert, Platform, Share } from 'react-native';
import { type ViewShotRef, captureRef } from 'react-native-view-shot';

import * as Clipboard from 'expo-clipboard';

import { useServices } from '@suite-common/dependency-injection';
import { events, selectNativeAnalyticsDep } from '@suite-native/analytics';
import { useTranslate } from '@suite-native/intl';
import { useToast } from '@suite-native/toasts';

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

const saveQRCodeImageToPhotos = async (qrCodeView: ViewShotRef): Promise<boolean> => {
    if (Platform.OS !== 'ios') {
        return false;
    }

    // The `legacy` entry point is used intentionally: `saveToLibraryAsync` only requires
    // add-only ("write") photo permission, while the current `Asset.create` API needs full
    // library access, which the app does not request.
    const MediaLibrary = await import('expo-media-library/legacy');
    const permission = await MediaLibrary.requestPermissionsAsync(true);

    if (!permission.granted) {
        return false;
    }

    const qrCodeImageURI = await captureQRCodeImageURI(qrCodeView);

    await MediaLibrary.saveToLibraryAsync(getShareableFileURI(qrCodeImageURI));

    return true;
};

export const useReceiveQRCodeActions = () => {
    const qrCodeViewRef = useRef<ViewShotRef>(null);
    const { analytics } = useServices(selectNativeAnalyticsDep);
    const { translate } = useTranslate();
    const { showToast } = useToast();

    const handleShareQRCode = useCallback(async () => {
        if (qrCodeViewRef.current === null) {
            Alert.alert(translate('generic.unknownError'));

            return;
        }

        try {
            const qrCodeImageURI = await captureQRCodeImageURI(qrCodeViewRef.current);

            const { action } = await Share.share({
                url: getShareableFileURI(qrCodeImageURI),
                title: translate('moduleReceive.addressActions.shareQRCodeImage'),
            });

            if (action === Share.dismissedAction) {
                return;
            }

            analytics.report({
                type: events.receiveQRCodeActionEvent.name,
                payload: { action: 'share' },
            });
        } catch {
            Alert.alert(translate('generic.unknownError'));
        }
    }, [analytics, translate]);

    const handleCopyQRCode = useCallback(async () => {
        if (qrCodeViewRef.current === null) {
            Alert.alert(translate('generic.unknownError'));

            return;
        }

        try {
            const qrCodeImageBase64 = await captureQRCodeImageBase64(qrCodeViewRef.current);
            await Clipboard.setImageAsync(qrCodeImageBase64);
            analytics.report({
                type: events.receiveQRCodeActionEvent.name,
                payload: { action: 'copy' },
            });
            showToast({
                icon: 'check',
                intent: 'neutral',
                message: translate('moduleReceive.addressActions.qrCodeCopiedToClipboard'),
            });
        } catch {
            Alert.alert(translate('generic.unknownError'));
        }
    }, [analytics, showToast, translate]);

    const handleSaveQRCode = useCallback(async () => {
        if (qrCodeViewRef.current === null) {
            Alert.alert(translate('generic.unknownError'));

            return;
        }

        try {
            const hasSavedImage = await saveQRCodeImageToPhotos(qrCodeViewRef.current);

            if (hasSavedImage) {
                analytics.report({
                    type: events.receiveQRCodeActionEvent.name,
                    payload: { action: 'save' },
                });
                showToast({
                    icon: 'check',
                    intent: 'neutral',
                    message: translate('moduleReceive.addressActions.qrCodeSavedToPhotos'),
                });
            }
        } catch {
            Alert.alert(translate('generic.unknownError'));
        }
    }, [analytics, showToast, translate]);

    return {
        qrCodeViewRef,
        handleCopyQRCode,
        handleSaveQRCode,
        handleShareQRCode,
    };
};

import { prepareNativeStyle } from '@trezor/styles-native';

export const receiveQRCodeCardStyle = prepareNativeStyle(() => ({
    overflow: 'hidden',
}));

export const receiveQRCodeContainerStyle = prepareNativeStyle<{
    qrCodeSize: number;
    paddingHorizontal: number;
    paddingVertical: number;
}>((utils, { qrCodeSize, paddingHorizontal, paddingVertical }) => ({
    width: qrCodeSize + paddingHorizontal,
    height: qrCodeSize + paddingVertical,
    backgroundColor: utils.colors.surfaceFillRaised,
}));

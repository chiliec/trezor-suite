import { Alert, Share } from 'react-native';
import { type ViewShotRef } from 'react-native-view-shot';

import { ReceiveAddressVerificationSource } from '@suite-native/navigation';
import { act, renderHookWithBasicProvider, waitFor } from '@suite-native/test-utils';

import { useReceiveAddressSharing } from './useReceiveAddressSharing';

const mockOpenSharedAddressBottomSheet = jest.fn();
const mockCloseSharedAddressBottomSheet = jest.fn();
const mockVerifyAddress = jest.fn();
const mockShare = jest.spyOn(Share, 'share');
const mockAlert = jest.spyOn(Alert, 'alert');
const mockUseBottomSheetModal = jest.fn();
const mockCaptureRef = jest.fn();
const mockSetImageAsync = jest.fn();
const mockRequestPermissionsAsync = jest.fn();
const mockSaveToLibraryAsync = jest.fn();

jest.mock('@suite-native/atoms', () => ({
    ...jest.requireActual('@suite-native/atoms'),
    useBottomSheetModal: () => mockUseBottomSheetModal(),
}));

jest.mock('react-native-view-shot', () => ({
    captureRef: (...args: unknown[]) => mockCaptureRef(...args),
}));

jest.mock('expo-clipboard', () => ({
    setImageAsync: (...args: unknown[]) => mockSetImageAsync(...args),
}));

jest.mock('expo-media-library/legacy', () => ({
    requestPermissionsAsync: (...args: unknown[]) => mockRequestPermissionsAsync(...args),
    saveToLibraryAsync: (...args: unknown[]) => mockSaveToLibraryAsync(...args),
}));

describe('useReceiveAddressSharing', () => {
    const address = 'bc1qreceiveaddress';
    const qrCodeView = {} as ViewShotRef;

    const renderUseReceiveAddressSharing = () =>
        renderHookWithBasicProvider(() =>
            useReceiveAddressSharing({
                address,
                onVerifyAddress: mockVerifyAddress,
            }),
        );

    beforeEach(() => {
        jest.clearAllMocks();
        mockShare.mockResolvedValue({ action: Share.sharedAction });
        mockCaptureRef.mockResolvedValue('/cache/trezor-receive-address-qr.png');
        mockSetImageAsync.mockResolvedValue(undefined);
        mockRequestPermissionsAsync.mockResolvedValue({ granted: true });
        mockSaveToLibraryAsync.mockResolvedValue(undefined);
        mockUseBottomSheetModal.mockReturnValue({
            bottomSheetRef: { current: null },
            openModal: mockOpenSharedAddressBottomSheet,
            closeModal: mockCloseSharedAddressBottomSheet,
        });
    });

    it('opens shared address verification after sharing the address', async () => {
        const { result } = renderUseReceiveAddressSharing();

        await act(() => result.current.handleShareAddress());

        expect(mockShare).toHaveBeenCalledWith({ message: address });
        expect(mockOpenSharedAddressBottomSheet).toHaveBeenCalledTimes(1);
    });

    it('does not open shared address verification after cancelling sharing', async () => {
        mockShare.mockResolvedValue({ action: Share.dismissedAction });
        const { result } = renderUseReceiveAddressSharing();

        await act(() => result.current.handleShareAddress());

        expect(mockShare).toHaveBeenCalledWith({ message: address });
        expect(mockOpenSharedAddressBottomSheet).not.toHaveBeenCalled();
    });

    it('shares the QR code image without opening shared address verification', async () => {
        const { result } = renderUseReceiveAddressSharing();

        await act(() => result.current.handleShareQRCode(qrCodeView));

        expect(mockCaptureRef).toHaveBeenCalledWith(qrCodeView, {
            fileName: 'trezor-receive-address-qr',
            format: 'png',
            result: 'tmpfile',
        });
        expect(mockShare).toHaveBeenCalledWith({
            url: 'file:///cache/trezor-receive-address-qr.png',
            title: 'Share...',
        });
        expect(mockOpenSharedAddressBottomSheet).not.toHaveBeenCalled();
    });

    it('copies the QR code image without opening shared address verification', async () => {
        mockCaptureRef.mockResolvedValue('base64-image');
        const { result } = renderUseReceiveAddressSharing();

        await act(() => result.current.handleCopyQRCode(qrCodeView));

        expect(mockCaptureRef).toHaveBeenCalledWith(qrCodeView, {
            format: 'png',
            result: 'base64',
        });
        expect(mockSetImageAsync).toHaveBeenCalledWith('base64-image');
        expect(mockOpenSharedAddressBottomSheet).not.toHaveBeenCalled();
    });

    it('saves the QR code image without opening shared address verification', async () => {
        const { result } = renderUseReceiveAddressSharing();

        await act(() => result.current.handleSaveQRCode(qrCodeView));

        expect(mockRequestPermissionsAsync).toHaveBeenCalledWith(true);
        expect(mockCaptureRef).toHaveBeenCalledWith(qrCodeView, {
            fileName: 'trezor-receive-address-qr',
            format: 'png',
            result: 'tmpfile',
        });
        expect(mockSaveToLibraryAsync).toHaveBeenCalledWith(
            'file:///cache/trezor-receive-address-qr.png',
        );
        expect(mockOpenSharedAddressBottomSheet).not.toHaveBeenCalled();
    });

    it('does not save the QR code image when media library permission is denied', async () => {
        mockRequestPermissionsAsync.mockResolvedValue({ granted: false });
        const { result } = renderUseReceiveAddressSharing();

        await act(() => result.current.handleSaveQRCode(qrCodeView));

        expect(mockRequestPermissionsAsync).toHaveBeenCalledWith(true);
        expect(mockCaptureRef).not.toHaveBeenCalled();
        expect(mockSaveToLibraryAsync).not.toHaveBeenCalled();
        expect(mockOpenSharedAddressBottomSheet).not.toHaveBeenCalled();
    });

    it('starts shared address verification from the bottom sheet', () => {
        const { result } = renderUseReceiveAddressSharing();

        act(() => result.current.handleVerifySharedAddress());

        expect(mockCloseSharedAddressBottomSheet).toHaveBeenCalledTimes(1);
        expect(mockVerifyAddress).toHaveBeenCalledWith(ReceiveAddressVerificationSource.Shared);
    });

    it('shows an error when the QR code is not available', async () => {
        const { result } = renderUseReceiveAddressSharing();

        await act(() => result.current.handleShareQRCode(null));

        await waitFor(() => {
            expect(mockAlert).toHaveBeenCalledWith('Something went wrong');
        });
        expect(mockShare).not.toHaveBeenCalled();
    });
});

import { Alert, Share } from 'react-native';

import { ReceiveAddressVerificationSource } from '@suite-native/navigation';
import { type QRCodeImageRef } from '@suite-native/qr-code';
import { act, renderHookWithBasicProvider, waitFor } from '@suite-native/test-utils';

import { useReceiveAddressSharing } from './useReceiveAddressSharing';

const mockOpenSharedAddressBottomSheet = jest.fn();
const mockCloseSharedAddressBottomSheet = jest.fn();
const mockVerifyAddress = jest.fn();
const mockShare = jest.spyOn(Share, 'share');
const mockAlert = jest.spyOn(Alert, 'alert');
const mockUseBottomSheetModal = jest.fn();
const mockFileCreate = jest.fn();
const mockFileWrite = jest.fn();
const mockFileUri = 'file:///cache/trezor-receive-address-qr.png';

jest.mock('@suite-native/atoms', () => ({
    ...jest.requireActual('@suite-native/atoms'),
    useBottomSheetModal: () => mockUseBottomSheetModal(),
}));

jest.mock('expo-file-system', () => ({
    EncodingType: {
        Base64: 'base64',
    },
    File: jest.fn(() => ({
        uri: mockFileUri,
        create: mockFileCreate,
        write: mockFileWrite,
    })),
    Paths: {
        cache: 'cache',
    },
}));

describe('useReceiveAddressSharing', () => {
    const address = 'bc1qreceiveaddress';

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

    it('opens shared address verification after sharing the QR code image', async () => {
        const mockQRCodeToDataURL = jest.fn(callback => callback('base64-image'));
        const qrCode: QRCodeImageRef = {
            toDataURL: mockQRCodeToDataURL,
        };
        const { result } = renderUseReceiveAddressSharing();

        await act(() => result.current.handleShareQRCode(qrCode));

        expect(mockQRCodeToDataURL).toHaveBeenCalledWith(expect.any(Function));
        expect(mockFileCreate).toHaveBeenCalledWith({ overwrite: true });
        expect(mockFileWrite).toHaveBeenCalledWith('base64-image', { encoding: 'base64' });
        expect(mockShare).toHaveBeenCalledWith({
            url: mockFileUri,
            title: 'Share QR code',
        });
        expect(mockOpenSharedAddressBottomSheet).toHaveBeenCalledTimes(1);
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

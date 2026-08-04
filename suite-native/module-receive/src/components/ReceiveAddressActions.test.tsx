import { Share } from 'react-native';

import { type NativeAnalyticsDep, events } from '@suite-native/analytics';
import { mockNativeAnalytics } from '@suite-native/analytics/mocks';
import { getTranslation } from '@suite-native/intl';
import { ReceiveAddressVerificationSource } from '@suite-native/navigation';
import { renderWithBasicProvider, userEvent, waitFor } from '@suite-native/test-utils';

import { ReceiveAddressActions } from './ReceiveAddressActions';

const mockCopyAddress = jest.fn();
const mockVerifyAddress = jest.fn();
const mockOpenSharedAddressBottomSheet = jest.fn();
const mockCloseSharedAddressBottomSheet = jest.fn();
const mockShare = jest.spyOn(Share, 'share');
const mockUseBottomSheetModal = jest.fn();
const mockAnalyticsReport = jest.fn();
const services: NativeAnalyticsDep = {
    analytics: mockNativeAnalytics(mockAnalyticsReport),
};

jest.mock('@suite-native/atoms', () => ({
    ...jest.requireActual('@suite-native/atoms'),
    useBottomSheetModal: () => mockUseBottomSheetModal(),
}));

describe('ReceiveAddressActions', () => {
    const address = 'bc1qreceiveaddress';

    const renderActions = () =>
        renderWithBasicProvider(
            <ReceiveAddressActions
                address={address}
                onCopyAddress={mockCopyAddress}
                onVerifyAddress={mockVerifyAddress}
            />,
            { services },
        );

    beforeEach(() => {
        jest.clearAllMocks();
        mockCopyAddress.mockResolvedValue(undefined);
        mockShare.mockResolvedValue({ action: Share.sharedAction });
        mockUseBottomSheetModal.mockReturnValue({
            bottomSheetRef: { current: null },
            openModal: mockOpenSharedAddressBottomSheet,
            closeModal: mockCloseSharedAddressBottomSheet,
        });
    });

    it('copies the address', async () => {
        const { getByText } = renderActions();

        await userEvent.press(getByText(getTranslation('qrCode.copyButton')));

        await waitFor(() => {
            expect(mockCopyAddress).toHaveBeenCalledTimes(1);
            expect(mockOpenSharedAddressBottomSheet).not.toHaveBeenCalled();
        });
    });

    it('starts address verification directly', async () => {
        const { getByText } = renderActions();

        await userEvent.press(getByText(getTranslation('moduleReceive.addressActions.verify')));

        expect(mockCloseSharedAddressBottomSheet).not.toHaveBeenCalled();
        expect(mockVerifyAddress).toHaveBeenCalledWith(ReceiveAddressVerificationSource.Verified);
    });

    it('opens shared address verification after sharing', async () => {
        const { getByText, getByTestId } = renderActions();

        await userEvent.press(getByText(getTranslation('qrCode.shareButton')));
        await userEvent.press(getByTestId('@receive/address-verification/shared/verify-button'));

        expect(mockShare).toHaveBeenCalledWith({ message: address });
        expect(mockOpenSharedAddressBottomSheet).toHaveBeenCalledTimes(1);
        expect(mockCloseSharedAddressBottomSheet).toHaveBeenCalledTimes(1);
        expect(mockVerifyAddress).toHaveBeenCalledWith(ReceiveAddressVerificationSource.Shared);
        expect(mockAnalyticsReport).toHaveBeenCalledWith({
            type: events.receiveShareAddressEvent.name,
        });
    });

    it('does not open shared address verification after cancelling sharing', async () => {
        mockShare.mockResolvedValue({ action: Share.dismissedAction });
        const { getByText } = renderActions();

        await userEvent.press(getByText(getTranslation('qrCode.shareButton')));

        expect(mockShare).toHaveBeenCalledWith({ message: address });
        expect(mockOpenSharedAddressBottomSheet).not.toHaveBeenCalled();
        expect(mockAnalyticsReport).not.toHaveBeenCalled();
    });
});

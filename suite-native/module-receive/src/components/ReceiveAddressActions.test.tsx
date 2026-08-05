import { getTranslation } from '@suite-native/intl';
import { ReceiveAddressVerificationSource } from '@suite-native/navigation';
import { renderWithBasicProvider, userEvent } from '@suite-native/test-utils';

import { ReceiveAddressActions } from './ReceiveAddressActions';

const mockCopyAddress = jest.fn();
const mockShareAddress = jest.fn();
const mockVerifyAddress = jest.fn();

describe('ReceiveAddressActions', () => {
    const renderActions = () =>
        renderWithBasicProvider(
            <ReceiveAddressActions
                onCopyAddress={mockCopyAddress}
                onShareAddress={mockShareAddress}
                onVerifyAddress={mockVerifyAddress}
            />,
        );

    beforeEach(() => {
        jest.clearAllMocks();
        mockCopyAddress.mockResolvedValue(undefined);
    });

    it('copies the address', async () => {
        const { getByText } = renderActions();

        await userEvent.press(getByText(getTranslation('qrCode.copyButton')));

        expect(mockCopyAddress).toHaveBeenCalledTimes(1);
    });

    it('starts address verification directly', async () => {
        const { getByText } = renderActions();

        await userEvent.press(getByText(getTranslation('moduleReceive.addressActions.verify')));

        expect(mockVerifyAddress).toHaveBeenCalledWith(ReceiveAddressVerificationSource.Verified);
    });

    it('shares the address', async () => {
        const { getByText } = renderActions();

        await userEvent.press(getByText(getTranslation('qrCode.shareButton')));

        expect(mockShareAddress).toHaveBeenCalledTimes(1);
    });
});

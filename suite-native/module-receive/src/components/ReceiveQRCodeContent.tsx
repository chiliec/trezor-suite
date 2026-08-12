import { TokenIcon } from '@suite-native/icons';
import { QRCode } from '@suite-native/qr-code';

import type { ReceiveQRCodeContentProps } from './ReceiveQRCodeCard.types';

export const ReceiveQRCodeContent = ({
    address,
    networkSymbol,
    tokenContract,
    qrCodeSize,
}: ReceiveQRCodeContentProps) => (
    <QRCode
        data={address}
        qrCodeSize={qrCodeSize}
        paddingHorizontal="sp16"
        paddingVertical="sp16"
        centerIcon={
            <TokenIcon
                symbol={networkSymbol}
                contractAddress={tokenContract}
                showNetworkIcon={tokenContract !== undefined}
                size="large"
            />
        }
    />
);

import { Button, HStack, VStack } from '@suite-native/atoms';
import { Translation } from '@suite-native/intl';
import { ReceiveAddressVerificationSource } from '@suite-native/navigation';

type ReceiveAddressActionsProps = {
    onCopyAddress: () => void;
    onShareAddress: () => void;
    onVerifyAddress: (source: ReceiveAddressVerificationSource) => void;
};

export const ReceiveAddressActions = ({
    onCopyAddress,
    onShareAddress,
    onVerifyAddress,
}: ReceiveAddressActionsProps) => (
    <VStack spacing="sp8">
        <Button iconLeft="copy" onPress={onCopyAddress} isFullWidth>
            <Translation id="qrCode.copyButton" />
        </Button>
        <HStack spacing="sp8">
            <Button
                iconLeft="shareNetwork"
                intent="neutral"
                priority="secondary"
                onPress={onShareAddress}
                flex={1}
            >
                <Translation id="qrCode.shareButton" />
            </Button>
            <Button
                iconLeft="trezorDevices"
                intent="neutral"
                priority="secondary"
                onPress={() => onVerifyAddress(ReceiveAddressVerificationSource.Verified)}
                flex={1}
            >
                <Translation id="moduleReceive.addressActions.verify" />
            </Button>
        </HStack>
    </VStack>
);

import { Button, ContextMenu, Host, RNHostView } from '@expo/ui/swift-ui';
import * as Haptics from 'expo-haptics';

import { useTranslate } from '@suite-native/intl';

import type { ClipboardCopyMenuProps } from './ClipboardCopyMenu.types';
import { useCopyToClipboard } from '../hooks/useCopyToClipboard';

export const ClipboardCopyMenu = ({
    value,
    children,
    copyMessage,
    copyLabel,
    menuActions,
    additionalActions,
    onCopy,
    style,
}: ClipboardCopyMenuProps) => {
    const copyToClipboard = useCopyToClipboard();
    const { translate } = useTranslate();

    const handleCopy = () => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        if (onCopy) {
            void onCopy();

            return;
        }

        if (value !== undefined) {
            void copyToClipboard(value, copyMessage);
        }
    };

    const actions = menuActions ?? [
        {
            label: copyLabel ?? translate('generic.buttons.copy'),
            onPress: handleCopy,
        },
        ...(additionalActions ?? []),
    ];

    return (
        <Host matchContents style={style}>
            <ContextMenu>
                <ContextMenu.Items>
                    {actions.map(({ label, onPress }) => (
                        <Button key={label} label={label} onPress={() => void onPress()} />
                    ))}
                </ContextMenu.Items>
                <ContextMenu.Trigger>
                    <RNHostView matchContents>{children}</RNHostView>
                </ContextMenu.Trigger>
            </ContextMenu>
        </Host>
    );
};

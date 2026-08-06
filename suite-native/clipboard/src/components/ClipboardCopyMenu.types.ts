import type { ReactElement } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

export type ClipboardCopyMenuAction = {
    label: string;
    onPress: () => void | Promise<void>;
};

export type ClipboardCopyMenuProps = {
    value?: string;
    children: ReactElement;
    copyMessage?: string;
    copyLabel?: string;
    menuActions?: ClipboardCopyMenuAction[];
    additionalActions?: ClipboardCopyMenuAction[];
    onCopy?: () => void | Promise<void>;
    style?: StyleProp<ViewStyle>;
};

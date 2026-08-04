import type { ReactElement } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

export type ClipboardCopyMenuProps = {
    value?: string;
    children: ReactElement;
    copyMessage?: string;
    copyLabel?: string;
    onCopy?: () => void | Promise<void>;
    style?: StyleProp<ViewStyle>;
};

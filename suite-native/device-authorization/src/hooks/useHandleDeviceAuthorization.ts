import { useEffect } from 'react';
import { useSelector } from 'react-redux';

import { CommonActions, type NavigationState, useNavigation } from '@react-navigation/native';

import {
    type AuthorizeDeviceStackParamList,
    AuthorizeDeviceStackRoutes,
    type RootStackParamList,
    RootStackRoutes,
    type StackToStackCompositeNavigationProps,
    useLastRouteName,
} from '@suite-native/navigation';

import {
    DeviceAuthorizationStep,
    selectDeviceAuthorizationStep,
} from '../deviceAuthorizationSlice';

type NavigationProp = StackToStackCompositeNavigationProps<
    AuthorizeDeviceStackParamList,
    AuthorizeDeviceStackRoutes,
    RootStackParamList
>;

const pinMatrixBlacklistedScreens = [
    RootStackRoutes.DeviceSettingsStack,
    RootStackRoutes.DeviceOnboardingStack,
];

export const useHandleDeviceAuthorization = () => {
    const navigation = useNavigation<NavigationProp>();
    const lastRoute = useLastRouteName();

    const deviceAuthorizationStep = useSelector(selectDeviceAuthorizationStep);

    const isOnPinMatrixBlacklistedRoute = pinMatrixBlacklistedScreens.includes(
        lastRoute as RootStackRoutes,
    );

    useEffect(() => {
        switch (deviceAuthorizationStep) {
            case DeviceAuthorizationStep.PinRequested:
                // When trezor gets locked, it is necessary to display a PIN matrix for T1 so that it can be unlocked
                // and then continue with the interaction. For non-T1 devices, PIN is entered on device, but the screen is still displayed.
                if (!isOnPinMatrixBlacklistedRoute) {
                    navigation.navigate(RootStackRoutes.AuthorizeDeviceStack, {
                        screen: AuthorizeDeviceStackRoutes.PinMatrix,
                    });

                    return;
                }
                break;
            case DeviceAuthorizationStep.PassphraseRequested: {
                // Feature requests passphrase.
                // If AuthorizeDeviceStack is already focused (e.g. pin-locked passphrase
                // wallet: PinMatrix is showing, then passphrase is requested),
                // navigate(AuthorizeDeviceStack, { screen }) is a no-op — React Navigation
                // only merges params into the already-mounted stack. Dispatch the
                // navigate at the nested navigator instead.
                //
                // getState() is typed to the primary (AuthorizeDeviceStack) navigator, but
                // this hook lives at the root, so cast to reach the root routes.
                const rootState = navigation.getState() as unknown as NavigationState;
                const authStackRoute = rootState.routes.find(
                    route => route.name === RootStackRoutes.AuthorizeDeviceStack,
                );

                if (authStackRoute?.state?.key) {
                    navigation.dispatch({
                        ...CommonActions.navigate(AuthorizeDeviceStackRoutes.PassphraseForm),
                        target: authStackRoute.state.key,
                    });
                } else {
                    navigation.navigate(RootStackRoutes.AuthorizeDeviceStack, {
                        screen: AuthorizeDeviceStackRoutes.PassphraseForm,
                    });
                }
                break;
            }
            case DeviceAuthorizationStep.ContinueOnTrezorRequested:
                navigation.navigate(RootStackRoutes.AuthorizeDeviceStack, {
                    screen: AuthorizeDeviceStackRoutes.ContinueOnTrezor,
                });
                break;
            default:
                return;
        }
    }, [deviceAuthorizationStep, isOnPinMatrixBlacklistedRoute, navigation]);
};

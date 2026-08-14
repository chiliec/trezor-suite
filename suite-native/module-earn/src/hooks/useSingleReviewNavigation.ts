import { useCallback, useEffect, useRef } from 'react';

import { useIsFocused } from '@react-navigation/native';

/**
 * Runs a navigation into a device review at most once per visit to the screen.
 *
 * Review screens start signing as soon as they mount (see `useAutoStartReview`), and a second tap
 * lands before the stack has committed the first navigation — so repeated taps push several review
 * screens and the device prompts once per screen.
 *
 * The guard re-arms whenever the screen regains focus, so returning from a cancelled review leaves
 * the button usable. Wrap only the navigation itself: latching on a path that bails out early
 * (nothing prepared yet, flow disabled) would leave the button dead for the rest of the visit.
 */
export const useSingleReviewNavigation = () => {
    const hasNavigatedRef = useRef(false);
    const isFocused = useIsFocused();

    useEffect(() => {
        if (isFocused) {
            hasNavigatedRef.current = false;
        }
    }, [isFocused]);

    return useCallback((navigateToReview: () => void) => {
        if (hasNavigatedRef.current) {
            return;
        }

        hasNavigatedRef.current = true;
        navigateToReview();
    }, []);
};

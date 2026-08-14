import { renderHook } from '@suite-native/test-utils';

import { useSingleReviewNavigation } from './useSingleReviewNavigation';

const mockUseIsFocused = jest.fn(() => true);

jest.mock('@react-navigation/native', () => ({
    ...jest.requireActual('@react-navigation/native'),
    useIsFocused: () => mockUseIsFocused(),
}));

describe('useSingleReviewNavigation', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockUseIsFocused.mockReturnValue(true);
    });

    it('navigates once however many times the button is tapped', () => {
        const navigateToReview = jest.fn();
        const { result } = renderHook(() => useSingleReviewNavigation());

        result.current(navigateToReview);
        result.current(navigateToReview);
        result.current(navigateToReview);

        expect(navigateToReview).toHaveBeenCalledTimes(1);
    });

    it('re-arms when the screen regains focus, so a cancelled review can be retried', () => {
        const navigateToReview = jest.fn();
        const { result, rerender } = renderHook(() => useSingleReviewNavigation());

        result.current(navigateToReview);

        mockUseIsFocused.mockReturnValue(false);
        rerender({});
        mockUseIsFocused.mockReturnValue(true);
        rerender({});

        result.current(navigateToReview);

        expect(navigateToReview).toHaveBeenCalledTimes(2);
    });
});

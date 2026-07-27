import { TestCategory, TestPriority, TestStream } from '@trezor/e2e-utils';

import { it } from '../../../support/wrappedIt';

describe.skip('Manual', () => {
    it(
        'MEV protection',
        {
            testCase: 'MEV protection can be toggled and is applied to Ethereum transactions',
            prerequisites: ['connected device', 'seed with ETH funds on it'],
            steps: [
                'Navigate to Settings > Security and locate the MEV protection toggle',
                'Enable MEV protection',
                'Navigate to an ETH account, open the send form and fill in a valid address and amount',
                'Verify the MEV protection indication is present in the send flow',
                'Go back to Settings > Security and disable MEV protection',
                'Repeat the send flow and verify the MEV protection indication is no longer present',
            ],
            category: TestCategory.Settings,
            priority: TestPriority.High,
            stream: TestStream.Wallet,
        },
        async () => {},
    );
});

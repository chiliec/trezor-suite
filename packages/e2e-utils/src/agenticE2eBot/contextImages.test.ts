import assert from 'node:assert/strict';
import test from 'node:test';

import {
    assertAllowedAttachmentRedirect,
    collectAttachmentUrls,
    getAttachmentFilename,
    readResponseBytes,
} from './contextImages';

const attachmentUrl =
    'https://github.com/user-attachments/assets/6bc35f68-4339-4733-a1c6-e63ad73a496f';

test('collectAttachmentUrls keeps only GitHub attachments', () => {
    assert.deepEqual(
        collectAttachmentUrls([
            `${attachmentUrl}\nhttps://attacker.example/image.png`,
            'https://user-images.githubusercontent.com/123/screenshot.png',
        ]),
        [attachmentUrl, 'https://user-images.githubusercontent.com/123/screenshot.png'],
    );
});

test('assertAllowedAttachmentRedirect rejects non-GitHub redirects', () => {
    assert.doesNotThrow(() =>
        assertAllowedAttachmentRedirect(
            'https://private-user-images.githubusercontent.com/123/screenshot.png',
        ),
    );
    assert.doesNotThrow(() =>
        assertAllowedAttachmentRedirect(
            'https://github-production-user-asset-6210df.s3.amazonaws.com/123/screenshot.png',
        ),
    );
    assert.throws(
        () => assertAllowedAttachmentRedirect('https://attacker.example/screenshot.png'),
        /outside GitHub/,
    );
});

test('getAttachmentFilename adds an extension to GitHub asset IDs', () => {
    assert.equal(
        getAttachmentFilename(attachmentUrl, 'image/png'),
        `${attachmentUrl.split('/').pop()}.png`,
    );
    assert.equal(getAttachmentFilename(attachmentUrl, 'video/mp4'), null);
});

test('readResponseBytes enforces the streamed byte limit', async () => {
    await assert.rejects(() => readResponseBytes(new Response('123456'), 5), /exceeds 5 bytes/);
    assert.equal((await readResponseBytes(new Response('12345'), 5)).toString(), '12345');
});

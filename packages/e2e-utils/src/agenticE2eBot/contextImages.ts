import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { sanitizeFilename } from '@trezor/utils';

import { log } from '../logger';
import { AGENTIC_CONTEXT_IMAGES_DIR, AGENTIC_CONTEXT_IMAGES_REPO_PATH } from './paths';

const MAX_CONTEXT_IMAGES = 10;
export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

const GITHUB_ATTACHMENT_HOST = 'github.com';
const GITHUB_CDN_HOSTS = new Set([
    'private-user-images.githubusercontent.com',
    'user-images.githubusercontent.com',
]);
const GITHUB_USER_ASSET_HOST = /^github-production-user-asset-[a-z0-9]+\.s3\.amazonaws\.com$/;
const GITHUB_ATTACHMENT_PATH = /^\/user-attachments\/assets\/[0-9a-f-]+\/?$/i;
const IMAGE_FILE_EXTENSION = /\.(png|jpe?g|gif|webp)$/i;

const isGithubAttachmentUrl = (url: URL): boolean =>
    (url.hostname === GITHUB_ATTACHMENT_HOST && GITHUB_ATTACHMENT_PATH.test(url.pathname)) ||
    (GITHUB_CDN_HOSTS.has(url.hostname) && IMAGE_FILE_EXTENSION.test(url.pathname));

export function collectAttachmentUrls(texts: (string | undefined)[]): string[] {
    const urls: string[] = [];

    for (const text of texts) {
        for (const rawUrl of text?.match(/https?:\/\/[^\s"'<>)]+/g) ?? []) {
            const value = rawUrl.replace(/[.,;:]+$/, '');
            const url = new URL(value);

            if (isGithubAttachmentUrl(url) && !urls.includes(value)) {
                urls.push(value);
            }

            if (urls.length === MAX_CONTEXT_IMAGES) {
                return urls;
            }
        }
    }

    return urls;
}

export function assertAllowedAttachmentRedirect(url: string): void {
    const redirectUrl = new URL(url);
    if (!isGithubAttachmentUrl(redirectUrl) && !GITHUB_USER_ASSET_HOST.test(redirectUrl.hostname)) {
        throw new Error(`attachment redirected outside GitHub: ${url}`);
    }
}

function extensionFromContentType(contentType: string | null): string | null {
    const type = contentType ?? '';

    if (type.includes('png')) return '.png';
    if (type.includes('jpeg') || type.includes('jpg')) return '.jpg';
    if (type.includes('gif')) return '.gif';
    if (type.includes('webp')) return '.webp';

    return null;
}

export function getAttachmentFilename(url: string, contentType: string | null): string | null {
    const extension = extensionFromContentType(contentType);
    if (!extension) {
        return null;
    }

    const rawBasename = decodeURIComponent(new URL(url).pathname.split('/').pop() ?? '');
    const basename = sanitizeFilename(rawBasename);
    if (!basename || basename !== rawBasename) {
        throw new Error(`unsafe attachment filename: ${rawBasename}`);
    }

    return IMAGE_FILE_EXTENSION.test(basename) ? basename : `${basename}${extension}`;
}

export async function readResponseBytes(
    response: Response,
    maxBytes = MAX_ATTACHMENT_BYTES,
): Promise<Buffer> {
    const contentLength = Number(response.headers.get('content-length'));
    if (Number.isFinite(contentLength) && contentLength > maxBytes) {
        throw new Error(`attachment exceeds ${maxBytes} bytes`);
    }

    if (!response.body) {
        throw new Error('attachment response has no body');
    }

    const chunks: Buffer[] = [];
    const reader = response.body.getReader();
    let totalBytes = 0;

    while (true) {
        const { done, value } = await reader.read();
        if (done) {
            return Buffer.concat(chunks, totalBytes);
        }

        totalBytes += value.byteLength;
        if (totalBytes > maxBytes) {
            await reader.cancel();
            throw new Error(`attachment exceeds ${maxBytes} bytes`);
        }

        chunks.push(Buffer.from(value));
    }
}

export async function downloadAttachmentImages(texts: (string | undefined)[]): Promise<string[]> {
    const urls = collectAttachmentUrls(texts);

    rmSync(AGENTIC_CONTEXT_IMAGES_DIR, { recursive: true, force: true });
    mkdirSync(AGENTIC_CONTEXT_IMAGES_DIR, { recursive: true });

    const savedPaths: string[] = [];

    for (const url of urls) {
        const response = await fetch(url, { redirect: 'follow' });
        if (!response.ok) {
            log(`[context] skip unavailable attachment ${url} (${response.status})`);
            continue;
        }

        assertAllowedAttachmentRedirect(response.url);

        const name = getAttachmentFilename(url, response.headers.get('content-type'));
        if (!name) {
            await response.body?.cancel();
            log(`[context] skip non-image ${url}`);
            continue;
        }
        const bytes = await readResponseBytes(response);
        const relativePath = `${AGENTIC_CONTEXT_IMAGES_REPO_PATH}/${name}`;

        writeFileSync(join(AGENTIC_CONTEXT_IMAGES_DIR, name), bytes);
        savedPaths.push(relativePath);
        log(`[context] saved ${relativePath}`);
    }

    return savedPaths;
}

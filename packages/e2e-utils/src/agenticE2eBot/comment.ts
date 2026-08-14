import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

import { log } from '../logger';
import { agenticArtifactPath, readArtifactJson } from './paths';
import { type PrContext, PrContextSchema, type TestResult, TestResultSchema } from './schemas';
import { parsePrNumber } from './target';

const REPO = 'trezor/trezor-suite';
const COMMENT_MARKER = '<!-- trezor-agentic-e2e-bot -->';
const MAX_INLINE_SCREENSHOTS = 5;

const RESULT_LABEL: Record<TestResult['result'], string> = {
    pass: 'PASS',
    partial: 'PARTIAL',
    fail: 'FAIL',
    blocked: 'BLOCKED',
};

const gh = (args: string[]): string =>
    execFileSync('gh', args, { encoding: 'utf-8', maxBuffer: 16 * 1024 * 1024 }).trim();

const escapeTableCell = (value: string): string =>
    value.replace(/\\/g, '\\\\').replace(/\r?\n/g, ' ').replace(/\|/g, '\\|');

function buildCommentBody(context: PrContext, testResult: TestResult | null): string {
    const lines: string[] = [COMMENT_MARKER];

    if (!testResult) {
        // Publish step after a failed/cancelled run — still report the miss.
        lines.push(
            '## Agentic E2E Test — ERROR',
            '',
            'The test run did not produce a result (setup or agent failure). ' +
                'Check the workflow logs and artifacts for details.',
        );
    } else {
        lines.push(`## Agentic E2E Test — ${RESULT_LABEL[testResult.result]}`, '');
        lines.push(testResult.summary, '');

        if (testResult.issues.length > 0) {
            lines.push(
                `### Issues (${testResult.issues.length})`,
                '',
                '| ID | Severity | Title |',
                '|---|---|---|',
                ...testResult.issues.map(
                    issue =>
                        `| ${escapeTableCell(issue.id)} | ${issue.severity} | ${escapeTableCell(issue.title)} |`,
                ),
                '',
            );
        }

        const screenshotBaseUrl = process.env.SCREENSHOT_BASE_URL?.replace(/\/$/, '');
        if (screenshotBaseUrl) {
            const inlineShots = testResult.issues
                .flatMap(issue =>
                    issue.screenshots.map(file => ({
                        id: issue.id,
                        title: issue.title,
                        file,
                    })),
                )
                .slice(0, MAX_INLINE_SCREENSHOTS);

            if (inlineShots.length > 0) {
                lines.push('### Screenshots', '');
                for (const shot of inlineShots) {
                    lines.push(
                        `**${shot.id}** — ${shot.title}`,
                        '',
                        `![${shot.id}](${screenshotBaseUrl}/${shot.file})`,
                        '',
                    );
                }
            }
        }
    }

    lines.push('---');
    if (context.issue) {
        lines.push(
            `Issue: [#${context.issue.number}](${context.issue.url}) · PR: [#${context.prNumber}](${context.prUrl})`,
        );
    }
    lines.push(`Device: \`${context.deviceModel}\` emulator · Suite: ${context.suiteUrl}`);

    const {
        GITHUB_SERVER_URL: server,
        GITHUB_REPOSITORY: repo,
        GITHUB_RUN_ID: runId,
    } = process.env;
    if (server && repo && runId) {
        lines.push(
            `Report HTML and screenshots: [workflow artifacts](${server}/${repo}/actions/runs/${runId})`,
        );
    }

    return `${lines.join('\n')}\n`;
}

function upsertComment(prNumber: number, body: string): void {
    const bodyFile = agenticArtifactPath('comment.md');
    mkdirSync(dirname(bodyFile), { recursive: true });
    writeFileSync(bodyFile, body);

    const comments: { id: number; body: string }[] = JSON.parse(
        gh(['api', `repos/${REPO}/issues/${prNumber}/comments`, '--paginate']),
    );
    const existing = comments.find(c => c.body.includes(COMMENT_MARKER));

    if (existing) {
        gh([
            'api',
            '--method',
            'PATCH',
            `repos/${REPO}/issues/comments/${existing.id}`,
            '-F',
            `body=@${bodyFile}`,
        ]);
        log(`Updated existing bot comment ${existing.id}`);
    } else {
        gh([
            'api',
            '--method',
            'POST',
            `repos/${REPO}/issues/${prNumber}/comments`,
            '-F',
            `body=@${bodyFile}`,
        ]);
        log('Posted new bot comment');
    }
}

function main(): void {
    const prNumber = parsePrNumber(process.env.TARGET);
    const context = PrContextSchema.parse(readArtifactJson('context.json'));

    const resultPath = agenticArtifactPath('test-result.json');
    const testResult = existsSync(resultPath)
        ? TestResultSchema.parse(readArtifactJson('test-result.json'))
        : null;

    upsertComment(prNumber, buildCommentBody(context, testResult));
}

main();

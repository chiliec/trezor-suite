import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import test from 'node:test';

const HOOK_PATH = join(__dirname, 'hooks/sandboxGate.mjs');
const FAKE_ROOT = '/tmp/agentic-e2e-fake-root';
const CONTEXT_IMAGES_DIR = 'packages/e2e-utils/src/agenticE2eBot/reports/context-images';
const BROWSER_DIR = 'packages/e2e-utils/src/agenticE2eBot/reports/browser';

const ALLOW = 0;
const DENY = 2;

function runGate(stdin: string): { exitCode: number | null; stderr: string } {
    const result = spawnSync('node', [HOOK_PATH], {
        input: stdin,
        env: { ...process.env, CLAUDE_PROJECT_DIR: FAKE_ROOT },
        encoding: 'utf-8',
    });

    return { exitCode: result.status, stderr: result.stderr };
}

function runGateWithTool(toolName: string, toolInput: Record<string, unknown>) {
    return runGate(JSON.stringify({ tool_name: toolName, tool_input: toolInput }));
}

test('denies Read outside the context-images directory', () => {
    const { exitCode, stderr } = runGateWithTool('Read', {
        file_path: 'packages/e2e-utils/.env',
    });
    assert.equal(exitCode, DENY);
    assert.match(stderr, /Read blocked/);
});

test('denies Read escaping the allowed directory via ../ traversal', () => {
    const { exitCode } = runGateWithTool('Read', {
        file_path: `${CONTEXT_IMAGES_DIR}/../../../../.env`,
    });
    assert.equal(exitCode, DENY);
});

test('denies Read of a sibling directory sharing the allowed prefix', () => {
    const { exitCode } = runGateWithTool('Read', {
        file_path: `${CONTEXT_IMAGES_DIR}-evil/screenshot.png`,
    });
    assert.equal(exitCode, DENY);
});

test('denies Read with missing file_path', () => {
    const { exitCode, stderr } = runGateWithTool('Read', {});
    assert.equal(exitCode, DENY);
    assert.match(stderr, /missing file_path/);
});

test('denies browser_navigate to a foreign host', () => {
    const { exitCode, stderr } = runGateWithTool('mcp__playwright__browser_navigate', {
        url: 'https://attacker.example/dev.suite.sldev.cz',
    });
    assert.equal(exitCode, DENY);
    assert.match(stderr, /browser_navigate blocked/);
});

test('denies browser_tabs carrying a url', () => {
    const { exitCode } = runGateWithTool('mcp__playwright__browser_tabs', {
        action: 'new',
        url: 'https://attacker.example',
    });
    assert.equal(exitCode, DENY);
});

test('denies browser_take_screenshot with missing filename', () => {
    const { exitCode, stderr } = runGateWithTool('mcp__playwright__browser_take_screenshot', {});
    assert.equal(exitCode, DENY);
    assert.match(stderr, /missing filename/);
});

test('denies browser_take_screenshot with a non-png extension', () => {
    const { exitCode } = runGateWithTool('mcp__playwright__browser_take_screenshot', {
        filename: `${BROWSER_DIR}/dump.html`,
    });
    assert.equal(exitCode, DENY);
});

test('denies browser_take_screenshot outside the browser directory', () => {
    const { exitCode } = runGateWithTool('mcp__playwright__browser_take_screenshot', {
        filename: 'packages/e2e-utils/leak.png',
    });
    assert.equal(exitCode, DENY);
});

test('denies invalid stdin JSON', () => {
    const { exitCode, stderr } = runGate('not-json');
    assert.equal(exitCode, DENY);
    assert.match(stderr, /invalid PreToolUse JSON/);
});

test('allows Read inside the context-images directory', () => {
    const { exitCode } = runGateWithTool('Read', {
        file_path: `${CONTEXT_IMAGES_DIR}/screenshot.png`,
    });
    assert.equal(exitCode, ALLOW);
});

test('allows browser_navigate to the suite preview host', () => {
    const { exitCode } = runGateWithTool('mcp__playwright__browser_navigate', {
        url: 'https://dev.suite.sldev.cz/suite-web/develop/web/',
    });
    assert.equal(exitCode, ALLOW);
});

test('allows browser_take_screenshot of a png inside the browser directory', () => {
    const { exitCode } = runGateWithTool('mcp__playwright__browser_take_screenshot', {
        filename: `${BROWSER_DIR}/dashboard.png`,
    });
    assert.equal(exitCode, ALLOW);
});

test('allows unrelated tools to pass through', () => {
    const { exitCode } = runGateWithTool('mcp__playwright__browser_click', {
        ref: 'e12',
    });
    assert.equal(exitCode, ALLOW);
});

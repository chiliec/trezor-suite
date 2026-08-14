import { spawn } from 'node:child_process';

import { REPO_ROOT } from './paths';

export type ClaudeRunResult = {
    output: string;
    status: number | null;
};

type RunClaudeOptions = {
    args: string[];
    input: string;
    timeoutMs?: number;
};

// Spawn Claude Code, echo its NDJSON stream as progress, return stdout when it exits.
export function runClaude({ args, input, timeoutMs }: RunClaudeOptions): Promise<ClaudeRunResult> {
    return new Promise((resolve, reject) => {
        const env = { ...process.env };
        // Prevents an internal Claude Code setting from accidentally being inherited.
        delete env.MCP_CONNECTION_NONBLOCKING;

        const child = spawn(`${REPO_ROOT}/node_modules/.bin/claude`, args, {
            cwd: REPO_ROOT,
            env,
            stdio: ['pipe', 'pipe', 'inherit'],
        });

        let output = '';
        const timeout =
            timeoutMs !== undefined
                ? setTimeout(() => {
                      child.kill('SIGTERM');
                      reject(new Error('timed out'));
                  }, timeoutMs)
                : undefined;

        child.stdout.on('data', (chunk: Buffer) => {
            const text = chunk.toString('utf-8');
            output += text;
            process.stderr.write(text);
        });

        child.on('error', e => {
            clearTimeout(timeout);
            reject(e);
        });
        child.on('close', status => {
            clearTimeout(timeout);
            resolve({ output, status });
        });

        child.stdin.end(input);
    });
}

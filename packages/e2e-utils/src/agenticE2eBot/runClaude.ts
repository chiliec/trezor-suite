import { spawn } from 'node:child_process';
import { z } from 'zod';

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

const ClaudeResultSchema = z.object({
    type: z.string().optional(),
    subtype: z.string().optional(),
    result: z.string().optional(),
    structured_output: z.unknown().optional(),
});

// Claude CLI stdout (`stream-json` NDJSON) → result envelope.
export function processAgentOutput(rawOutput: string): z.infer<typeof ClaudeResultSchema> {
    for (const line of rawOutput.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed) {
            continue;
        }

        const parsed = ClaudeResultSchema.safeParse(JSON.parse(trimmed));
        if (parsed.success && parsed.data.type === 'result') {
            return parsed.data;
        }
    }

    throw new Error('no result entry in claude stdout');
}

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

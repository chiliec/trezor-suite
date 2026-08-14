import { type ClaudeResult, ClaudeResultSchema } from './schemas';

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

// Claude CLI stdout (`stream-json` NDJSON, or a one-line `json` blob) → result envelope.
export function processAgentOutput(rawOutput: string): ClaudeResult {
    const entries = rawOutput
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean)
        .map(line => JSON.parse(line) as unknown);

    const resultEntry = entries.find(entry => isRecord(entry) && entry.type === 'result');
    if (!resultEntry) {
        throw new Error('no result entry in claude stdout');
    }

    return ClaudeResultSchema.parse(resultEntry);
}

import { z } from 'zod';

// Schemas for the Claude Code CLI result envelope. Shared by agent bots that
// spawn the CLI and parse its output (`--output-format json` or `stream-json`).

export const ClaudeResultSchema = z.object({
    type: z.string().optional(),
    subtype: z.string().optional(),
    result: z.string().optional(),
    structured_output: z.unknown().optional(),
});

export type ClaudeResult = z.infer<typeof ClaudeResultSchema>;

// Strip the top-level `$schema` which breaks Agent's attempt of JSON output
export const toCliJsonSchema = (schema: z.ZodType) => {
    const jsonSchema = z.toJSONSchema(schema);
    delete jsonSchema.$schema;

    return jsonSchema;
};

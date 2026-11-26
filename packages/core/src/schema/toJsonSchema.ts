import { z } from 'zod';
import type { JsonSchema } from '../llm/request';

/**
 * The JSON Schema of a zod schema, to send with an {@link LlmRequest} so the
 * provider can constrain its answer. The zod schema stays the single source:
 * the caller still validates the answer with it, because a provider may
 * ignore or only partly honour the document it receives.
 */
export function toJsonSchema(schema: z.ZodType): JsonSchema {
  return z.toJSONSchema(schema);
}

import { Ajv, type AnySchema } from 'ajv';
import * as formatsPlugin from 'ajv-formats';
import { expect } from 'vitest';

const ajv = new Ajv({ allErrors: true });
formatsPlugin.default(ajv);

export function expectSchema(data: unknown, schema: AnySchema): void {
  const validate = ajv.compile(schema);
  const valid = validate(data);
  expect(valid, ajv.errorsText(validate.errors)).toBe(true);
}

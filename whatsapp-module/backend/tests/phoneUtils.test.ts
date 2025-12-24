/* Fix: Imported test and expect from vitest to resolve missing global testing functions */
import { test, expect } from 'vitest';
import { normalizePhoneToE164, maskPhone } from '../src/utils/phoneUtils';

/* Fix: Resolved 'test' identifier by importing from vitest */
test('normalize brazil 11-digit', () => {
  /* Fix: Resolved 'expect' identifier by importing from vitest */
  expect(normalizePhoneToE164('(11) 91234-5678')).toBe('5511912345678');
});

/* Fix: Resolved 'test' identifier by importing from vitest */
test('mask phone', () => {
  /* Fix: Resolved 'expect' identifier by importing from vitest */
  expect(maskPhone('5511912345678')).toMatch(/\*+\d{4}$/);
});
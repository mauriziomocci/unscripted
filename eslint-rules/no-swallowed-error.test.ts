import { RuleTester } from 'eslint';
import { describe, it } from 'vitest';
import rule from './no-swallowed-error.ts';

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const tester = new RuleTester({
  languageOptions: { ecmaVersion: 'latest', sourceType: 'module' },
});

tester.run('no-swallowed-error', rule, {
  valid: [
    { code: 'try { f(); } catch (e) { throw e; }' },
    { code: 'try { f(); } catch (e) { log(e); throw e; }' },
    { code: 'p.catch((e) => { throw map(e); });' },
  ],
  invalid: [
    {
      code: 'function g() { try { f(); } catch (e) { return null; } }',
      errors: [{ messageId: 'swallowedCatch' }],
    },
    {
      // The only throw runs later, in a callback: the catch itself swallows.
      code: 'try { f(); } catch (e) { later(() => { throw e; }); }',
      errors: [{ messageId: 'swallowedCatch' }],
    },
    { code: 'p.catch(() => null);', errors: [{ messageId: 'swallowedHandler' }] },
    { code: 'p.catch(swallow);', errors: [{ messageId: 'opaqueHandler' }] },
    { code: 'p.then(ok, onRejected);', errors: [{ messageId: 'rejectionInThen' }] },
  ],
});

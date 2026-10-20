import { z } from 'zod';

// Zod compiles an object schema's parser with `new Function` the first time it runs, and probes for it with one.
// The web app's pages carry a content security policy without 'unsafe-eval' (apps/web/build/security.ts): under
// it every compile is reported, and once enforced Zod would fall back to its runtime parser anyway. The messages
// parsed here are a few hundred bytes, so the compiled parser buys nothing: the runtime one, everywhere, always.
// Imported first by index.ts: Zod decides at a schema's definition, so this must run before any schema module.
z.config({ jitless: true });

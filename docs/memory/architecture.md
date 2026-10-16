# Architecture

## Package layout (2026-10-16)

Planned layout, filled milestone by milestone (`docs/SPEC.md` §8):

| package | role | may import |
| --- | --- | --- |
| `packages/shared` | types, Zod schemas (`RuleSet`, presets, actions, views, protocol messages) | `zod` only |
| `packages/engine` | the reducer, seeded RNG, `viewFor`, replay | `shared` |
| `packages/bots` | three bot levels over a `PlayerView`, and the bot-vs-bot simulation CLI | `shared`, `engine` (for legal moves on a view) |
| `packages/room` | seats, tokens, readiness, kick, turn timers, bot takeover, expiry: pure, clock injected | `shared`, `engine`, `bots` |
| `apps/web` | React UI; `GameConnection` with `LocalConnection` and `RemoteConnection` | everything in `packages/` |
| `apps/server` | Node `ws` adapter of `room` for LAN; serves the built web app; Docker | `room` |
| `apps/worker` | Cloudflare Worker + one Durable Object per room, adapter of `room` for online | `room` |

**Why**: the brief (§4) makes the engine pure and authoritative everywhere. Putting the room logic (everything a server decides beyond the game) in its own pure package is what makes two server adapters cheap — the owner picked Durable Objects for online on 2026-10-16, and LAN needs a process on his machine anyway (ADR-0004). **How to apply**: an adapter only translates sockets, timers and storage into `room` calls; a rule that ends up in an adapter is a bug.

## Packages ship sources (2026-10-16)

Each package's `package.json` `exports` points at `src/index.ts`; Vite, Vitest, wrangler (esbuild) and Node ≥ 22.18 (type stripping) all read TypeScript directly, so there is no build step and no `dist/` between packages. One root `tsconfig.json` typechecks everything. **Trap to remember**: Node's type stripping refuses files *under* `node_modules`; pnpm's workspace links resolve to the real path outside it, which is why this works — do not switch to `node-linker=hoisted` copies. Node's stripping also refuses TS-only syntax (enums, parameter properties, namespaces): keep packages to erasable syntax (`erasableSyntaxOnly` is the intent).

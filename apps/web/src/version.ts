// The release this build belongs to: the repository's one version, in the root package.json (COMMON-PROJECT-SPEC
// C13, CHANGELOG.md). A named import, so the bundle carries the string and nothing else of that file.
import { version } from '../../../package.json';

export const VERSION: string = version;

/** The commit this build comes from (vite.config.ts), empty in tests and when unknown. */
export const COMMIT: string = import.meta.env.VITE_COMMIT ?? '';

/** "v0.14.0 · 64ef767": the release and, between two releases, which build of it. */
export const BUILD: string = `v${VERSION}${COMMIT ? ` · ${COMMIT}` : ''}`;

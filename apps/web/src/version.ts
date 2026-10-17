// The release this build belongs to: the repository's one version, in the root package.json (COMMON-PROJECT-SPEC
// C13, CHANGELOG.md). A named import, so the bundle carries the string and nothing else of that file.
import { version } from '../../../package.json';

export const VERSION: string = version;

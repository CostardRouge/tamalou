import { networkInterfaces } from 'node:os';
import { fileURLToPath } from 'node:url';
import { renderUnicodeCompact } from 'uqr';
import { startServer } from './server.ts';

// `pnpm serve:lan` and the Docker image: the room server and the web app on the local network, no internet needed
// (docs/SPEC.md §5.4). It prints the addresses phones can open, and a QR code for the first one.
//
//   PORT     default 8080
//   HOST     default 0.0.0.0 (every interface)
//   WEB_DIR  default apps/web/dist (run `pnpm build` first)

const port = Number(process.env.PORT ?? 8080);
const hostname = process.env.HOST ?? '0.0.0.0';
const webDir = process.env.WEB_DIR ?? fileURLToPath(new URL('../../web/dist', import.meta.url));

/** The machine's IPv4 addresses on the local network. */
function localAddresses(): string[] {
  return Object.values(networkInterfaces())
    .flat()
    .filter((i) => i && i.family === 'IPv4' && !i.internal)
    .map((i) => i?.address as string);
}

const running = await startServer(port, hostname, { staticDir: webDir });
const address = running.server.address();
const actualPort = typeof address === 'object' && address ? address.port : port;
// In Docker the container's own address is useless to a phone: PUBLIC_URL names the host's. Phones go straight to
// the game, under play/ (the site's root is the home page, ADR-0017).
const bases = process.env.PUBLIC_URL
  ? [process.env.PUBLIC_URL]
  : hostname === '0.0.0.0'
    ? localAddresses().map((ip) => `http://${ip}:${actualPort}/`)
    : [`${running.url}/`];
const urls = bases.map((base) => new URL('play/', base.endsWith('/') ? base : `${base}/`).href);

console.log('\nTamalou, sur le réseau local\n');
for (const url of urls) console.log(`  ${url}`);
if (urls[0]) console.log(`\n${renderUnicodeCompact(urls[0], { border: 1 })}`);
console.log('\nScannez le code ou ouvrez l’adresse sur un téléphone du même Wi-Fi. Ctrl+C pour arrêter.\n');

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    running.close().then(() => process.exit(0));
  });
}

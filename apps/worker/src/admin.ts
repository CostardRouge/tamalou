import {
  adminPage,
  cookie,
  dayPage,
  gamePage,
  messagePage,
  PERIODS,
  readSession,
  SESSION_SECONDS,
  sessionFor,
  sign,
  unsign,
} from '@tamalou/admin';
import {
  deviceGames,
  localTime,
  summarizeUsage,
  type UsageRow,
  usageCutoff,
  usageGames,
  usageMinute,
} from '@tamalou/shared';
import * as oauth from 'oauth4webapi';
import { version } from '../../../package.json';

// The admin page (ADR-0024): the owner signs in through Sésame, his OpenID Connect provider, and reads the anonymous
// usage statistics. Tamalou is a confidential client there (PKCE S256, the secret in the Basic header); only a member
// of the app whose role is `admin` gets in. The session is a signed cookie (packages/admin); nothing about the owner
// is stored. Without its settings, the page says it is not set up and does nothing else.
//
//   GET  /admin/           → the statistics, or off to sign in
//   GET  /admin/?day=…     → one day and its games (a Paris day, YYYY-MM-DD)
//   GET  /admin/?game=…    → one game
//   GET  /admin/login      → to Sésame
//   GET  /admin/callback   → back from Sésame
//   POST /admin/logout     → the cookie cleared

export interface AdminEnv {
  /** Sésame's issuer, e.g. https://auth.steeve.website. */
  SESAME_ISSUER?: string;
  /** Tamalou's client id in Sésame. */
  SESAME_CLIENT_ID?: string;
  SESAME_CLIENT_SECRET?: string;
  /** Signs the admin's cookies: 32 characters or more. */
  ADMIN_SECRET?: string;
  /** The membership role that opens the page (default `admin`). */
  ADMIN_ROLE?: string;
}

export interface UsageStore {
  rows(since: string): Promise<UsageRow[]>;
}

const SESSION = '__Host-tamalou_admin';
const LOGIN = '__Host-tamalou_login';
const LOGIN_SECONDS = 600;

const HEADERS = {
  'content-type': 'text/html; charset=utf-8',
  'cache-control': 'no-store',
  'content-security-policy':
    "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
  'referrer-policy': 'no-referrer',
  'x-content-type-options': 'nosniff',
  'x-robots-tag': 'noindex, nofollow',
};

const html = (status: number, body: string, extra: Record<string, string> = {}) =>
  new Response(body, { status, headers: { ...HEADERS, ...extra } });

const redirect = (to: string, cookies: string[] = []) => {
  const headers = new Headers({ location: to, 'cache-control': 'no-store' });
  for (const c of cookies) headers.append('set-cookie', c);
  return new Response(null, { status: 302, headers });
};

const setCookie = (name: string, value: string, maxAge: number) =>
  `${name}=${value}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`;

interface Configured {
  issuer: URL;
  client: oauth.Client;
  auth: oauth.ClientAuth;
  secret: string;
  role: string;
}

function configured(env: AdminEnv): Configured | null {
  const { SESAME_ISSUER, SESAME_CLIENT_ID, SESAME_CLIENT_SECRET, ADMIN_SECRET } = env;
  if (!SESAME_ISSUER || !SESAME_CLIENT_ID || !SESAME_CLIENT_SECRET || !ADMIN_SECRET || ADMIN_SECRET.length < 32)
    return null;
  return {
    issuer: new URL(SESAME_ISSUER),
    client: { client_id: SESAME_CLIENT_ID },
    auth: oauth.ClientSecretBasic(SESAME_CLIENT_SECRET),
    secret: ADMIN_SECRET,
    role: env.ADMIN_ROLE || 'admin',
  };
}

/** Plain http only for an issuer on this machine (a local Sésame, the tests), as Sésame itself allows. */
const local = (issuer: URL) => issuer.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(issuer.hostname);
const requestOptions = (issuer: URL) => (local(issuer) ? { [oauth.allowInsecureRequests]: true } : {});

let discovered: { issuer: string; as: oauth.AuthorizationServer } | null = null;
async function server(issuer: URL): Promise<oauth.AuthorizationServer> {
  if (discovered?.issuer === issuer.href) return discovered.as;
  const as = await oauth.processDiscoveryResponse(issuer, await oauth.discoveryRequest(issuer, requestOptions(issuer)));
  discovered = { issuer: issuer.href, as };
  return as;
}

/** Answers every /admin request; `store` reads the usage events. */
export async function admin(request: Request, env: AdminEnv, store: UsageStore): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;
  if (path === '/admin') return redirect('/admin/');
  const cfg = configured(env);
  if (!cfg) {
    return html(
      503,
      messagePage(
        'Pas encore configurée',
        'La page d’administration attend ses réglages Sésame (SESAME_ISSUER, SESAME_CLIENT_ID, SESAME_CLIENT_SECRET, ADMIN_SECRET).',
      ),
    );
  }
  const redirectUri = `${url.origin}/admin/callback`;
  const now = Date.now();
  try {
    if (path === '/admin/login' && request.method === 'GET') {
      const as = await server(cfg.issuer);
      const verifier = oauth.generateRandomCodeVerifier();
      const state = oauth.generateRandomState();
      const nonce = oauth.generateRandomNonce();
      const to = new URL(as.authorization_endpoint ?? '');
      to.searchParams.set('client_id', cfg.client.client_id);
      to.searchParams.set('redirect_uri', redirectUri);
      to.searchParams.set('response_type', 'code');
      to.searchParams.set('scope', 'openid profile role');
      to.searchParams.set('code_challenge', await oauth.calculatePKCECodeChallenge(verifier));
      to.searchParams.set('code_challenge_method', 'S256');
      to.searchParams.set('state', state);
      to.searchParams.set('nonce', nonce);
      const login = await sign({ verifier, state, nonce, exp: Math.floor(now / 1000) + LOGIN_SECONDS }, cfg.secret);
      return redirect(to.href, [setCookie(LOGIN, login, LOGIN_SECONDS)]);
    }
    if (path === '/admin/callback' && request.method === 'GET') {
      const saved = (await unsign(cookie(request.headers.get('cookie'), LOGIN) ?? '', cfg.secret)) as {
        verifier?: string;
        state?: string;
        nonce?: string;
        exp?: number;
      } | null;
      if (!saved?.verifier || !saved.state || !saved.nonce || !saved.exp || saved.exp * 1000 <= now) {
        return html(
          400,
          messagePage('Connexion expirée', 'Recommence la connexion.', { href: 'login', label: 'Se connecter' }),
        );
      }
      const as = await server(cfg.issuer);
      const params = oauth.validateAuthResponse(as, cfg.client, url, saved.state);
      const response = await oauth.authorizationCodeGrantRequest(
        as,
        cfg.client,
        cfg.auth,
        params,
        redirectUri,
        saved.verifier,
        requestOptions(cfg.issuer),
      );
      const result = await oauth.processAuthorizationCodeResponse(as, cfg.client, response, {
        expectedNonce: saved.nonce,
        requireIdToken: true,
      });
      const claims = oauth.getValidatedIdTokenClaims(result);
      if (!claims || claims.role !== cfg.role) {
        return html(403, messagePage('Accès refusé', 'Ce compte Sésame n’a pas le rôle qui ouvre cette page.'), {
          'set-cookie': setCookie(LOGIN, '', 0),
        });
      }
      const name = typeof claims.name === 'string' ? claims.name : claims.sub;
      const session = await sign(sessionFor(claims.sub, name, now), cfg.secret);
      return redirect('/admin/', [setCookie(SESSION, session, SESSION_SECONDS), setCookie(LOGIN, '', 0)]);
    }
    if (path === '/admin/logout' && request.method === 'POST') {
      return html(
        200,
        messagePage('Déconnecté', 'La session d’administration est fermée.', {
          href: '/admin/',
          label: 'Se reconnecter',
        }),
        { 'set-cookie': setCookie(SESSION, '', 0) },
      );
    }
    if (path === '/admin/' && request.method === 'GET') {
      const session = await readSession(cookie(request.headers.get('cookie'), SESSION) ?? '', cfg.secret, now);
      if (!session) return redirect('/admin/login');
      // Days are Paris days: the owner reads the page in France (packages/shared usage.ts).
      const today = localTime(usageMinute(new Date(now))).day;
      const oldest = usageCutoff(today);
      const day = url.searchParams.get('day');
      if (day && /^\d{4}-\d{2}-\d{2}$/.test(day) && day >= oldest && day <= today) {
        // A Paris day straddles two UTC days: read from the one before.
        const rows = await store.rows(usageCutoff(day, 1));
        const prev = usageCutoff(day, 1);
        const next = usageCutoff(day, -1);
        return html(
          200,
          dayPage({
            day,
            summary: summarizeUsage(rows, day, 1),
            prev: prev >= oldest ? prev : null,
            next: next <= today ? next : null,
            who: session.name,
          }),
        );
      }
      const id = url.searchParams.get('game');
      if (id && /^[A-Za-z0-9_-]{8,32}$/.test(id)) {
        const games = usageGames(await store.rows(oldest));
        const game = games.find((g) => g.id === id);
        return game
          ? html(
              200,
              gamePage({
                game,
                device: game.deviceId ? deviceGames(games, game.deviceId) : null,
                who: session.name,
              }),
            )
          : html(
              404,
              messagePage('Partie introuvable', 'Elle a peut-être plus de 13 mois.', {
                href: '/admin/',
                label: 'Statistiques',
              }),
            );
      }
      const asked = Number(url.searchParams.get('days'));
      const days = (PERIODS as readonly number[]).includes(asked) ? asked : 30;
      const rows = await store.rows(usageCutoff(today, days));
      return html(200, adminPage({ summary: summarizeUsage(rows, today, days), days, who: session.name, version }));
    }
    return html(
      404,
      messagePage('Introuvable', 'Cette page d’administration n’existe pas.', {
        href: '/admin/',
        label: 'Statistiques',
      }),
    );
  } catch (error) {
    // A refused code, a provider that is down, a forged state: nothing is said about which.
    console.error('admin', error);
    return html(
      502,
      messagePage('La connexion a échoué', 'Sésame n’a pas pu confirmer qui tu es.', {
        href: 'login',
        label: 'Réessayer',
      }),
    );
  }
}

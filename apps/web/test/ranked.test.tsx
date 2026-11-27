// @vitest-environment jsdom
import { formatCode, Ladder, ladderRequest, nameText } from '@tamalou/ranking';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HomeScreen } from '../src/home/HomeScreen.tsx';
import { refreshProfile } from '../src/profile/avatar.ts';
import { historyFile, reloadHistory } from '../src/profile/history.ts';
import { RankedScreen } from '../src/ranked/RankedScreen.tsx';
import { rankedFromFile, rankedSecret, reloadRanked, saveRankedSecret } from '../src/ranked/store.ts';

// The «Classé» screen against the real ladder: fetch answers through packages/ranking over an in-memory SQLite, as the
// Worker's LadderObject does over its own.

let ladder: Ladder;
let up = true;

function serve() {
  // Read at run time: the browser-like test environment refuses to bundle a Node built-in.
  const { DatabaseSync } = process.getBuiltinModule('node:sqlite') as typeof import('node:sqlite');
  const db = new DatabaseSync(':memory:');
  ladder = new Ladder({ exec: <T,>(q: string, ...b: (string | number | null)[]) => db.prepare(q).all(...b) as T[] });
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      if (!up) throw new TypeError('offline');
      const op = /\/api\/ladder\/([a-z]+)$/.exec(url)?.[1] ?? '';
      const reply = await ladderRequest(ladder, op, JSON.parse(String(init?.body ?? 'null')), new Date());
      return new Response(reply.body === undefined ? null : JSON.stringify(reply.body), { status: reply.status });
    }),
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
beforeEach(() => {
  localStorage.clear();
  reloadRanked();
  reloadHistory();
  refreshProfile();
  up = true;
  serve();
});

const AVATAR = { color: 'teal', icon: 'moon' } as const;
const screenFor = () => render(<RankedScreen avatar={AVATAR} onClose={() => {}} />);

describe('the ranked profile', () => {
  it('is offered from the launch screen on the online server only', () => {
    const { unmount } = render(<HomeScreen onPlay={() => {}} online />);
    expect(screen.queryByRole('button', { name: /Classé/ })).toBeNull();
    unmount();
    render(<HomeScreen onPlay={() => {}} online ranked />);
    fireEvent.click(screen.getByRole('button', { name: /Classé/ }));
    expect(screen.getByRole('button', { name: 'Créer mon profil classé' })).toBeTruthy();
  });

  it('is created with a drawn name and a recovery code shown once, the secret kept on the device only', async () => {
    screenFor();
    fireEvent.click(screen.getByRole('button', { name: 'Créer mon profil classé' }));
    await screen.findByText('Note ton code de récupération');
    const secret = rankedSecret();
    expect(secret).toMatch(/^[0-9A-Z]{25}$/);
    expect(screen.getByText(formatCode(secret ?? ''))).toBeTruthy();
    const [stored] = ladder.exportFile(new Date()).players;
    expect(stored?.avatar).toEqual(AVATAR);
    expect(screen.getByText(nameText(stored?.name ?? ''))).toBeTruthy();
    expect(JSON.stringify(stored)).not.toContain(secret ?? '-');
    expect(screen.getByText('0 partie classée sur 10')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'C’est noté' }));
    expect(screen.queryByText(formatCode(secret ?? ''))).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Afficher' }));
    expect(screen.getByText(formatCode(secret ?? ''))).toBeTruthy();
  });

  it('comes back on another phone from its code typed loosely, and says when a code is unknown', async () => {
    screenFor();
    fireEvent.click(screen.getByRole('button', { name: 'Créer mon profil classé' }));
    await screen.findByText('Note ton code de récupération');
    const secret = rankedSecret() ?? '';
    const name = nameText(ladder.exportFile(new Date()).players[0]?.name ?? '');
    cleanup();
    localStorage.clear();
    reloadRanked();

    screenFor();
    fireEvent.click(screen.getByRole('button', { name: 'J’ai déjà un code' }));
    const input = screen.getByRole('textbox', { name: 'Ton code de récupération' });
    fireEvent.change(input, { target: { value: '00000-00000-00000-00000-00000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Retrouver mon profil' }));
    await screen.findByText('Aucun profil classé n’a ce code.');
    fireEvent.change(input, { target: { value: formatCode(secret).toLowerCase().replaceAll('-', ' ') } });
    fireEvent.click(screen.getByRole('button', { name: 'Retrouver mon profil' }));
    await screen.findByText(name);
    expect(rankedSecret()).toBe(secret);
  });

  it('draws another name, hands over the data and deletes the profile everywhere', async () => {
    saveRankedSecret('0123456789ABCDEFGHJKMNPQR');
    await ladderRequest(ladder, 'create', { secret: '0123456789ABCDEFGHJKMNPQR' }, new Date(), () => 0);
    screenFor();
    await screen.findByText('Deux Rusé 000');
    fireEvent.click(screen.getByRole('button', { name: 'Tirer un autre nom' }));
    await waitFor(() => expect(screen.queryByText('Deux Rusé 000')).toBeNull());

    const click = vi.fn();
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: () => 'blob:x', revokeObjectURL: () => {} }));
    HTMLAnchorElement.prototype.click = click;
    fireEvent.click(screen.getByRole('button', { name: 'Mes données' }));
    await waitFor(() => expect(click).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: 'Supprimer mon profil' }));
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer' }));
    await screen.findByText('Profil classé supprimé.');
    expect(rankedSecret()).toBeNull();
    expect(ladder.count()).toBe(0);
    expect(screen.getByRole('button', { name: 'Créer mon profil classé' })).toBeTruthy();
  });

  it('forgets a profile the server no longer has, and offers to retry when it does not answer', async () => {
    saveRankedSecret('0123456789ABCDEFGHJKMNPQR');
    screenFor();
    await screen.findByText(/Ton profil classé n’existe plus/);
    expect(rankedSecret()).toBeNull();
    cleanup();

    saveRankedSecret('0123456789ABCDEFGHJKMNPQR');
    await ladderRequest(ladder, 'create', { secret: '0123456789ABCDEFGHJKMNPQR' }, new Date(), () => 0);
    up = false;
    screenFor();
    await screen.findByText('Le serveur ne répond pas. Réessaie dans un instant.');
    up = true;
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    await screen.findByText('Deux Rusé 000');
  });

  it('travels in «Mes parties»’s saved file', () => {
    expect(rankedFromFile(historyFile([], '0123456789ABCDEFGHJKMNPQR'))).toBe('0123456789ABCDEFGHJKMNPQR');
    expect(rankedFromFile(historyFile([]))).toBeNull();
    expect(rankedFromFile('not json')).toBeNull();
  });
});

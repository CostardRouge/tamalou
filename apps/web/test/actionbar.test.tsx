// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { type Act, ActionBar } from '../src/game/ActionBar.tsx';

afterEach(cleanup);

const act = (key: string, extra: Partial<Act> = {}): Act => ({
  key,
  label: `label ${key}`,
  onClick: () => {},
  ...extra,
});

describe('the action bar', () => {
  it('draws the main action wide and the others as captioned icons named by their full label', () => {
    const take = vi.fn();
    render(
      <ActionBar
        acts={[
          act('deck', { icon: 'draw', main: true, tone: 'primary' }),
          act('take', { icon: 'take', caption: 'Défausse', onClick: take }),
          act('call', { icon: 'call', caption: 'Tamalou', tone: 'call' }),
        ]}
      />,
    );
    expect(screen.getByRole('button', { name: 'label deck' }).className).toContain('bar-main');
    const icon = screen.getByRole('button', { name: 'label take' });
    expect(icon.className).toContain('ibtn');
    expect(icon.textContent).toBe('Défausse');
    fireEvent.click(icon);
    expect(take).toHaveBeenCalledOnce();
  });

  it('makes the first action the wide one when none is marked, unless it is a plain choice', () => {
    const { rerender } = render(
      <ActionBar acts={[act('skip', { icon: 'skip' }), act('cancel', { icon: 'cancel' })]} />,
    );
    expect(screen.getByRole('button', { name: 'label skip' }).className).toContain('bar-main');
    rerender(<ActionBar acts={[act('ana'), act('ben'), act('cancel', { icon: 'cancel' })]} />);
    expect(screen.getByRole('button', { name: 'label ana' }).className).not.toContain('bar-main');
    expect(screen.getByRole('button', { name: 'label cancel' }).className).toContain('ibtn');
  });

  it('keeps a minor action an icon even alone, with the hint beside it, and drops the hint for a wide button', () => {
    const { rerender } = render(
      <ActionBar acts={[act('quick', { icon: 'quick', caption: 'Rapide', minor: true })]} hint="Ou touche l’éclair" />,
    );
    expect(screen.getByRole('button', { name: 'label quick' }).className).toContain('ibtn');
    expect(screen.getByText('Ou touche l’éclair')).toBeTruthy();
    rerender(<ActionBar acts={[act('deck', { icon: 'draw', main: true })]} hint="Ou touche l’éclair" />);
    expect(screen.queryByText('Ou touche l’éclair')).toBeNull();
  });
});

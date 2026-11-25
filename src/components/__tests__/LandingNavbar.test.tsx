import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import LandingNavbar from '../LandingNavbar';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it('reveals account links, returns keyboard focus on Escape and closes on outside interaction', () => {
  const fetch = vi.fn();
  vi.stubGlobal('fetch', fetch);
  render(<><LandingNavbar /><main tabIndex={-1}>Innehåll</main></>);
  const toggle = screen.getByRole('button', { name: 'Öppna meny' });
  const panel = document.getElementById(toggle.getAttribute('aria-controls')!)!;
  expect(panel).not.toBeVisible();
  fireEvent.click(toggle);
  const login = within(panel).getByRole('link', { name: 'Logga in' });
  expect(login).toHaveAttribute('href', '/login?mode=login');
  expect(within(panel).getByRole('link', { name: 'Kom igång gratis' })).toHaveAttribute('href', '/login?mode=register');
  login.focus();
  fireEvent.keyDown(login, { key: 'Escape' });
  expect(toggle).toHaveFocus();
  expect(toggle).toHaveAttribute('aria-expanded', 'false');
  expect(panel).not.toBeVisible();

  fireEvent.click(toggle);
  fireEvent.pointerDown(screen.getByRole('main'));
  expect(panel).not.toBeVisible();
  expect(fetch).not.toHaveBeenCalled();
});

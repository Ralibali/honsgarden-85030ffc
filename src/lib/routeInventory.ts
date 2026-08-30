/**
 * Typed façade over the canonical route inventory (routeInventory.mjs).
 * The .mjs module is the source of truth so Node build scripts can import
 * it without a TS transpile step; this wrapper gives the app types.
 */
// Sibling .mjs module has no bundled declarations; with noImplicitAny=false
// the import is allowed untyped and typed explicitly below.
import {
  ROUTE_REDIRECTS as REDIRECTS,
  STATIC_PUBLIC_ROUTES as STATIC_ROUTES,
  DYNAMIC_PUBLIC_ROUTES as DYNAMIC_ROUTES,
  APP_SHELL_ROUTES as APP_ROUTES,
  matchRoute as match,
  patternToRegExp as toRegExp,
  buildVercelRewrites as buildRewrites,
  buildVercelRedirects as buildRedirects,
} from './routeInventory.mjs';

export interface RouteRedirect {
  source: string;
  destination: string;
  statusCode: number;
}

export interface DynamicRoute {
  pattern: string;
  example: string;
  note?: string;
}

export interface AppShellRoute {
  pattern: string;
  example: string;
}

export type RouteMatch =
  | { kind: 'redirect'; destination: string; statusCode: number }
  | { kind: 'static'; route: string }
  | { kind: 'dynamic'; route: string }
  | { kind: 'app'; route: string }
  | { kind: 'notfound' };

export const ROUTE_REDIRECTS: RouteRedirect[] = REDIRECTS;
export const STATIC_PUBLIC_ROUTES: string[] = STATIC_ROUTES;
export const DYNAMIC_PUBLIC_ROUTES: DynamicRoute[] = DYNAMIC_ROUTES;
export const APP_SHELL_ROUTES: AppShellRoute[] = APP_ROUTES;

export const matchRoute: (pathname: string) => RouteMatch = match;
export const patternToRegExp: (pattern: string) => RegExp = toRegExp;
export const buildVercelRewrites: () => Array<{ source: string; destination: string }> = buildRewrites;
export const buildVercelRedirects: () => RouteRedirect[] = buildRedirects;

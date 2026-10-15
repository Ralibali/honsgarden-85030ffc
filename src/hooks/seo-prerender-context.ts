import { createContext } from 'react';
import type { SeoOptions } from './useSeo';

/** Request-scoped metadata collector; absent in the browser. */
export const SeoPrerenderContext = createContext<Partial<SeoOptions> | null>(null);

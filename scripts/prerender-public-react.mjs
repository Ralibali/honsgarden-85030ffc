import { build, loadConfigFromFile } from 'vite';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Public pages with shared client/server content. Interactive maps load on the client.
export async function createPublicRenderer() {
  const dir = resolve('node_modules/.cache/public-react');
  await mkdir(dir, { recursive: true });
  const entry = `
import React from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/hooks/useAuth';
import { TooltipProvider } from '@/components/ui/tooltip';
import { SeoPrerenderContext } from '@/hooks/seo-prerender-context';
import '@/i18n';
import About from '@/pages/About';
import SaljaAgg from '@/pages/SaljaAgg';
import Marketplace from '@/pages/Marketplace';
import EggCalculator from '@/pages/EggCalculator';
import StartCostCalculator from '@/pages/StartCostCalculator';
import AggReglerVagvisare from '@/pages/AggReglerVagvisare';
import HatchCalculator from '@/pages/HatchCalculator';
import HonsrasLanding from '@/pages/HonsrasLanding';
import Integritet from '@/pages/Integritet';
import Pricing from '@/pages/Prices';
export function render(route) {
 const meta = {};
 const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
 const html = renderToString(<SeoPrerenderContext.Provider value={meta}><QueryClientProvider client={client}><AuthProvider><TooltipProvider><MemoryRouter initialEntries={[route]}><Routes>
 <Route path="/om-oss" element={<About/>}/><Route path="/salja-agg" element={<SaljaAgg/>}/><Route path="/marknad" element={<Marketplace/>}/>
 <Route path="/verktyg/aggkalkylator" element={<EggCalculator/>}/><Route path="/verktyg/vad-kostar-hons" element={<StartCostCalculator/>}/><Route path="/verktyg/aggregler-vagvisare" element={<AggReglerVagvisare/>}/><Route path="/verktyg/klackningskalkylator" element={<HatchCalculator/>}/>
 <Route path="/honsraser" element={<HonsrasLanding slug="honsraser"/>}/><Route path="/honsraser-lista" element={<HonsrasLanding slug="honsraser-lista"/>}/><Route path="/honsraser/:slug" element={<HonsrasLanding/>}/>
 <Route path="/integritet" element={<Integritet/>}/><Route path="/priser" element={<Pricing/>}/>
 </Routes></MemoryRouter></TooltipProvider></AuthProvider></QueryClientProvider></SeoPrerenderContext.Provider>);
 client.clear();
 if (!/<h1[ >]/.test(html)) throw new Error('No first-byte H1 for ' + route);
 return { meta, html: html.replace(/opacity:0(?=[;\"])/g, 'opacity:1') };
}`;
  await writeFile(resolve(dir, 'entry.tsx'), entry);
  const loaded = await loadConfigFromFile({ command: 'build', mode: 'production' });
  await build({ configFile: false, logLevel: 'error', resolve: { alias: { '@': resolve('src') } }, define: loaded.config.define,
    esbuild: { jsx: 'automatic' }, build: { ssr: resolve(dir, 'entry.tsx'), outDir: resolve(dir, 'out'), emptyOutDir: true, rollupOptions: { output: { format: 'es', entryFileNames: 'entry.mjs' } } } });
  return (await import(pathToFileURL(resolve(dir, 'out/entry.mjs')).href)).render;
}

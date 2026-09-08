import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { isNativePlatform } from '@/lib/nativePlatform';
import { AVAILABLE_DIGITAL_PRODUCTS } from '@/lib/digitalProducts';

export default function DigitalProductShelf() {
  const { loading, isAuthenticated } = useAuth();
  if (loading || isAuthenticated || isNativePlatform()) return null;
  return <section aria-labelledby="pdf-shelf-title" className="mb-12 rounded-2xl border border-primary/15 bg-card p-5 sm:p-7">
    <p className="text-xs font-semibold uppercase tracking-widest text-primary">Hönsgårdens butik · Digitala PDF:er</p>
    <h2 id="pdf-shelf-title" className="mt-3 font-serif text-2xl">Ta nästa steg med en egen plan</h2>
    <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">Handböcker och arbetsblad att fylla i, spara och skriva ut. Varje produkt har ett gratis smakprov.</p>
    <div className="mt-6 grid gap-5 sm:grid-cols-2">{AVAILABLE_DIGITAL_PRODUCTS.map(product => <article key={product.slug} className="flex items-start gap-4 rounded-xl border border-border p-4">
      <img src={product.cover} alt={`Omslaget till ${product.title}`} width={76} height={108} loading="lazy" className="h-auto w-16 shrink-0 rounded border border-border" />
      <div className="min-w-0"><h3 className="font-serif text-lg">{product.title}</h3><p className="mt-1 text-xs text-muted-foreground">{product.pages} sidor · engångsköp</p><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{product.tagline}</p><Link to={`/guider/${product.slug}`} className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-primary underline">Se innehåll – {product.price} kr inkl. moms</Link></div>
    </article>)}</div>
  </section>;
}

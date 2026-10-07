import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

type Heading = { id: string; text: string; level: number };

/** The rendered article is authoritative, including async content and H3s. */
export default function ContentToc({ target, title = 'I den här guiden' }: { target: string; title?: string }) {
  const { pathname } = useLocation();
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [active, setActive] = useState('');
  useEffect(() => {
    const root = document.querySelector(target);
    if (!root) return;
    let nodes: HTMLElement[] = [];
    const collect = () => {
      nodes = Array.from(root.querySelectorAll<HTMLElement>('h2, h3')).filter(node => !node.closest('[data-content-toc]'));
      const used = new Set<string>();
      const next = nodes.map((node, index) => {
        const text = node.textContent?.trim() || `Avsnitt ${index + 1}`;
        const base = node.id || text.toLocaleLowerCase('sv-SE').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `avsnitt-${index + 1}`;
        let id = base;
        let suffix = 2;
        while (used.has(id) || (document.getElementById(id) && document.getElementById(id) !== node)) id = `${base}-${suffix++}`;
        used.add(id);
        node.id = id;
        node.style.scrollMarginTop = '7rem';
        return { id, text, level: Number(node.tagName.slice(1)) };
      });
      setHeadings(previous => JSON.stringify(previous) === JSON.stringify(next) ? previous : next);
    };
    let frame = 0;
    const updateActive = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const current = [...nodes].reverse().find(node => node.getBoundingClientRect().top <= 140) || nodes[0];
        setActive(current?.id || '');
      });
    };
    collect();
    updateActive();
    const observer = new MutationObserver(() => { collect(); updateActive(); });
    observer.observe(root, { childList: true, subtree: true, characterData: true });
    window.addEventListener('scroll', updateActive, { passive: true });
    return () => { observer.disconnect(); cancelAnimationFrame(frame); window.removeEventListener('scroll', updateActive); };
  }, [pathname, target]);
  if (!headings.length) return null;
  const links = <ol className="space-y-1">{headings.map(heading => <li key={heading.id}>
    <a href={`#${heading.id}`} aria-current={active === heading.id ? 'location' : undefined}
      className={`block rounded px-2 py-2 text-sm hover:underline focus-visible:outline focus-visible:outline-2 ${heading.level === 3 ? 'ml-3' : 'font-semibold'} ${active === heading.id ? 'bg-muted text-foreground' : 'text-muted-foreground'}`}>{heading.text}</a>
  </li>)}</ol>;
  return <aside data-content-toc className="content-toc min-w-0 self-start lg:sticky lg:top-28">
    <details className="rounded-xl border bg-card p-4 lg:hidden"><summary className="min-h-11 cursor-pointer font-semibold">{title}</summary><nav aria-label={title}>{links}</nav></details>
    <nav aria-label={title} className="hidden max-h-[calc(100vh-9rem)] overflow-y-auto rounded-xl border bg-card p-4 lg:block"><p className="mb-3 font-semibold">{title}</p>{links}</nav>
  </aside>;
}

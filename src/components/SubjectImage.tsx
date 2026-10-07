import type { SubjectImage as ImageData } from '@/lib/breedImage';
export default function SubjectImage({ image, alt }: { image: ImageData; alt: string }) {
  return <figure className="mb-8">
    <img src={image.src} srcSet={image.srcSet} sizes="(min-width: 1024px) 800px, 100vw" alt={image.alt || alt} width={1200} height={800} fetchPriority="high" className="aspect-video w-full rounded-2xl bg-muted/40 object-contain" />
    {image.caption && <figcaption className="mt-2 text-xs leading-relaxed text-muted-foreground">{image.caption}</figcaption>}
    {image.author && <figcaption className="mt-2 text-xs leading-relaxed text-muted-foreground break-words">Foto: {image.author} · <a href={image.source} className="underline" target="_blank" rel="noreferrer">Wikimedia Commons</a> · <a href={image.licenseUrl || image.source} className="underline" target="_blank" rel="noreferrer">{image.license}</a>. Storleksanpassad.</figcaption>}
  </figure>;
}

import { Facebook, Link2, Pin } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface Props {
  url: string;
  title: string;
  description?: string;
}

export default function ShareButtons({ url, title, description }: Props) {
  const encoded = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);

  const links = [
    {
      icon: Facebook,
      label: 'Facebook',
      href: `https://www.facebook.com/sharer/sharer.php?u=${encoded}`,
      color: 'hover:text-[#1877F2]',
    },
    {
      icon: Pin,
      label: 'Pinterest',
      href: `https://pinterest.com/pin/create/button/?url=${encoded}&description=${encodedTitle}`,
      color: 'hover:text-destructive',
    },
  ];

  const copyLink = async () => {
    await navigator.clipboard.writeText(url);
    toast({ title: 'Länk kopierad!' });
  };

  return (
    <div className="flex items-center gap-1">
      {links.map(l => (
        <a
          key={l.label}
          href={l.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Dela på ${l.label}`}
          className={`p-2 rounded-lg text-muted-foreground ${l.color} transition-colors`}
        >
          <l.icon className="h-4 w-4" />
        </a>
      ))}
      <button
        onClick={copyLink}
        aria-label="Kopiera länk"
        className="p-2 rounded-lg text-muted-foreground hover:text-primary transition-colors"
      >
        <Link2 className="h-4 w-4" />
      </button>
    </div>
  );
}

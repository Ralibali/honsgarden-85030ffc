import { useQuery } from '@tanstack/react-query';
import { signDiaryImages } from '@/lib/diaryMedia';
import { Button } from '@/components/ui/button';

export default function DiaryImages({ paths, onRemove, disabled = false }: { paths: string[]; onRemove?: (path: string) => void; disabled?: boolean }) {
  const { data = {}, isError, refetch } = useQuery({
    queryKey: ['diary-images', ...paths], queryFn: () => signDiaryImages(paths), enabled: paths.length > 0,
    staleTime: 4 * 60_000, refetchInterval: 5 * 60_000,
  });
  if (!paths.length) return null;
  return <div className="space-y-2">
    {isError && <p role="alert" className="text-sm">Bilderna kunde inte hämtas. <Button variant="link" onClick={() => void refetch()}>Försök igen</Button></p>}
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {paths.map((path, i) => <div key={path} className="space-y-1">
        {data[path] ? <a href={data[path]} target="_blank" rel="noreferrer" aria-label={`Öppna bild ${i + 1}`}><img src={data[path]} alt={`Dagboksbild ${i + 1}`} loading="lazy" className="aspect-square w-full rounded-xl object-cover" /></a> : <div className="aspect-square rounded-xl bg-muted flex items-center justify-center text-xs text-muted-foreground">{isError ? 'Bild ej tillgänglig' : 'Hämtar bild…'}</div>}
        {onRemove && <Button type="button" variant="outline" size="sm" className="w-full" disabled={disabled} onClick={() => onRemove(path)}>Ta bort bild {i + 1}</Button>}
      </div>)}
    </div>
  </div>;
}

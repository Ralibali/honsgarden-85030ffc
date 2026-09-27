import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { diaryHenIds, DIARY_MILESTONES } from '@/lib/diary';
import { DIARY_IMAGE_LIMIT, validateDiaryFile, uploadDiaryImage, removeDiaryImages } from '@/lib/diaryMedia';
import imageCompression from 'browser-image-compression';
import HenPicker from './HenPicker';
import DiaryImages from './DiaryImages';
import VoiceDraft from './VoiceDraft';
import { Loader2, Check } from 'lucide-react';
import { api, type HealthLog } from '@/lib/api';
import { todayLocal } from '@/lib/datetime';
import { trackEvent } from '@/lib/analytics';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry?: HealthLog | null;
  demo?: boolean;
  defaultHenId?: string;
}

export default function DiaryEditor({ open, onOpenChange, entry, demo = false, defaultHenId }: Props) {
  const client = useQueryClient();
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(todayLocal);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [error, setError] = useState('');
  const [voiceDirty, setVoiceDirty] = useState(false);
  const [henIds, setHenIds] = useState<string[]>([]);
  const [milestone, setMilestone] = useState('');
  const [imagePaths, setImagePaths] = useState<string[]>([]);
  const [files, setFiles] = useState<{ file: File; preview: string }[]>([]);
  const fileRef = useRef(files);
  fileRef.current = files;
  const uploaded = useRef(new Map<File, string>());
  const draftId = useRef('');
  const { data: hens = [], isError: hensError, isPending: hensLoading, refetch: reloadHens } = useQuery({ queryKey: ['farm-hens'], queryFn: () => api.getFarmHens(), enabled: open });
  const clearPending = useCallback(() => {
    for (const item of fileRef.current) URL.revokeObjectURL(item.preview);
    // An interrupted request may still commit on the server. Never delete uploads
    // on close/unmount; a successful subsequent save or account cleanup removes leftovers.
    uploaded.current.clear();
  }, []);
  useEffect(() => () => { clearPending(); }, [clearPending]);


  useEffect(() => {
    if (!open) return;
    setDescription(entry?.description ?? '');
    setDate(entry?.date ?? todayLocal());
    clearPending();
    setFiles([]);
    draftId.current = entry?.id ?? crypto.randomUUID();
    setHenIds(entry ? diaryHenIds(entry) : defaultHenId ? [defaultHenId] : []);
    setMilestone(entry?.milestone ?? '');
    setImagePaths(entry?.image_paths ?? []);
    setDiscardOpen(false);
    setError(''); setVoiceDirty(false);
  }, [open, entry, defaultHenId, clearPending]);

  const save = useMutation({
    mutationFn: async () => {
      const additions: string[] = [];
      for (const { file } of files) {
        let path = uploaded.current.get(file);
        if (!path) {
          if (demo) {
            const compressed = await imageCompression(file, { maxSizeMB: 1, maxWidthOrHeight: 1600, useWebWorker: true });
            path = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(compressed); });
          } else path = await uploadDiaryImage(draftId.current, file);
          uploaded.current.set(file, path);
        }
        additions.push(path);
      }
      return api.saveDiaryEntry({ id: draftId.current, isNew: !entry, date, description: description.trim(),
        henIds, imagePaths: [...imagePaths, ...additions], milestone: milestone || null });
    },
    onSuccess: () => {
      const retained = new Set([...imagePaths, ...files.map(item => uploaded.current.get(item.file)).filter(Boolean)]);
      const detached = [...(entry?.image_paths ?? []), ...uploaded.current.values()].filter(path => !retained.has(path));
      uploaded.current.clear();
      if (!demo) void removeDiaryImages(detached).catch(() => { /* Entry remains valid if detached-file cleanup fails. */ });
      void client.invalidateQueries({ queryKey: ['health-logs'] });
      void client.invalidateQueries({ queryKey: ['hen-profile'] });
      if (!demo) trackEvent('Diary Entry Saved', { action: entry ? 'edit' : 'create' });
      else trackEvent('Demo Feature Used', { feature: 'diary' });
      toast({ title: demo ? 'Tillagt i demon – inget sparas till ett konto' : entry ? 'Dagboksinlägget är uppdaterat' : 'Sparat i din dagbok' });
      onOpenChange(false);
    },
    onError: () => setError('Det gick inte att spara. Din text finns kvar här. Kontrollera uppkopplingen och försök igen.'),
  });

  function addFiles(list: FileList | null) {
    if (!list) return;
    const next = Array.from(list);
    if (imagePaths.length + files.length + next.length > DIARY_IMAGE_LIMIT) { setError('Du kan lägga till högst fem bilder per inlägg.'); return; }
    const invalid = next.map(validateDiaryFile).find(Boolean);
    if (invalid) { setError(invalid); return; }
    setError('');
    setFiles(current => [...current, ...next.map(file => ({ file, preview: URL.createObjectURL(file) }))]);
  }
  function close() {
    if (save.isPending) return;
    const dirty = description !== (entry?.description ?? '') || date !== (entry?.date ?? todayLocal());
    const extrasDirty = milestone !== (entry?.milestone ?? '') || JSON.stringify(henIds) !== JSON.stringify(entry ? diaryHenIds(entry) : defaultHenId ? [defaultHenId] : []) || files.length > 0 || JSON.stringify(imagePaths) !== JSON.stringify(entry?.image_paths ?? []);
    if (dirty || voiceDirty || extrasDirty) setDiscardOpen(true);
    else onOpenChange(false);
  }

  return <>
    <Dialog open={open} onOpenChange={(next) => next ? onOpenChange(true) : close()}>
      <DialogContent data-private-content className="max-w-lg max-h-[90dvh] overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">{entry ? 'Redigera inlägg' : 'En stund i hönsgården'}</DialogTitle>
          <DialogDescription>Spara små minnen och sådant du vill komma ihåg om flocken.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); if (description.trim() && date && !save.isPending && !voiceDirty) { setError(''); save.mutate(); } }}>
          <div className="space-y-2"><Label htmlFor="diary-date">Datum</Label><Input id="diary-date" type="date" required value={date} onChange={(event) => setDate(event.target.value)} disabled={save.isPending} /></div>
          <div className="space-y-2">
            <Label htmlFor="diary-text">Vad hände i hönsgården?</Label>
            <Textarea id="diary-text" autoFocus required value={description} onChange={(event) => setDescription(event.target.value)} disabled={save.isPending} rows={7} className="resize-y text-base leading-relaxed" placeholder="Första ägget från en unghöna, en ny rutin eller bara en fin stund med flocken…" aria-describedby={error ? 'diary-save-error' : undefined} />
          </div>
          <div className="space-y-2"><Label htmlFor="diary-milestone">Milstolpe (valfritt)</Label>
            <select id="diary-milestone" value={milestone} onChange={e => setMilestone(e.target.value)} disabled={save.isPending} className="w-full h-11 rounded-md border bg-background px-3 text-sm">
              <option value="">Vanligt dagboksinlägg</option>{Object.entries(DIARY_MILESTONES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
          {hensError ? <p role="alert" className="text-sm">Individerna kunde inte hämtas. Dina tidigare val finns kvar. <Button type="button" variant="link" onClick={() => void reloadHens()}>Försök igen</Button></p> : hensLoading ? <p role="status" className="text-sm text-muted-foreground">Hämtar individer…</p> : <HenPicker label="Vilka var med?" hens={hens} selected={henIds} onChange={setHenIds} disabled={save.isPending} />}
          <p className="text-xs text-muted-foreground">Inlägget visas också på valda individers profiler. Utan val hör det till den gemensamma dagboken.</p>
          <div className="space-y-3">
            <Label htmlFor="diary-photos">Bilder (högst fem)</Label>
            <Input id="diary-photos" type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={save.isPending || imagePaths.length + files.length >= DIARY_IMAGE_LIMIT} onChange={e => { addFiles(e.target.files); e.target.value = ''; }} />
            <p className="text-xs text-muted-foreground">JPG, PNG eller WebP. Bilderna anpassas automatiskt för dagboken.</p>
            <DiaryImages paths={imagePaths} disabled={save.isPending} onRemove={path => setImagePaths(current => current.filter(p => p !== path))} />
            <div className="grid grid-cols-2 gap-2">{files.map((item, index) => <div key={item.preview} className="space-y-1"><img src={item.preview} alt={`Ny bild ${index + 1}`} className="aspect-square object-cover rounded-xl w-full" /><Button type="button" variant="outline" size="sm" disabled={save.isPending} className="w-full" onClick={() => {
              URL.revokeObjectURL(item.preview);
              setFiles(current => current.filter(f => f !== item));
              // Keep a failed attempt's upload until the next confirmed save: it may
              // already be referenced by a request whose response was lost.
            }}>Ta bort ny bild {index + 1}</Button></div>)}</div>
          </div>
          {open && <VoiceDraft onDirtyChange={setVoiceDirty} disabled={save.isPending} onUse={text => setDescription(current => [current.trim(), text].filter(Boolean).join("\n\n"))} />}
          {error && <p id="diary-save-error" role="alert" className="text-sm text-destructive">{error}</p>}
          <div className="flex flex-wrap gap-2 justify-end">
            <Button type="button" variant="outline" disabled={save.isPending} onClick={close}>Avbryt</Button>
            <Button type="submit" disabled={!description.trim() || !date || save.isPending || voiceDirty} className="gap-2 min-h-11">
              {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {save.isPending ? 'Sparar…' : demo ? 'Prova att spara' : 'Spara inlägg'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
    <AlertDialog open={discardOpen} onOpenChange={setDiscardOpen}>
      <AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle>Stäng utan att spara?</AlertDialogTitle><AlertDialogDescription>Du har ändringar som inte är sparade.</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel>Fortsätt skriva</AlertDialogCancel><AlertDialogAction onClick={() => { setDiscardOpen(false); clearPending(); onOpenChange(false); }}>Kasta ändringar</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>;
}

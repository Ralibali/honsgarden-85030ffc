import { describe, expect, it, vi } from 'vitest';
import { cleanupDiaryPhotos } from '../../../supabase/functions/_shared/cleanup-diary-photos';
function setup() {
  const eq=vi.fn();
  const range=vi.fn().mockResolvedValue({data:[{image_paths:['another-uploader/owned-entry/photo.jpg']}],error:null});
  const list=vi.fn().mockImplementation(async (folder:string) => ({data:folder==='owner' ? [{name:'draft',id:null}] : [{name:'unfinished.jpg',id:'object'}],error:null}));
  const remove=vi.fn().mockResolvedValue({error:null});
  eq.mockReturnValue({order:()=>({range})});
  const from=vi.fn(()=>({select:()=>({eq})}));
  const bucket=vi.fn((_bucket: string)=>({list,remove}));
  return {client:{from,storage:{from:bucket}},eq,range,list,remove,bucket};
}
describe('Diary cleanup on account deletion', () => {
  it('removes images on owned entries and own unfinished uploads without listing other accounts', async () => {
    const m=setup(); await cleanupDiaryPhotos(m.client,'owner');
    expect(m.eq).toHaveBeenCalledWith('user_id','owner');
    expect(m.list.mock.calls.map(call=>call[0])).toEqual(['owner','owner/draft']);
    expect(m.remove).toHaveBeenCalledWith(['another-uploader/owned-entry/photo.jpg','owner/draft/unfinished.jpg']);
    expect(m.bucket.mock.calls.every(call=>call[0]==='diary-photos')).toBe(true);
  });
  it('does not delete anything when gathering the full inventory fails', async () => {
    const m=setup(); m.list.mockResolvedValueOnce({data:null,error:new Error('offline')});
    await expect(cleanupDiaryPhotos(m.client,'owner')).rejects.toThrow('offline');
    expect(m.remove).not.toHaveBeenCalled();
  });
  it('paginates entries and fails instead of reporting a partial deletion as success', async () => {
    const m=setup(); m.range.mockResolvedValueOnce({data:Array.from({length:500},()=>({image_paths:[]})),error:null});
    m.remove.mockResolvedValueOnce({error:new Error('remove failed')});
    await expect(cleanupDiaryPhotos(m.client,'owner')).rejects.toThrow('remove failed');
    expect(m.range.mock.calls).toEqual([[0,499],[500,999]]);
  });
});

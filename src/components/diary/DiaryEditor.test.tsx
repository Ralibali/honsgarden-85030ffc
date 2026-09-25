import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import DiaryEditor from './DiaryEditor';
import { api } from '@/lib/api';
import { uploadDiaryImage, removeDiaryImages } from '@/lib/diaryMedia';
vi.mock('@/lib/api', () => ({ api: { getFarmHens: vi.fn(), saveDiaryEntry: vi.fn() } }));
vi.mock('@/lib/diaryMedia', () => ({ DIARY_IMAGE_LIMIT: 5, validateDiaryFile: (f: File) => f.type === 'image/jpeg' ? null : 'Välj en bild i JPG-, PNG- eller WebP-format.', uploadDiaryImage: vi.fn(), removeDiaryImages: vi.fn(), signDiaryImages: vi.fn().mockResolvedValue({}) }));
vi.mock('@/lib/analytics', () => ({ trackEvent: vi.fn() }));
vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn() }));
vi.mock('./VoiceDraft', () => ({ default: () => null }));
function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const close = vi.fn();
  render(<QueryClientProvider client={client}><DiaryEditor open onOpenChange={close} defaultHenId="hen-1" /></QueryClientProvider>);
  return close;
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:preview'), revokeObjectURL: vi.fn() }));
  vi.mocked(api.getFarmHens).mockResolvedValue([{ id: 'hen-1', name: 'Blomma' }] as never);
  vi.mocked(api.saveDiaryEntry).mockResolvedValue({} as never);
  vi.mocked(uploadDiaryImage).mockResolvedValue('owner/entry/photo.jpg');
  vi.mocked(removeDiaryImages).mockResolvedValue(undefined);
});
describe('Diary photo save recovery', () => {
  it('keeps attachments after save failure and retries with the same ID and upload', async () => {
    vi.mocked(api.saveDiaryEntry).mockRejectedValueOnce(new Error('network'));
    const close = setup();
    fireEvent.change(screen.getByLabelText('Vad hände i hönsgården?'), { target: { value: 'En stund med Blomma' } });
    fireEvent.change(screen.getByLabelText('Bilder (högst fem)'), { target: { files: [new File(['image'], 'photo.jpg', { type: 'image/jpeg' })] } });
    fireEvent.click(screen.getByRole('button', { name: 'Spara inlägg' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Din text finns kvar här');
    expect(screen.getByAltText('Ny bild 1')).toBeInTheDocument();
    expect(close).not.toHaveBeenCalled();
    expect(removeDiaryImages).not.toHaveBeenCalled();
    const first = vi.mocked(api.saveDiaryEntry).mock.calls[0][0];
    expect(first).toMatchObject({ henIds: ['hen-1'], imagePaths: ['owner/entry/photo.jpg'] });
    fireEvent.click(screen.getByRole('button', { name: 'Spara inlägg' }));
    await waitFor(() => expect(close).toHaveBeenCalledWith(false));
    expect(api.saveDiaryEntry).toHaveBeenLastCalledWith(first);
    expect(uploadDiaryImage).toHaveBeenCalledTimes(1);
  });
  it('rejects more than five files and unsupported formats before upload', async () => {
    setup();
    const input = screen.getByLabelText('Bilder (högst fem)');
    fireEvent.change(input, { target: { files: Array.from({length:6}, (_,i) => new File(['x'], `${i}.jpg`, { type: 'image/jpeg' })) } });
    expect(await screen.findByRole('alert')).toHaveTextContent('högst fem bilder');
    fireEvent.change(input, { target: { files: [new File(['x'], 'file.svg', { type: 'image/svg+xml' })] } });
    expect(await screen.findByRole('alert')).toHaveTextContent('JPG-, PNG- eller WebP');
    expect(uploadDiaryImage).not.toHaveBeenCalled();
  });
});

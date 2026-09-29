import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pickImageNative, pickImagesNative } from '../nativeImagePicker';

const mocks = vi.hoisted(() => ({ native: vi.fn(), photo: vi.fn(), images: vi.fn() }));
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: mocks.native } }));
vi.mock('@capacitor/camera', () => ({
  Camera: { getPhoto: mocks.photo, pickImages: mocks.images },
  CameraResultType: { Uri: 'uri' },
  CameraSource: { Camera: 'CAMERA', Photos: 'PHOTOS', Prompt: 'PROMPT' },
}));

describe('native photo selection', () => {
  afterEach(() => { vi.unstubAllGlobals(); });
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.native.mockReturnValue(true);
    mocks.photo.mockResolvedValue({ webPath: 'capacitor://local-photo', format: 'jpeg' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ blob: async () => new Blob(['photo'], { type: 'image/jpeg' }) }));
  });
  it('keeps the browser file input available without invoking a native picker', async () => {
    mocks.native.mockReturnValue(false);
    expect(await pickImageNative()).toBeNull();
    expect(await pickImagesNative()).toBeNull();
    expect(mocks.photo).not.toHaveBeenCalled();
    expect(mocks.images).not.toHaveBeenCalled();
  });
  it('retains camera capture and converts the returned local photo into an upload file', async () => {
    const file = await pickImageNative('camera');
    expect(mocks.photo).toHaveBeenCalledWith(expect.objectContaining({
      source: 'CAMERA', resultType: 'uri', saveToGallery: false,
    }));
    expect(file).toBeInstanceOf(File);
    expect(file?.type).toBe('image/jpeg');
    expect(file?.name).toMatch(/\.jpg$/);
  });
  it('lets users cancel multiple selection without reopening the single-photo picker', async () => {
    mocks.images.mockRejectedValue({ message: 'User cancelled photos app' });
    expect(await pickImagesNative()).toEqual([]);
    expect(mocks.photo).not.toHaveBeenCalled();
  });
  it('recovers unavailable multiple selection through the photo library', async () => {
    mocks.images.mockRejectedValue(new Error('Multiple selection unavailable'));
    const files = await pickImagesNative();
    expect(files).toHaveLength(1);
    expect(mocks.photo).toHaveBeenCalledWith(expect.objectContaining({ source: 'PHOTOS' }));
  });
});

import { describe, it, expect, vi } from 'vitest';
import { mapAppPathToDemoFeature, trackDemoNavigation } from '../demoHandoff';

describe('mapAppPathToDemoFeature', () => {
  it.each([
    ['/app/eggs', 'egg_log'],
    ['/app/hens', 'hens'],
    ['/app/hens/abc-123', 'hens'],
    ['/app/calendar', 'calendar'],
    ['/app/tasks', 'calendar'],
    ['/app/reminders', 'calendar'],
    ['/app/hatching', 'calendar'],
    ['/app/community', 'marketplace'],
    ['/app/agda', 'agda_preview'],
    ['/app/statistics', 'reports_preview'],
    ['/app/weekly-report', 'reports_preview'],
    ['/app/year-report', 'reports_preview'],
  ])('mappar %s → %s', (path, expected) => {
    expect(mapAppPathToDemoFeature(path)).toBe(expected);
  });

  it('ignorerar querystrings', () => {
    expect(mapAppPathToDemoFeature('/app/eggs?tab=vecka')).toBe('egg_log');
  });

  it('returnerar undefined för icke-app-sidor och omappade app-sidor', () => {
    expect(mapAppPathToDemoFeature('/demo')).toBeUndefined();
    expect(mapAppPathToDemoFeature('/blogg')).toBeUndefined();
    expect(mapAppPathToDemoFeature('/app/settings')).toBeUndefined();
    expect(mapAppPathToDemoFeature('')).toBeUndefined();
  });
});

describe('trackDemoNavigation', () => {
  function fakeHistory() {
    const calls: string[] = [];
    const fake = {
      pushState(_data: unknown, _unused: string, url?: string | URL | null) {
        calls.push(String(url ?? ''));
      },
      calls,
    };
    return fake as unknown as History & { calls: string[] };
  }

  it('avlossar feature-event en gång per feature och handoff en gång', () => {
    const history = fakeHistory();
    const onFeatureUsed = vi.fn();
    const onHandoff = vi.fn();
    const uninstall = trackDemoNavigation({ onFeatureUsed, onHandoff }, history);

    history.pushState(null, '', '/app/eggs');
    history.pushState(null, '', '/app/eggs'); // dubblett — ska inte räknas två gånger
    history.pushState(null, '', '/app/agda');
    history.pushState(null, '', '/app/settings'); // omappad — bara handoff (redan skjuten)

    expect(onFeatureUsed.mock.calls).toEqual([['egg_log'], ['agda_preview']]);
    expect(onHandoff).toHaveBeenCalledTimes(1);
    expect(history.calls).toHaveLength(4); // navigeringen gick alltid fram
    uninstall();
  });

  it('återställer original-pushState vid uninstall', () => {
    const history = fakeHistory();
    const original = history.pushState;
    const uninstall = trackDemoNavigation({ onFeatureUsed: vi.fn(), onHandoff: vi.fn() }, history);
    expect(history.pushState).not.toBe(original);
    uninstall();
    expect(history.pushState).toBe(original);
  });

  it('stör inte navigeringen om en callback kastar', () => {
    const history = fakeHistory();
    const uninstall = trackDemoNavigation(
      {
        onFeatureUsed: () => { throw new Error('analytics nere'); },
        onHandoff: () => { throw new Error('analytics nere'); },
      },
      history,
    );
    expect(() => history.pushState(null, '', '/app/eggs')).not.toThrow();
    expect(history.calls).toEqual(['/app/eggs']);
    uninstall();
  });
});

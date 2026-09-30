import {
  inferSearchServiceStyle,
  normalizeSearchServiceStyle,
  resolveSearchServiceStyle,
} from '@/lib/search-tele-style';

describe('search tele style', () => {
  it('normalizes every tele spelling to tele', () => {
    for (const raw of ['tele', 'TELE', 'video', 'video_consultation', 'Video Consult', 'online', 'tele-consult']) {
      expect(normalizeSearchServiceStyle(raw)).toBe('tele');
    }
  });

  it('keeps physical styles as-is', () => {
    expect(normalizeSearchServiceStyle('at_center')).toBe('at_center');
    expect(normalizeSearchServiceStyle('At Home')).toBe('at_home');
    expect(normalizeSearchServiceStyle('')).toBe('');
    expect(normalizeSearchServiceStyle(undefined)).toBe('');
  });

  it('infers tele from service metadata or name when style is missing', () => {
    expect(inferSearchServiceStyle({ name: 'Consultation', metadata: { service_style: 'video' } })).toBe('tele');
    expect(inferSearchServiceStyle({ name: 'Video Consultation' })).toBe('tele');
    expect(inferSearchServiceStyle({ name: 'Teleconsult - General' })).toBe('tele');
    expect(inferSearchServiceStyle({ name: 'Online consultation' })).toBe('tele');
  });

  it('does not infer tele for clinic services', () => {
    expect(inferSearchServiceStyle({ name: 'General Checkup' })).toBe('');
    expect(inferSearchServiceStyle({ name: 'Vaccination', metadata: { service_style: 'at_center' } })).toBe('at_center');
  });

  it('prefers the explicit style over inference', () => {
    expect(resolveSearchServiceStyle('at_center', { name: 'Video Consultation' })).toBe('at_center');
    expect(resolveSearchServiceStyle(undefined, { name: 'Video Consultation' })).toBe('tele');
    expect(resolveSearchServiceStyle(undefined, { name: 'Checkup' })).toBeUndefined();
  });
});

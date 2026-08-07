import {
  buildServiceDescriptionPreview,
  countNonEmptyLines,
  shouldShowServiceDescriptionViewMore,
  stripTrailingEllipsisDots,
} from '../service-description-preview';

describe('service-description-preview', () => {
  describe('countNonEmptyLines', () => {
    it('counts non-empty newline-separated lines', () => {
      expect(countNonEmptyLines('CT Scan\nMRI Scan')).toBe(2);
      expect(countNonEmptyLines('a\nb\nc')).toBe(3);
      expect(countNonEmptyLines('  \n line \n')).toBe(1);
    });
  });

  describe('shouldShowServiceDescriptionViewMore', () => {
    it('shows for catalogue Includes lists with 3+ lines even when compact is short', () => {
      const stripped = 'Includes Physical\nexamination of anal\nglands';
      const compact = stripped.replace(/\s+/g, ' ').trim();
      expect(compact.length).toBeLessThanOrEqual(48);
      expect(shouldShowServiceDescriptionViewMore(stripped, compact)).toBe(true);
    });

    it('does not show for exactly 2 lines', () => {
      const stripped = 'CT Scan\nMRI Scan';
      const compact = 'CT Scan MRI Scan';
      expect(shouldShowServiceDescriptionViewMore(stripped, compact)).toBe(false);
    });

    it('shows for long single-line copy', () => {
      const stripped =
        'A small electronic chip (about the size of a grain of rice) is implanted under your pet\'s skin';
      expect(shouldShowServiceDescriptionViewMore(stripped, stripped)).toBe(true);
    });
  });

  describe('buildServiceDescriptionPreview', () => {
    it('Walker Includes-style: 3+ lines, compact ≤48 → showViewMore true', () => {
      const raw = 'Shampoo bath\nBlow drying\nBrushing\nEar cleaning\nNail trimming';
      const result = buildServiceDescriptionPreview(raw);
      expect(result.showViewMore).toBe(true);
      expect(result.preview).not.toContain('\n');
      expect(result.modalText).toBe(raw);
    });

    it('48–66 compact chars → truncated preview with ellipsis', () => {
      const raw =
        'Manual expression of anal glands to relieve discomfort, prevent infection';
      const result = buildServiceDescriptionPreview(raw);
      expect(result.showViewMore).toBe(true);
      expect(result.preview.endsWith('…')).toBe(true);
      expect(result.preview.length).toBeLessThan(raw.replace(/\s+/g, ' ').length);
    });

    it('Fauna microchip-style long paragraph → truncated preview + full modal', () => {
      const raw =
        'A small electronic chip (about the size of a grain of rice) is implanted under your pet\'s skin for permanent identification. It helps recover lost pets.';
      const result = buildServiceDescriptionPreview(raw);
      expect(result.showViewMore).toBe(true);
      expect(result.preview.endsWith('…')).toBe(true);
      expect(result.modalText).toBe(raw);
    });

    it('2 lines only → no View more', () => {
      const raw = 'CT Scan\nMRI Scan';
      const result = buildServiceDescriptionPreview(raw);
      expect(result.showViewMore).toBe(false);
      expect(result.preview).toBe(raw);
    });

    it('strips trailing admin dots and still shows View more for multi-line diagnostics', () => {
      const raw = 'Complete Blood Count\n(CBC) Haemoglobin (Hb)\nPacked Cell Volume......';
      const stripped = stripTrailingEllipsisDots(raw.trim());
      expect(stripped.endsWith('......')).toBe(false);
      const result = buildServiceDescriptionPreview(raw);
      expect(result.showViewMore).toBe(true);
      expect(result.lineCount).toBe(3);
    });

    it('Vet Included list (3 lines) → showViewMore true', () => {
      const raw = 'Physical examination\nWeight assessment\nGrowth milestone review';
      const result = buildServiceDescriptionPreview(raw);
      expect(result.showViewMore).toBe(true);
      expect(result.preview.endsWith('…')).toBe(true);
    });

    it('returns empty preview for blank input', () => {
      expect(buildServiceDescriptionPreview('   ')).toEqual({
        preview: '',
        showViewMore: false,
        modalText: '',
        compact: '',
        lineCount: 0,
      });
    });
  });
});

import { describe, it, expect } from 'vitest';
import { formatDuration, PREVIEW_LIMIT_SECONDS } from '../Tracklist';

describe('formatDuration', () => {
  it('should format seconds as M:SS', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(30)).toBe('0:30');
    expect(formatDuration(65)).toBe('1:05');
  });

  it('should pad seconds to two digits', () => {
    expect(formatDuration(9)).toBe('0:09');
    expect(formatDuration(3599)).toBe('59:59');
  });

  it('should handle minutes beyond 59', () => {
    expect(formatDuration(3661)).toBe('61:01');
  });
});

describe('PREVIEW_LIMIT_SECONDS', () => {
  it('should be a 10-second preview', () => {
    expect(PREVIEW_LIMIT_SECONDS).toBe(10);
  });

  it('should format as 0:10 for the UI display', () => {
    expect(formatDuration(PREVIEW_LIMIT_SECONDS)).toBe('0:10');
  });
});

import type { CavemanMode } from './types';

export function applyCavemanPolicy(input: string, mode: CavemanMode): string {
  if (mode === 'off') return input;

  const segments = input.split(/(```[\s\S]*?```)/g);
  return segments
    .map(segment => {
      if (segment.startsWith('```')) return segment;
      return segment
        .split('\n')
        .map(line => line.trimEnd())
        .join('\n')
        .replace(/\n{3,}/g, '\n\n');
    })
    .join('');
}

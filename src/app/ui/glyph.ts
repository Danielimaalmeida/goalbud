import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Placeholder goal icons. Stand-ins for the ~30-icon set that gets drawn
 * as part of the design system; same slot, same tint, swap the paths later.
 */
export const GLYPHS = [
  'dot', 'ring', 'square', 'diamond', 'bars', 'columns',
  'triangle', 'plus', 'wave', 'moon', 'star', 'leaf',
] as const;
export type GlyphName = (typeof GLYPHS)[number];

@Component({
  selector: 'app-glyph',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[style.--s.px]': 'size()' },
  template: `
    <svg [attr.width]="size()" [attr.height]="size()" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      @switch (name()) {
        @case ('ring') { <circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" stroke-width="4" /> }
        @case ('square') { <rect x="2" y="2" width="16" height="16" rx="4" /> }
        @case ('diamond') { <rect x="3.5" y="3.5" width="13" height="13" rx="2.5" transform="rotate(45 10 10)" /> }
        @case ('bars') { <rect x="1" y="3" width="18" height="5.5" rx="2.75" /><rect x="1" y="11.5" width="18" height="5.5" rx="2.75" /> }
        @case ('columns') { <rect x="3" y="1" width="5.5" height="18" rx="2.75" /><rect x="11.5" y="1" width="5.5" height="18" rx="2.75" /> }
        @case ('triangle') { <path d="M10 2.5 18 17H2z" stroke-linejoin="round" stroke="currentColor" stroke-width="2" /> }
        @case ('plus') { <rect x="7.5" y="1.5" width="5" height="17" rx="2.5" /><rect x="1.5" y="7.5" width="17" height="5" rx="2.5" /> }
        @case ('wave') { <path d="M1 12c3-6 6-6 9 0s6 6 9 0" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" /> }
        @case ('moon') { <path d="M13 2a8 8 0 1 0 5 14A7 7 0 0 1 13 2z" /> }
        @case ('star') { <path d="M10 1.5l2.6 5.6 6.1.7-4.5 4.2 1.2 6L10 15l-5.4 3 1.2-6L1.3 7.8l6.1-.7z" /> }
        @case ('leaf') { <path d="M3 17C3 8 9 3 17 3c0 8-5 14-14 14zm0 0L12 8" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linejoin="round" /> }
        @default { <circle cx="10" cy="10" r="8" /> }
      }
    </svg>
  `,
  styles: `:host { display: inline-flex; line-height: 0; }`,
})
export class Glyph {
  readonly name = input<string | null>(null);
  readonly size = input(20);
}

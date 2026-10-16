import type { Card } from '@tamalou/shared';
import type { ComponentType } from 'react';

// The one place that knows what a card looks like (ADR-0007). The owner designs his own decks in another project: a
// deck of his plugs in as another CardTheme, and nothing else in the UI changes. A theme draws inside a box whose size
// and 5:7 shape the table decides; it reads the --card-* tokens, or brings its own art.

export interface CardTheme {
  id: string;
  name: string;
  Face: ComponentType<{ card: Card }>;
  Back: ComponentType;
}

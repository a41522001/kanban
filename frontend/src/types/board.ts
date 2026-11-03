// Board columns and cards use the shared contracts (`BoardSnapshot` etc.).
// Category types stay here until categories are persisted (Board spec A+).

export type CardCategoryColorKey =
  | 'coral'
  | 'rose'
  | 'orange'
  | 'amber'
  | 'lime'
  | 'mint'
  | 'teal'
  | 'cyan'
  | 'blue'
  | 'indigo'
  | 'lavender'
  | 'violet'
  | 'pink'
  | 'slate';

export interface CardCategoryData {
  name: string;
  colorKey: CardCategoryColorKey;
}

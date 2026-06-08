/**
 * v3 redesign UI primitives.
 * All primitives consume `--ds-*` tokens from src/renderer/styles/tokens.css.
 * They are theme-aware (light/dark) and method-color aware where applicable.
 */
export { MethodBadge, methodColor } from './MethodBadge';
export { VerticalTabStrip, type VerticalTabItem } from './VerticalTabStrip';
export { PillBar, type PillItem } from './PillBar';
export { SendButton } from './SendButton';
export { IconButton } from './IconButton';

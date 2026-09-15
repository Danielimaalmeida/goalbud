import { COLOUR_HEX, DEFAULT_COLOUR, type Goal } from '../core/model';

/** Inline style binding for `--goal`, the goal's colour custom property. */
export function goalVar(goal: Pick<Goal, 'colour'> | null | undefined): string {
  return COLOUR_HEX[goal?.colour ?? DEFAULT_COLOUR];
}

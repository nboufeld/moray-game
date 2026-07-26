import { LifeScaffold } from "../creatures/life/LifeSystem";
import { SEEDS } from "../util/Random";

/**
 * TODO(W-L7): the little clouds the sand throws up when something disturbs it.
 *
 * It lives with the rendering layer rather than with the animals because what
 * it draws is a puff of silt, but it is driven like everything else that moves
 * — through {@link LifeSystem} — so whichever creature kicks it can hand it a
 * position and forget about it.
 */
export class SandPuffs extends LifeScaffold {
  constructor(seed: number = SEEDS.sandPuffs) {
    super("sand-puffs", seed);
  }
}

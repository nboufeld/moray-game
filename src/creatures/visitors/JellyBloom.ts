import { SEEDS } from "../../util/Random";
import { LifeScaffold } from "../life/LifeSystem";

/** TODO(W-L6): the jellyfish bloom — a drifting raft of pulsing bells. */
export class JellyBloom extends LifeScaffold {
  constructor(seed: number = SEEDS.visitors) {
    super("jelly-bloom", seed);
  }
}

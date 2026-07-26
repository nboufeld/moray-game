import { SEEDS } from "../../util/Random";
import { LifeScaffold } from "../life/LifeSystem";

/** TODO(W-L5): the starfish — still colour on the sand and up the rock faces. */
export class Starfish extends LifeScaffold {
  constructor(seed: number = SEEDS.starfish) {
    super("starfish", seed);
  }
}

import { SEEDS } from "../../util/Random";
import { LifeScaffold } from "../life/LifeSystem";

/** TODO(W-L5): the sand crabs — scuttling, sidling, and startled by the diver. */
export class Crabs extends LifeScaffold {
  constructor(seed: number = SEEDS.crabs) {
    super("crabs", seed);
  }
}

import { SEEDS } from "../../util/Random";
import { LifeScaffold } from "../life/LifeSystem";

/** TODO(W-L5): the urchins — dark spiny clusters tucked into the reef's shade. */
export class Urchins extends LifeScaffold {
  constructor(seed: number = SEEDS.urchins) {
    super("urchins", seed);
  }
}

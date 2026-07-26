import { SEEDS } from "../../util/Random";
import { LifeScaffold } from "../life/LifeSystem";

/** TODO(W-L6): the eagle ray — one banked arc over the sand and away. */
export class Ray extends LifeScaffold {
  constructor(seed: number = SEEDS.visitors) {
    super("ray", seed);
  }
}

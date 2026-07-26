import { SEEDS } from "../../util/Random";
import { LifeScaffold } from "../life/LifeSystem";

/** TODO(W-L6): the green turtle — a slow diagonal across the upper water. */
export class Turtle extends LifeScaffold {
  constructor(seed: number = SEEDS.visitors) {
    super("turtle", seed);
  }
}

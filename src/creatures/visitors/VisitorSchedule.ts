import { SEEDS } from "../../util/Random";
import { LifeScaffold } from "../life/LifeSystem";

/**
 * TODO(W-L6): decides which visitor is passing through, and when.
 *
 * It owns {@link SEEDS.visitors}, and the three visitors default to the same
 * stream: who arrives and how they swim are one decision until the package
 * that fills this in says otherwise.
 */
export class VisitorSchedule extends LifeScaffold {
  constructor(seed: number = SEEDS.visitors) {
    super("visitor-schedule", seed);
  }
}

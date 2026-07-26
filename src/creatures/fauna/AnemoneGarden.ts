import { SEEDS } from "../../util/Random";
import { LifeScaffold } from "../life/LifeSystem";

/** TODO(W-L5): the anemones — soft tentacle beds that breathe with the swell. */
export class AnemoneGarden extends LifeScaffold {
  constructor(seed: number = SEEDS.anemones) {
    super("anemone-garden", seed);
  }
}

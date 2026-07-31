import "../src/world/Seabed.ts";
import { SEED_GROVE, spokeOf, worldOf, recovery, bloomWeight, groveWeight, paleWeight } from "../src/world/regions/pale1/PaleTerrain.ts";
console.log("SEED_GROVE", SEED_GROVE);
const poses = { p03:[357.3,174.1], p04:[496.8,-159.0], p09:[556.1,88.6] };
const sprigC = worldOf(SEED_GROVE.u - 40, SEED_GROVE.v);
const petalC = worldOf(SEED_GROVE.u - 42, SEED_GROVE.v);
for (const [name,[u,v]] of Object.entries(poses)) {
  const w = worldOf(u,v);
  const dS = Math.hypot(w.x - sprigC.x, w.z - sprigC.z);
  const dP = Math.hypot(w.x - petalC.x, w.z - petalC.z);
  console.log(name, "sprigDist", dS.toFixed(1), "(r175)", "petalDist", dP.toFixed(1), "(r130)",
    "k", recovery(u,v).toFixed(2), "bloom", bloomWeight(u,v).toFixed(2), "grove", groveWeight(u,v).toFixed(2), "pale", paleWeight(w.x,w.z).toFixed(2));
}

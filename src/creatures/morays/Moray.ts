import {
  Bone,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  MeshToonMaterial,
  Object3D,
  Skeleton,
  SkinnedMesh,
  SphereGeometry,
  SRGBColorSpace,
  Vector3,
} from "three";
import { requestAlbedo } from "../../rendering/AssetLibrary";
import { createToonMaterial } from "../../rendering/ToonShading";
import { buildMorayBody } from "./MorayBody";
import { projectHeadUvs } from "./MorayHeadUv";
import { createMoraySkin } from "./MorayPattern";
import type { BodyArchetype, MoraySpeciesConfig } from "./MoraySpeciesConfig";

/** Named runtime handles shared by every species (the common contract). */
export interface MorayAsset {
  readonly root: Group;
  readonly bodyRoot: Object3D;
  readonly head: Object3D;
  readonly upperJaw: Object3D;
  readonly lowerJaw: Object3D;
  readonly leftEye: Object3D;
  readonly rightEye: Object3D;
  readonly speciesId: string;
}

interface ArchetypeShape {
  readonly segments: number;
  readonly headScale: number;
  readonly segmentLength: number;
}

/**
 * A tube running along +Z, tapering from `frontRadius` to `backRadius`.
 * Cylinders are built around +Y, so the geometry is rotated once at build time
 * rather than every segment carrying its own correction.
 */
function tube(frontRadius: number, backRadius: number, length: number): CylinderGeometry {
  const geometry = new CylinderGeometry(frontRadius, backRadius, length, 10, 1, true);
  geometry.rotateX(Math.PI / 2);
  return geometry;
}

/**
 * A cool edge light on every skin surface.
 *
 * The reef has one sun and a fill, so a head set back in a crevice has nothing
 * behind it: the animal the game asks the player to study is the only subject
 * in frame without a silhouette. This is the back light the cave cannot give
 * it — water-coloured rather than white, because a warm rim here reads as a
 * second sun, and emissive, so it survives the shadow the mound casts.
 *
 * Two things about it are load-bearing, and both were found by rendering it
 * wrong first.
 *
 * It is weighted by a fixed world direction — up and behind, opposite the sun —
 * and not by facing alone. A moray is a tube running away from the camera, and
 * every side normal of a tube seen end-on is perpendicular to the view, so a
 * plain fresnel scores the whole animal as silhouette and turns it into a cool
 * glowing blob. The direction is what makes it an edge.
 *
 * And it runs before the skin's normal map is applied, on the smooth geometric
 * normal: the wrinkle map throws normals far enough off that the rim breaks up
 * into a haze across the body instead of following the silhouette.
 *
 * The source is a module constant and identical for every material on purpose:
 * three keys its program cache on `onBeforeCompile.toString()`, so two
 * materials whose injected source differed only in a baked-in constant would
 * silently share one program — and one of them would wear the other's numbers.
 *
 * It survived the move to ramp shading untouched. The toon fragment shader
 * carries the same `normal_fragment_maps` chunk in the same place and reaches
 * `totalEmissiveRadiance` the same way, and emissive is the one channel a
 * stepped light leaves alone — which is what this rim needed in the first
 * place, since a crevice gives it no light to step.
 */
const RIM_LIGHT_CHUNK = /* glsl */ `
  vec3 rimWorldNormal = inverseTransformDirection( normal, viewMatrix );
  float rimFacing = 1.0 - saturate( dot( normalize( vViewPosition ), normal ) );
  float rimBack = saturate( dot( rimWorldNormal, normalize( vec3( -0.35, 0.9, -0.4 ) ) ) );
  totalEmissiveRadiance +=
    vec3( 0.34, 0.56, 0.64 ) * pow( rimFacing, 2.0 ) * pow( rimBack, 3.0 ) * 0.65;
  #include <normal_fragment_maps>
`;

/** Adds {@link RIM_LIGHT_CHUNK}. Inert in Node: nothing compiles without a renderer. */
function addRimLight(material: MeshToonMaterial): MeshToonMaterial {
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <normal_fragment_maps>",
      RIM_LIGHT_CHUNK,
    );
  };
  return material;
}

/** What the nasal tubes keep of the accent's saturation, and of its value. */
const NASAL_SATURATION = 0.72;
const NASAL_VALUE = 0.78;

/**
 * The accent colour as tissue rather than as signage; see `nasalMaterial`.
 *
 * Hue is untouched, because the hue is the species — a ribbon moray's nostrils
 * are yellow and a dragon's are orange, and that is a field mark. Only the two
 * terms that make a colour look like moulded plastic come down.
 *
 * The conversion is pinned to sRGB rather than left to the working space. HSL
 * has no meaning without one, and three's default here is linear-sRGB, where a
 * given fraction of "lightness" is a far deeper cut than the same fraction of
 * the value a painter — or the palette these colours were picked in — means by
 * it.
 */
function softenAccent(accent: Color): Color {
  const hsl = { h: 0, s: 0, l: 0 };
  accent.getHSL(hsl, SRGBColorSpace);
  return new Color().setHSL(
    hsl.h,
    hsl.s * NASAL_SATURATION,
    hsl.l * NASAL_VALUE,
    SRGBColorSpace,
  );
}

/** Seconds of turn each joint lags the head by; see `update`. */
const BANK_SECONDS = 0.4;
/** Hard limit on that lag, in radians per joint. */
const MAX_BANK = 0.13;

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

const ARCHETYPES: Record<BodyArchetype, ArchetypeShape> = {
  ribbon: { segments: 13, headScale: 0.7, segmentLength: 0.34 },
  standard: { segments: 9, headScale: 0.9, segmentLength: 0.38 },
  robust: { segments: 8, headScale: 1.15, segmentLength: 0.44 },
  compact: { segments: 7, headScale: 1.0, segmentLength: 0.36 },
};

/**
 * A procedurally built moray: a sculpted head with jaw, eyes and optional nasal
 * appendages, on a skinned body and dorsal fin that can recede into a crevice
 * or swim freely in the sanctuary. Individuality comes from the species config
 * layered onto shared machinery.
 */
export class Moray {
  readonly asset: MorayAsset;

  private readonly joints: Bone[] = [];
  private readonly shape: ArchetypeShape;
  private breatheTime = 0;
  private swayTime = 0;
  private lookBlend = 0;
  private readonly headWorld = new Vector3();
  private readonly toPlayer = new Vector3();

  constructor(readonly config: MoraySpeciesConfig) {
    this.shape = ARCHETYPES[config.archetype];

    const accentColor = new Color(config.accentColor);

    // Markings, counter-shading and skin folds are all painted.
    const skin = createMoraySkin(config);
    const bodyMaterial = addRimLight(
      createToonMaterial({
        map: skin.map,
        normalMap: skin.normalMap,
      }),
    );
    // Upgrade the albedo to the painted one if there is a painted one. Only the
    // albedo: the wrinkles and the broken wet sheen live in the procedural
    // normal and roughness maps, which the painting has no channel for and no
    // reason to replace. The material is untinted — `bodyMaterial` is built
    // without a `color`, so it is white and multiplies the map by 1 — which is
    // also what makes the procedural path work, since that map already carries
    // the species colour. Nothing arrives here in Node, and nothing arrives if
    // the file is missing; either way the skin above is what stays on.
    if (config.albedoAsset) {
      requestAlbedo(config.albedoAsset, (albedo) => {
        bodyMaterial.map = albedo;
        bodyMaterial.needsUpdate = true;
      });
    }

    // The nasal tubes are skin, not signage. They wear the species' accent, but
    // the accent is authored to be *found* across ten metres of water on a fin
    // margin, and at full strength on a bare untextured cone twenty centimetres
    // from the eye it is the brightest, flattest thing on a painted face — a
    // plastic horn stuck to an animal. Held down in saturation and value it
    // keeps the hue that identifies the species and gives up the glow.
    const nasalMaterial = addRimLight(createToonMaterial({ color: softenAccent(accentColor) }));
    // The fin wears the accent colour flat. It used to also wear a roughness of
    // its own, because it is a broad thin surface the camera meets edge-on as
    // often as not and a tighter lobe hung a hard highlight all down its top
    // edge — a spike over a head in a dark crevice. Ramp shading settles that
    // argument for it: there is no lobe left to spread.
    const finMaterial = addRimLight(createToonMaterial({ color: accentColor }));

    const root = new Group();
    const bodyRoot = new Object3D();
    root.add(bodyRoot);

    const segmentLength = this.shape.segmentLength * config.lengthScale;

    // The chain the wave is driven down. These used to each carry a cylinder;
    // now they are the skeleton one continuous tube is skinned to, so `update`
    // is unchanged and the same wave bends the body instead of hinging it.
    let parent: Object3D = bodyRoot;
    for (let i = 0; i < this.shape.segments; i++) {
      const joint = new Bone();
      joint.position.z = i === 0 ? 0 : -segmentLength;
      parent.add(joint);
      this.joints.push(joint);
      parent = joint;
    }

    const rig = buildMorayBody({
      jointCount: this.shape.segments,
      jointSpacing: segmentLength,
      girthScale: config.girthScale,
    });
    // One texture spanning the animal head to tail: the tube's `v` already
    // runs 0 at the snout to 1 at the tip, which is the space `MorayPattern`
    // paints in.
    const body = new SkinnedMesh(rig.body, bodyMaterial);
    const fin = new SkinnedMesh(rig.fin, finMaterial);
    for (const skinned of [body, fin]) {
      // Three would otherwise bound these from whichever pose the bones are in
      // at the first render and never update it. See `BOUNDS_SLACK`.
      skinned.boundingSphere = rig.bounds.clone();
      bodyRoot.add(skinned);
    }

    // Bind while the rig is still in its rest pose: the inverses taken here are
    // what every later pose is measured against.
    root.updateMatrixWorld(true);
    const skeleton = new Skeleton(this.joints);
    body.bind(skeleton);
    fin.bind(skeleton);

    const head = new Object3D();
    bodyRoot.add(head);
    const headScale = this.shape.headScale;

    // A tapered cranium rather than a ball. This is the object the player is
    // asked to hold a reticle on for a second and a half, so its silhouette
    // carries the game's key moment: a snout that narrows forward, a brow that
    // overhangs the eye, and a jaw line beneath it.
    const skull = new Mesh(new SphereGeometry(0.29 * headScale, 14, 12), bodyMaterial);
    skull.scale.set(0.82, 0.78, 1.16);
    skull.position.z = 0.26 * headScale;
    head.add(skull);

    const snout = new Mesh(tube(0.13 * headScale, 0.25 * headScale, 0.34 * headScale), bodyMaterial);
    snout.scale.set(0.88, 0.82, 1);
    snout.position.set(0, 0.01 * headScale, 0.52 * headScale);
    head.add(snout);

    const brow = new Mesh(new SphereGeometry(0.1 * headScale, 8, 7), bodyMaterial);
    brow.scale.set(1.9, 0.62, 1.25);
    brow.position.set(0, 0.17 * headScale, 0.36 * headScale);
    head.add(brow);

    const upperJaw = new Object3D();
    upperJaw.position.set(0, 0.06 * headScale, 0.5 * headScale);
    const upperJawMesh = new Mesh(
      tube(0.09 * headScale, 0.19 * headScale, 0.42 * headScale),
      bodyMaterial,
    );
    upperJawMesh.scale.set(1, 0.62, 1);
    upperJawMesh.position.z = 0.17 * headScale;
    upperJaw.add(upperJawMesh);
    head.add(upperJaw);

    if (config.nasalAppendages) {
      for (const side of [-1, 1]) {
        const tube = new Mesh(new ConeGeometry(0.05 * headScale, 0.22 * headScale, 6), nasalMaterial);
        tube.position.set(side * 0.1 * headScale, 0.14 * headScale, 0.42 * headScale);
        tube.rotation.x = Math.PI / 2.4;
        upperJaw.add(tube);
      }
    }

    const lowerJaw = new Object3D();
    lowerJaw.position.set(0, -0.08 * headScale, 0.5 * headScale);
    // The jaw wears the skin, like the rest of the head. It used to wear a flat
    // three-quarter-value copy of the body colour, which was a fair stand-in
    // beside a low-contrast procedural map and is not one beside a painted
    // face: untextured, it is the largest single flat surface on the animal and
    // the eye reads it as a plastic bib hung under the jaw line. `bodyMaterial`
    // also carries the rim light the chin needs to keep the bottom edge of the
    // silhouette, which the bespoke material was built to provide.
    const lowerJawMesh = new Mesh(tube(0.08 * headScale, 0.17 * headScale, 0.4 * headScale), bodyMaterial);
    lowerJawMesh.scale.set(1, 0.55, 1);
    lowerJawMesh.position.z = 0.17 * headScale;
    lowerJaw.add(lowerJawMesh);
    head.add(lowerJaw);

    // Every part above wears `bodyMaterial` on the texture coordinates its own
    // primitive generator authored, which smears the map's whole length across
    // a head and rolls the counter-shading a quarter turn. Re-wrap them in the
    // body's space, into the band of the map the neck continues from. This runs
    // once the head is fully assembled so the jaw is projected in the same pass
    // and in the same frame as the skull it hangs from — a part's own offset
    // and rotation inside the head is what the projection divides out, and the
    // jaw's is a pivot, not a placement.
    projectHeadUvs(head, [skull, snout, brow, upperJawMesh], rig.neckV, [lowerJawMesh]);

    const eyeGeometry = new SphereGeometry(0.06 * headScale, 10, 10);
    // The bead is ramp-shaded like the rest of the animal. It used to be a
    // near-mirror — roughness 0.08 — which on a sphere is a pinpoint, and a
    // pinpoint is precisely what this pivot is removing from the frame. The
    // wet spark was never that highlight anyway; it is the catchlight below,
    // which is a modelled object and survives untouched.
    const eyeMaterial = createToonMaterial({ color: 0x14100e, emissive: 0x241a12 });
    // A wet catchlight is what separates "a creature is looking at you" from
    // "two dark beads"; the bloom pass then gives it a faint wet flare.
    // Sized for the distance the game is actually played at: at the range shot
    // C frames the crevice from, the old bead covered well under a pixel and
    // fell below the bloom threshold, so the one spark in the frame was gone
    // exactly when the player was being asked to look for it.
    //
    // This is the one lit-material type the ramp pivot left alone, and the
    // reason is that it is not a lit surface: it is a bloom source wearing a
    // sphere, held above 1 by an emissive of 3.2 and taken out of the tone
    // curve entirely. Ramping it would step a diffuse term that contributes
    // under a sixth of what it puts on screen, and would risk the one spark the
    // discovery moment is built around for nothing.
    const catchlightGeometry = new SphereGeometry(0.028 * headScale, 8, 8);
    const catchlightMaterial = new MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xfff4e2,
      emissiveIntensity: 3.2,
      toneMapped: false,
    });

    // Set into sockets under the brow rather than stuck on the surface.
    const leftEye = new Mesh(eyeGeometry, eyeMaterial);
    leftEye.position.set(-0.15 * headScale, 0.115 * headScale, 0.4 * headScale);
    head.add(leftEye);
    const rightEye = new Mesh(eyeGeometry, eyeMaterial);
    rightEye.position.set(0.15 * headScale, 0.115 * headScale, 0.4 * headScale);
    head.add(rightEye);

    for (const eye of [leftEye, rightEye]) {
      const catchlight = new Mesh(catchlightGeometry, catchlightMaterial);
      catchlight.position.set(0.022 * headScale, 0.026 * headScale, 0.046 * headScale);
      eye.add(catchlight);
    }

    root.traverse((object) => {
      if (object instanceof Mesh) {
        object.castShadow = true;
      }
    });

    this.asset = {
      root,
      bodyRoot,
      head,
      upperJaw,
      lowerJaw,
      leftEye,
      rightEye,
      speciesId: config.id,
    };
  }

  /** World position of the head, used by the discovery focus system. */
  getHeadWorldPosition(out = this.headWorld): Vector3 {
    return this.asset.head.getWorldPosition(out);
  }

  /**
   * @param turnRate Yaw rate of the path the animal is following, in radians
   * per second, or 0 for an animal that is holding station — which is every
   * moray in the reef, so the default leaves their motion untouched.
   */
  update(dt: number, playerPosition: Vector3, curious: boolean, turnRate = 0): void {
    this.breatheTime += dt;
    this.swayTime += dt;

    // Rhythmic jaw ventilation — the moray's natural, gentle character.
    const ventilation = (Math.sin(this.breatheTime * 1.6) * 0.5 + 0.5) * 0.28;
    this.asset.lowerJaw.rotation.x = ventilation;
    this.asset.upperJaw.rotation.x = -ventilation * 0.35;

    // Curvature the body inherits from the path it is on.
    //
    // The root only carries the head's heading, so an animal on a curve drifts
    // sideways like a ship unless every joint takes a share of the turn. The
    // sign is negative because the body *trails*: joint
    // i is where the head was `i` segment-times ago, when it was pointing that
    // much further back around the turn. The magnitude is that lag in seconds —
    // roughly how long a segment takes to pass a point at swimming speed — and
    // it is clamped because a figure-eight's ends are tighter than any eel can
    // actually bend, and past this the animal coils into a spring.
    const bank = clamp(-turnRate * BANK_SECONDS, -MAX_BANK, MAX_BANK);

    // Slow body sway travelling down the chain, over a resting S-curve. Without
    // the resting curve a moray at rest is a straight pipe; eels are never
    // straight, and the curve is most of what sells the animal at a glance.
    for (let i = 0; i < this.joints.length; i++) {
      const joint = this.joints[i];
      if (!joint) {
        continue;
      }
      const amplitude = 0.07 + i * 0.018;
      const rest = Math.sin(i * 0.55) * 0.07 + bank;
      joint.rotation.y = rest + Math.sin(this.swayTime * 1.1 - i * 0.5) * amplitude;
      joint.rotation.x = Math.sin(this.swayTime * 0.73 - i * 0.38) * amplitude * 0.3;
    }

    // Gentle head tracking that strengthens once the player is close/curious.
    this.getHeadWorldPosition(this.headWorld);
    this.toPlayer.subVectors(playerPosition, this.headWorld);
    const distance = this.toPlayer.length();
    const wantsToLook = curious || distance < 6 ? 1 : 0;
    this.lookBlend += (wantsToLook - this.lookBlend) * Math.min(1, dt * 2);

    const yaw = Math.atan2(this.toPlayer.x, this.toPlayer.z);
    const pitch = Math.asin(Math.max(-1, Math.min(1, this.toPlayer.y / Math.max(distance, 0.001))));
    this.asset.head.rotation.y = yaw * 0.5 * this.lookBlend;
    this.asset.head.rotation.x = -pitch * 0.4 * this.lookBlend;
  }
}

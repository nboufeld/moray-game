import {
  BoxGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  SphereGeometry,
  Vector3,
} from "three";
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
 * Rewrites a segment's `v` so it occupies its own slice of the body's length.
 * A cylinder's `v` runs 0 at -Y (which becomes the tail-facing end after the
 * rotation in `tube`) to 1 at +Y, so the head end of segment `index` sits at
 * `index / total` and the tail end at `(index + 1) / total`.
 */
function spanBodyUv(geometry: CylinderGeometry, index: number, total: number): void {
  const uv = geometry.attributes.uv;
  if (!uv) {
    return;
  }
  for (let i = 0; i < uv.count; i++) {
    uv.setY(i, (index + 1 - uv.getY(i)) / total);
  }
  uv.needsUpdate = true;
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
 * and not by facing alone. A moray is a stack of cylinders running away from
 * the camera, and every side normal of a cylinder seen end-on is perpendicular
 * to the view, so a plain fresnel scores the whole animal as silhouette and
 * turns it into a cool glowing blob. The direction is what makes it an edge.
 *
 * And it runs before the skin's normal map is applied, on the smooth geometric
 * normal: the wrinkle map throws normals far enough off that the rim breaks up
 * into a haze across the body instead of following the silhouette.
 *
 * The source is a module constant and identical for every material on purpose:
 * three keys its program cache on `onBeforeCompile.toString()`, so two
 * materials whose injected source differed only in a baked-in constant would
 * silently share one program — and one of them would wear the other's numbers.
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
function addRimLight(material: MeshStandardMaterial): MeshStandardMaterial {
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <normal_fragment_maps>",
      RIM_LIGHT_CHUNK,
    );
  };
  return material;
}

const ARCHETYPES: Record<BodyArchetype, ArchetypeShape> = {
  ribbon: { segments: 13, headScale: 0.7, segmentLength: 0.34 },
  standard: { segments: 9, headScale: 0.9, segmentLength: 0.38 },
  robust: { segments: 8, headScale: 1.15, segmentLength: 0.44 },
  compact: { segments: 7, headScale: 1.0, segmentLength: 0.36 },
};

/**
 * A procedurally built moray: head, jaw, eyes, an optional dorsal ridge and
 * nasal appendages, plus a body chain that can recede into a crevice or swim
 * freely in the sanctuary. Individuality comes from the species config layered
 * onto shared machinery.
 */
export class Moray {
  readonly asset: MorayAsset;

  private readonly segments: Object3D[] = [];
  private readonly shape: ArchetypeShape;
  private breatheTime = 0;
  private swayTime = 0;
  private lookBlend = 0;
  private readonly headWorld = new Vector3();
  private readonly toPlayer = new Vector3();

  constructor(readonly config: MoraySpeciesConfig) {
    this.shape = ARCHETYPES[config.archetype];

    const bodyColor = new Color(config.bodyColor);
    const accentColor = new Color(config.accentColor);

    // Markings, counter-shading, skin folds and wet sheen are all painted.
    const skin = createMoraySkin(config);
    const bodyMaterial = addRimLight(
      new MeshStandardMaterial({
        map: skin.map,
        normalMap: skin.normalMap,
        roughnessMap: skin.roughnessMap,
        roughness: 1,
        metalness: 0.04,
      }),
    );
    const accentMaterial = addRimLight(
      new MeshStandardMaterial({ color: accentColor, roughness: 0.5, metalness: 0 }),
    );

    const root = new Group();
    const bodyRoot = new Object3D();
    root.add(bodyRoot);

    const segmentLength = this.shape.segmentLength * config.lengthScale;
    const girthAt = (index: number): number =>
      (0.42 - Math.min(1, index / (this.shape.segments - 1)) * 0.24) * config.girthScale;

    let parent: Object3D = bodyRoot;
    for (let i = 0; i < this.shape.segments; i++) {
      const girth = girthAt(i);
      const pivot = new Object3D();
      pivot.position.z = i === 0 ? 0 : -segmentLength;

      // A rounded, tapering tube: the box chain this replaced read as a train
      // of crates, and the moray is the one thing the game asks you to study.
      // The last segment closes to a near-point, otherwise the open-ended tube
      // shows a hollow cross-section where the tail should finish.
      const isTail = i === this.shape.segments - 1;
      const backRadius = isTail ? girth * 0.04 : girthAt(i + 1) * 0.5;
      const geometry = tube(girth * 0.5, backRadius, segmentLength * 1.04);
      // Every segment is its own cylinder with its own 0..1 UVs, so without
      // this the whole pattern tile compresses into each 0.4m link and a five
      // band zebra wears forty. Remapping v to the segment's slice of the body
      // makes one texture span the animal head to tail.
      spanBodyUv(geometry, i, this.shape.segments);
      const segment = new Mesh(geometry, bodyMaterial);
      // Eels are laterally compressed — narrow across, deep top to bottom.
      segment.scale.set(0.9, 1, 1);
      pivot.add(segment);

      // A thin dorsal ridge sharpens the silhouette (yellow margin on ribbons).
      // Overlapping its neighbours matters: butt-jointed ridges separate into a
      // row of loose bricks as soon as the body flexes.
      if (i < this.shape.segments - 1) {
        // Low and heavily overlapped. A taller fin split at every joint fans
        // apart as the body flexes and reads as a row of plates, not a fin.
        const ridge = new Mesh(
          new BoxGeometry(girth * 0.07, girth * 0.19, segmentLength * 1.75),
          accentMaterial,
        );
        ridge.position.y = girth * 0.46;
        segment.add(ridge);
      }

      parent.add(pivot);
      this.segments.push(pivot);
      parent = pivot;
    }

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
        const tube = new Mesh(new ConeGeometry(0.05 * headScale, 0.22 * headScale, 6), accentMaterial);
        tube.position.set(side * 0.1 * headScale, 0.14 * headScale, 0.42 * headScale);
        tube.rotation.x = Math.PI / 2.4;
        upperJaw.add(tube);
      }
    }

    const lowerJaw = new Object3D();
    lowerJaw.position.set(0, -0.08 * headScale, 0.5 * headScale);
    const lowerJawMesh = new Mesh(
      tube(0.08 * headScale, 0.17 * headScale, 0.4 * headScale),
      // The jaw line is the bottom edge of the head's silhouette, so it carries
      // the rim too — without it the head separates and its chin does not.
      addRimLight(
        new MeshStandardMaterial({ color: bodyColor.clone().multiplyScalar(0.75), roughness: 0.6 }),
      ),
    );
    lowerJawMesh.scale.set(1, 0.55, 1);
    lowerJawMesh.position.z = 0.17 * headScale;
    lowerJaw.add(lowerJawMesh);
    head.add(lowerJaw);

    const eyeGeometry = new SphereGeometry(0.06 * headScale, 10, 10);
    const eyeMaterial = new MeshStandardMaterial({
      color: 0x14100e,
      roughness: 0.08,
      metalness: 0.1,
      emissive: 0x241a12,
    });
    // A wet catchlight is what separates "a creature is looking at you" from
    // "two dark beads"; the bloom pass then gives it a faint wet flare.
    // Sized for the distance the game is actually played at: at the range shot
    // C frames the crevice from, the old bead covered well under a pixel and
    // fell below the bloom threshold, so the one spark in the frame was gone
    // exactly when the player was being asked to look for it.
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

  update(dt: number, playerPosition: Vector3, curious: boolean): void {
    this.breatheTime += dt;
    this.swayTime += dt;

    // Rhythmic jaw ventilation — the moray's natural, gentle character.
    const ventilation = (Math.sin(this.breatheTime * 1.6) * 0.5 + 0.5) * 0.28;
    this.asset.lowerJaw.rotation.x = ventilation;
    this.asset.upperJaw.rotation.x = -ventilation * 0.35;

    // Slow body sway travelling down the chain, over a resting S-curve. Without
    // the resting curve a moray at rest is a straight pipe; eels are never
    // straight, and the curve is most of what sells the animal at a glance.
    for (let i = 0; i < this.segments.length; i++) {
      const segment = this.segments[i];
      if (!segment) {
        continue;
      }
      const amplitude = 0.07 + i * 0.018;
      const rest = Math.sin(i * 0.55) * 0.07;
      segment.rotation.y = rest + Math.sin(this.swayTime * 1.1 - i * 0.5) * amplitude;
      segment.rotation.x = Math.sin(this.swayTime * 0.73 - i * 0.38) * amplitude * 0.3;
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

import {
  BoxGeometry,
  Color,
  ConeGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  SphereGeometry,
  Vector3,
} from "three";
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
    const patternColor = new Color(config.patternColor);
    const accentColor = new Color(config.accentColor);

    const bodyMaterial = new MeshStandardMaterial({ color: bodyColor, roughness: 0.55, metalness: 0 });
    const patternMaterial = new MeshStandardMaterial({ color: patternColor, roughness: 0.6, metalness: 0 });
    const accentMaterial = new MeshStandardMaterial({ color: accentColor, roughness: 0.5, metalness: 0 });

    const root = new Group();
    const bodyRoot = new Object3D();
    root.add(bodyRoot);

    let parent: Object3D = bodyRoot;
    for (let i = 0; i < this.shape.segments; i++) {
      const t = i / (this.shape.segments - 1);
      const girth = (0.42 - t * 0.24) * config.girthScale;
      const pivot = new Object3D();
      pivot.position.z = i === 0 ? 0 : -this.shape.segmentLength * config.lengthScale;

      // Bands alternate the segment colour; spots add studs; plain stays body.
      const useBand = config.pattern === "bands" && i % 2 === 1;
      const segment = new Mesh(
        new BoxGeometry(girth, girth * 0.92, this.shape.segmentLength * 1.05 * config.lengthScale),
        useBand ? patternMaterial : bodyMaterial,
      );
      pivot.add(segment);

      if (config.pattern === "spots" && i > 0 && i < 6) {
        for (const side of [-1, 1]) {
          const spot = new Mesh(new SphereGeometry(girth * 0.18, 6, 6), patternMaterial);
          spot.position.set(side * girth * 0.4, girth * 0.15, 0);
          segment.add(spot);
        }
      }

      // A thin dorsal ridge sharpens the silhouette (yellow margin on ribbons).
      if (i < this.shape.segments - 1) {
        const ridge = new Mesh(
          new BoxGeometry(girth * 0.12, girth * 0.34, this.shape.segmentLength * config.lengthScale),
          accentMaterial,
        );
        ridge.position.y = girth * 0.6;
        segment.add(ridge);
      }

      parent.add(pivot);
      this.segments.push(pivot);
      parent = pivot;
    }

    const head = new Object3D();
    bodyRoot.add(head);
    const headScale = this.shape.headScale;

    const skull = new Mesh(new BoxGeometry(0.5 * headScale, 0.44 * headScale, 0.62 * headScale), bodyMaterial);
    skull.position.z = 0.28 * headScale;
    head.add(skull);

    const upperJaw = new Object3D();
    upperJaw.position.set(0, 0.06 * headScale, 0.5 * headScale);
    const upperJawMesh = new Mesh(new BoxGeometry(0.34 * headScale, 0.12 * headScale, 0.4 * headScale), bodyMaterial);
    upperJawMesh.position.z = 0.18 * headScale;
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
      new BoxGeometry(0.32 * headScale, 0.1 * headScale, 0.38 * headScale),
      new MeshStandardMaterial({ color: bodyColor.clone().multiplyScalar(0.75), roughness: 0.6 }),
    );
    lowerJawMesh.position.z = 0.17 * headScale;
    lowerJaw.add(lowerJawMesh);
    head.add(lowerJaw);

    const eyeGeometry = new SphereGeometry(0.06 * headScale, 8, 8);
    const eyeMaterial = new MeshStandardMaterial({ color: 0x1a1512, roughness: 0.2, emissive: 0x120d0a });
    const leftEye = new Mesh(eyeGeometry, eyeMaterial);
    leftEye.position.set(-0.16 * headScale, 0.12 * headScale, 0.42 * headScale);
    head.add(leftEye);
    const rightEye = new Mesh(eyeGeometry, eyeMaterial);
    rightEye.position.set(0.16 * headScale, 0.12 * headScale, 0.42 * headScale);
    head.add(rightEye);

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

    // Slow body sway travelling down the chain.
    for (let i = 0; i < this.segments.length; i++) {
      const segment = this.segments[i];
      if (!segment) {
        continue;
      }
      const amplitude = 0.05 + i * 0.012;
      segment.rotation.y = Math.sin(this.swayTime * 1.1 - i * 0.5) * amplitude;
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

import * as THREE from "three";

/**
 * Locating the CRT's picture surface inside an arbitrary glTF.
 *
 * Shared by the model (which swaps the material) and the camera rig (which has
 * to know which way the set is pointing), so both agree on what "the screen" is.
 *
 * Matching is structural, never by name. This model came out of Sketchfab with
 * its materials called ".015" / ".008" / ".010" and its node names mangled into
 * mojibake, so names are worthless here and would silently break on re-export
 * anyway. The picture layer is instead the mesh whose material carries an
 * emissive texture over a black base colour — which is what a self-lit screen
 * IS, in any correctly authored model.
 */
export function findScreenMesh(root: THREE.Object3D): THREE.Mesh | null {
  let found: THREE.Mesh | null = null;
  root.traverse((obj) => {
    if (found || !(obj instanceof THREE.Mesh)) return;
    const mat = obj.material as THREE.MeshStandardMaterial | undefined;
    if (!mat || !mat.emissiveMap || !mat.color) return;
    const black = mat.color.r < 0.05 && mat.color.g < 0.05 && mat.color.b < 0.05;
    if (black) found = obj;
  });
  return found;
}

export type ScreenFrame = {
  /** World-space centre of the picture surface. */
  centre: THREE.Vector3;
  /** World-space outward normal — the direction the set is facing. */
  normal: THREE.Vector3;
};

/**
 * Where the screen is and which way it points.
 *
 * The normal is averaged from the geometry rather than assumed to be any
 * particular axis: this model's face lies in the YZ plane pointing along +X,
 * which is not something you can guess, and a camera parked on the wrong axis
 * frames the television's side panel instead of its picture.
 *
 * Averaging over the whole face (rather than reading one vertex) matters
 * because the face is a curved 9x9 grid — the corner normals splay outward, and
 * only the mean points where the set actually faces.
 */
export function getScreenFrame(mesh: THREE.Mesh): ScreenFrame | null {
  const normals = mesh.geometry.getAttribute("normal");
  if (!normals) return null;

  mesh.updateWorldMatrix(true, false);

  const sum = new THREE.Vector3();
  const v = new THREE.Vector3();
  for (let i = 0; i < normals.count; i++) {
    v.fromBufferAttribute(normals as THREE.BufferAttribute, i);
    sum.add(v);
  }
  if (sum.lengthSq() === 0) return null;

  const normalMatrix = new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld);
  const normal = sum.applyMatrix3(normalMatrix).normalize();

  const box = new THREE.Box3().setFromObject(mesh);
  const centre = box.getCenter(new THREE.Vector3());

  return { centre, normal };
}

/**
 * The translucent sheet sitting in front of the picture.
 *
 * The model stacks two coincident faces about 0.01 units apart: the emissive
 * picture behind, and this glass in front carrying the reflection, dust and
 * scratch texture. Found the same structural way as the screen — it is the
 * transparent mesh that is not the screen — because the names are mojibake and
 * the materials are called ".010" and ".008".
 */
export function findGlassMesh(
  root: THREE.Object3D,
  screen: THREE.Mesh | null
): THREE.Mesh | null {
  let found: THREE.Mesh | null = null;
  root.traverse((obj) => {
    if (found || !(obj instanceof THREE.Mesh) || obj === screen) return;
    const mat = obj.material as THREE.MeshStandardMaterial | undefined;
    if (mat && mat.transparent && mat.opacity < 1) found = obj;
  });
  return found;
}

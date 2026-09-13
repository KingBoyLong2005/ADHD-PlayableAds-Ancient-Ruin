import { Camera, Canvas, director, Node } from 'cc';

let cached: Camera = null;

export function findWorldCamera(): Camera {
    if (cached && cached.isValid && cached.node && cached.node.isValid) return cached;
    cached = null;

    const scene = director.getScene();
    if (!scene) return null;

    const cameras = scene.getComponentsInChildren(Camera);
    for (let i = 0; i < cameras.length; i++) {
        const cam = cameras[i];
        if (!cam || !cam.node) continue;
        if (isUnderCanvas(cam.node)) continue;

        if (cam.targetTexture) continue;
        cached = cam;
        return cam;
    }
    return null;
}

function isUnderCanvas(node: Node): boolean {
    let n: Node = node;
    while (n) {
        if (n.getComponent(Canvas)) return true;
        n = n.parent;
    }
    return false;
}

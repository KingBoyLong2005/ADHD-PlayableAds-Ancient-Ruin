import { CharacterController, Collider, Director, director, PhysicsSystem } from 'cc';

export enum CollisionLayer {

    World = 1 << 0,
    Hero = 1 << 1,
    Enemy = 1 << 2,
}

const ENEMY_BLOCKS_ENEMY = false;

const WORLD_MASK = CollisionLayer.World | CollisionLayer.Hero | CollisionLayer.Enemy;
const HERO_MASK = CollisionLayer.World;
const ENEMY_MASK = ENEMY_BLOCKS_ENEMY ? CollisionLayer.World | CollisionLayer.Enemy : CollisionLayer.World;

let _matrixReady = false;

function setupMatrix() {
    if (_matrixReady) return;
    const matrix = PhysicsSystem.instance?.collisionMatrix;
    if (!matrix) return;
    matrix[CollisionLayer.World] = WORLD_MASK;
    matrix[CollisionLayer.Hero] = HERO_MASK;
    matrix[CollisionLayer.Enemy] = ENEMY_MASK;
    _matrixReady = true;
}

export class CharacterCollision {

    public static applyHero(cct: CharacterController) {
        CharacterCollision.apply(cct, CollisionLayer.Hero, HERO_MASK);
    }

    public static applyEnemy(cct: CharacterController) {
        CharacterCollision.apply(cct, CollisionLayer.Enemy, ENEMY_MASK);
    }

    private static apply(cct: CharacterController, group: number, mask: number) {
        if (!cct) return;
        setupMatrix();

        cct.group = group;
        cct.setMask(mask);
    }

    public static refreshWorldColliders() {
        const scene = director.getScene();
        if (!scene) return;
        const colliders = scene.getComponentsInChildren(Collider);
        for (let i = 0; i < colliders.length; i++) {
            const c = colliders[i];

            if (!c.isValid || !c.enabledInHierarchy) continue;
            if (c.getGroup() === CollisionLayer.World && c.getMask() !== WORLD_MASK) c.setMask(WORLD_MASK);
        }
    }
}

try {
    setupMatrix();
} catch (e) {

}
director.on(Director.EVENT_AFTER_SCENE_LAUNCH, () => CharacterCollision.refreshWorldColliders());

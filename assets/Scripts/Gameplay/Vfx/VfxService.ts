import { director, instantiate, Node, Prefab, Vec3 } from 'cc';
import { AutoDestruction, AutoDestructionMode } from '../../Utility/AutoDestruction';
import { DestroyVFX } from '../../Utility/DestroyVFX';
import PoolManager, { VfxId } from '../../Utility/Pool/PoolManager';
import { HeroClass } from '../Hero/HeroClass';

export class VfxService {

    public static fallbackLifetime: number = 2;

    private static _root: Node = null;

    public static setRoot(root: Node) {
        VfxService._root = root;
    }

    public static spawnAt(
        id: VfxId,
        worldPos: Vec3,
        heroClass: HeroClass = HeroClass.None,
        parent: Node = null,
        lifetime: number = 0,
    ): Node {
        const node = VfxService.create(id, heroClass, parent, lifetime);
        if (node) node.setWorldPosition(worldPos);
        return node;
    }

    public static attachTo(
        id: VfxId,
        host: Node,
        heroClass: HeroClass = HeroClass.None,
        offset: Vec3 = null,
        lifetime: number = 0,
    ): Node {
        if (!host || !host.isValid) return null;
        const node = VfxService.create(id, heroClass, host, lifetime);
        if (node) node.setPosition(offset || Vec3.ZERO);
        return node;
    }

    private static create(id: VfxId, heroClass: HeroClass, parent: Node, lifetime: number): Node {
        const prefab: Prefab = PoolManager.instance?.GetVfxPrefab(id, heroClass);
        if (!prefab) return null;

        const node = instantiate(prefab);

        const auto = node.getComponent(AutoDestruction);
        const legacy = node.getComponent(DestroyVFX);
        if (!auto?.isArmed && !legacy?.isArmed) {
            const cleaner = auto || node.addComponent(AutoDestruction);
            cleaner.timeDeactive = lifetime > 0 ? lifetime : VfxService.fallbackLifetime;
            cleaner.mode = AutoDestructionMode.Destroy;
        }

        node.setParent(VfxService.resolveParent(parent));
        node.active = true;
        return node;
    }

    private static resolveParent(preferred: Node): Node {
        if (preferred && preferred.isValid) return preferred;
        if (VfxService._root && VfxService._root.isValid) return VfxService._root;
        return director.getScene();
    }
}

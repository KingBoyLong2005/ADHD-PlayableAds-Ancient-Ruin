import { TypeColor } from "../StringHelper";
import BasePool from "./BasePool";
import { HeroClass } from "../../Gameplay/Hero/HeroClass";
import { _decorator, Color, Component, Enum, instantiate, Node, ParticleSystem, Prefab, Vec3 } from "cc";
const { ccclass, property } = _decorator;
export enum TypeNodePool {
    box,
    threadSpool,
    rope,
    fx,
    claim,
    coin,
    vfx,
    projectile,
    vfxGameplay,
}
@ccclass('BasePoolInfo')
export class BasePoolInfo {
    @property({ type: Enum(TypeNodePool) })
    public typeNodePool: TypeNodePool = TypeNodePool.box;
    @property(BasePool)
    public basePool: BasePool = null;
}

export enum VfxId {
    None = 0,

    FX_Dagger1_Attack = 100,

    FX_Bow_Attack = 200,
    FX_Bow_Impact = 201,
    FX_Arrow_Bullet = 202,

    FX_Casting_Lightning = 300,
    FX_Fireball_charge = 301,
    FX_FireBall_bullet = 302,
    FX_Fire_Ball = 303,
    FX_Fire_Explosion = 304,
    FX_Frost_Ball = 305,
    FX_Frost_Bullet = 306,
    FX_Frost_Explosion = 307,
    FX_Lighting_Ball = 308,
    FX_Lighting_Explosion = 309,
    FX_Poision_Ball = 310,
    FX_Poison_Explosion = 311,

    FX_FreshAir = 400,
    FX_Smoke_Step = 401,
    FX_Smoke_Die = 402,
    FX_Claim_Gold = 403,
    FX_StarCombo_Full = 404,
    FX_LevelUp = 405,
    FX_Fire_Status = 406,
    FX_Frost_Status = 407,
    FX_Poison_Status = 408,
    FX_common_impact_blood = 409,
    FX_common_impact_bone = 410,
    FX_Skeleton_Undead_Revive = 411,
}

@ccclass('VfxEntry')
export class VfxEntry {
    @property({ type: Enum(VfxId) })
    public id: VfxId = VfxId.None;
    @property(Prefab)
    public prefab: Prefab = null;
}

@ccclass('HeroVfxGroup')
export class HeroVfxGroup {
    @property({ type: Enum(HeroClass) })
    public heroClass: HeroClass = HeroClass.None;
    @property([VfxEntry])
    public entries: VfxEntry[] = [];
}

@ccclass
export default class PoolManager extends Component {

    public static instance: PoolManager;

    @property([BasePoolInfo])
    public poolArrays: BasePoolInfo[] = [];

    @property(Prefab)
    vfx: Prefab = null;

    @property({ type: [HeroVfxGroup] })
    public heroVfx: HeroVfxGroup[] = [];

    @property({ type: [VfxEntry] })
    public sharedVfx: VfxEntry[] = [];

    onLoad() {
        super.onLoad?.();
        PoolManager.instance = this;
    }
    protected start(): void {
        let rope = this.GetNodeOfPool(TypeNodePool.rope);
        if (!rope) return;
        rope.setPosition(1000, 1000, 1000);
        rope.active = false;
    }

    PutNodeToPool(type: TypeNodePool, node: Node): boolean {
        if (!node) return false;

        for (let i = 0; i < this.poolArrays.length; i++) {
            if (type == this.poolArrays[i].typeNodePool) {
                this.poolArrays[i].basePool.PutObject(node);
                return true;
            }
        }
        return false;
    }
    GetNodeOfPool(type: TypeNodePool): Node {
        for (let i = 0; i < this.poolArrays.length; i++) {
            if (type == this.poolArrays[i].typeNodePool) {

                return this.poolArrays[i].basePool.GetObject() || null;
            }
        }
        return null;
    }

    GetVfxPrefab(id: VfxId, heroClass: HeroClass = HeroClass.None): Prefab {
        if (id === VfxId.None) return null;

        if (heroClass !== HeroClass.None) {
            for (let i = 0; i < this.heroVfx.length; i++) {
                const group = this.heroVfx[i];
                if ((group.heroClass & heroClass) === 0) continue;
                const prefab = this.FindVfxPrefab(group.entries, id);
                if (prefab) return prefab;
            }
        }

        return this.FindVfxPrefab(this.sharedVfx, id);
    }

    private FindVfxPrefab(entries: VfxEntry[], id: VfxId): Prefab {
        if (!entries) return null;
        for (let i = 0; i < entries.length; i++) {
            if (entries[i].id === id) return entries[i].prefab;
        }
        return null;
    }

    SpawnVfxById(id: VfxId, pos: Vec3, parent: Node, heroClass: HeroClass = HeroClass.None, scale: number = 1): Node {
        const prefab = this.GetVfxPrefab(id, heroClass);
        if (!prefab) return null;

        const node = instantiate(prefab);
        node.setParent(parent);
        node.setWorldPosition(pos);
        if (scale !== 1) node.setScale(new Vec3(scale, scale, scale));
        return node;
    }

    spawnVfx(pos: Vec3, color: Color, parent: Node, scale: number) {
        let vfx = instantiate(this.vfx);
        vfx.setParent(parent);
        vfx.setWorldPosition(pos);
        vfx.setScale(new Vec3(scale, scale, scale));

        let cpuMaterial = vfx.getComponent(ParticleSystem).renderer.cpuMaterial;

        cpuMaterial.setProperty('tintColor', color);
        vfx.getComponent(ParticleSystem).renderer.cpuMaterial = cpuMaterial;
    }

}

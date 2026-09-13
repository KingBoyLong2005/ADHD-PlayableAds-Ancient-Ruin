import { _decorator, CCFloat, Component, Enum, Node, SkeletalAnimation, Vec3 } from 'cc';
import { VfxId } from '../../Utility/Pool/PoolManager';
import { HeroClass } from '../Hero/HeroClass';
import { VfxService } from './VfxService';

const { ccclass, property } = _decorator;

const SHOOT_POINT_NAME = 'shootpoint';

export enum MageElement {
    Fire = 0,
    Frost = 1,
    Lightning = 2,
    Poison = 3,
}

@ccclass('HeroVfx')
export class HeroVfx extends Component {

    public static of(host: Node): HeroVfx {
        if (!host || !host.isValid) return null;
        return host.getComponent(HeroVfx) || host.addComponent(HeroVfx);
    }

    public heroClass: HeroClass = HeroClass.None;

    @property({ type: Enum(MageElement) })
    public mageElement: MageElement = MageElement.Fire;

    @property({ type: Node })
    public muzzle: Node = null;

    @property
    public muzzleOffset: Vec3 = new Vec3(0, 1, 0);

    @property({ type: CCFloat })
    public stepInterval: number = 0.3;

    @property({ type: CCFloat })
    public stepMinSpeed: number = 0.5;

    @property({ type: Enum(VfxId) })
    public attackVfxOverride: VfxId = VfxId.None;

    @property({ type: Enum(VfxId) })
    public projectileVfxOverride: VfxId = VfxId.None;

    @property({ type: Enum(VfxId) })
    public impactVfxOverride: VfxId = VfxId.None;

    private _stepTimer: number = 0;
    private _prevPos: Vec3 = new Vec3();
    private _hasPrev: boolean = false;

    private _autoMuzzle: Node = null;

    onEnable() {
        Vec3.copy(this._prevPos, this.node.worldPosition);
        this._hasPrev = true;
        this._stepTimer = 0;
    }

    update(dt: number) {
        if (this.stepInterval <= 0 || dt <= 0) return;

        const pos = this.node.worldPosition;
        if (!this._hasPrev) {
            Vec3.copy(this._prevPos, pos);
            this._hasPrev = true;
            return;
        }

        const dx = pos.x - this._prevPos.x;
        const dz = pos.z - this._prevPos.z;
        Vec3.copy(this._prevPos, pos);

        const speed = Math.sqrt(dx * dx + dz * dz) / dt;
        if (speed < this.stepMinSpeed) {

            this._stepTimer = this.stepInterval;
            return;
        }

        this._stepTimer += dt;
        if (this._stepTimer < this.stepInterval) return;
        this._stepTimer = 0;
        VfxService.spawnAt(VfxId.FX_Smoke_Step, pos, this.heroClass);
    }

    public playAttack(melee: boolean) {
        const id = melee ? this.meleeAttackVfx : this.rangedAttackVfx;
        if (id === VfxId.None) return;
        VfxService.spawnAt(id, this.muzzleWorldPos(), this.heroClass);
    }

    public projectileVfx(arc: boolean): VfxId {
        if (this.projectileVfxOverride !== VfxId.None) return this.projectileVfxOverride;

        switch (this.heroClass) {
            case HeroClass.Ranger:
                return VfxId.FX_Arrow_Bullet;
            case HeroClass.Mage:

                switch (this.mageElement) {
                    case MageElement.Fire:
                        return arc ? VfxId.FX_Fire_Ball : VfxId.FX_FireBall_bullet;
                    case MageElement.Frost:
                        return arc ? VfxId.FX_Frost_Ball : VfxId.FX_Frost_Bullet;
                    case MageElement.Lightning:
                        return VfxId.FX_Lighting_Ball;
                    default:
                        return VfxId.FX_Poision_Ball;
                }
            default:
                return VfxId.None;
        }
    }

    public get impactVfx(): VfxId {
        if (this.impactVfxOverride !== VfxId.None) return this.impactVfxOverride;

        switch (this.heroClass) {
            case HeroClass.Ranger:
                return VfxId.FX_Bow_Impact;
            case HeroClass.Mage:
                switch (this.mageElement) {
                    case MageElement.Fire:
                        return VfxId.FX_Fire_Explosion;
                    case MageElement.Frost:
                        return VfxId.FX_Frost_Explosion;
                    case MageElement.Lightning:
                        return VfxId.FX_Lighting_Explosion;
                    default:
                        return VfxId.FX_Poison_Explosion;
                }
            default:
                return VfxId.None;
        }
    }

    public playLevelUp() {
        VfxService.spawnAt(VfxId.FX_LevelUp, this.node.worldPosition, this.heroClass);
    }

    public playSkillGained() {
        VfxService.spawnAt(VfxId.FX_StarCombo_Full, this.muzzleWorldPos(), this.heroClass);
    }

    public playHeal() {
        VfxService.spawnAt(VfxId.FX_FreshAir, this.node.worldPosition, this.heroClass);
    }

    public playDie() {
        VfxService.spawnAt(VfxId.FX_Smoke_Die, this.node.worldPosition, this.heroClass);
    }

    private get meleeAttackVfx(): VfxId {
        if (this.attackVfxOverride !== VfxId.None) return this.attackVfxOverride;
        return this.heroClass === HeroClass.Warrior ? VfxId.FX_Dagger1_Attack : VfxId.None;
    }

    private get rangedAttackVfx(): VfxId {
        if (this.attackVfxOverride !== VfxId.None) return this.attackVfxOverride;

        switch (this.heroClass) {
            case HeroClass.Ranger:
                return VfxId.FX_Bow_Attack;
            case HeroClass.Mage:
                switch (this.mageElement) {
                    case MageElement.Fire:
                        return VfxId.FX_Fireball_charge;
                    case MageElement.Lightning:
                        return VfxId.FX_Casting_Lightning;
                    case MageElement.Frost:
                        return VfxId.FX_Frost_Ball;
                    default:
                        return VfxId.FX_Poision_Ball;
                }
            default:
                return VfxId.None;
        }
    }

    public muzzleWorldPos(): Vec3 {
        const m = this.resolveMuzzle();
        if (m) return m.worldPosition.clone();
        const p = this.node.worldPosition;
        return new Vec3(p.x + this.muzzleOffset.x, p.y + this.muzzleOffset.y, p.z + this.muzzleOffset.z);
    }

    private resolveMuzzle(): Node {
        if (this.muzzle && this.muzzle.isValid && this.muzzle.activeInHierarchy) return this.muzzle;
        if (this._autoMuzzle && this._autoMuzzle.isValid && this._autoMuzzle.activeInHierarchy) {
            return this._autoMuzzle;
        }

        this._autoMuzzle = HeroVfx.findActiveByName(this.node, SHOOT_POINT_NAME) || this.findSocket();
        return this._autoMuzzle;
    }

    private findSocket(): Node {
        const anims = this.node.getComponentsInChildren(SkeletalAnimation);
        for (let i = 0; i < anims.length; i++) {
            if (!anims[i].node.activeInHierarchy) continue;
            const sockets = anims[i].sockets;
            for (let s = 0; s < sockets.length; s++) {
                const target = sockets[s]?.target;
                if (target && target.isValid) return target;
            }
        }
        return null;
    }

    private static findActiveByName(root: Node, lowerName: string): Node {
        const kids = root.children;
        for (let i = 0; i < kids.length; i++) {
            const k = kids[i];
            if (!k || !k.isValid || !k.active) continue;
            if (k.name.toLowerCase() === lowerName) return k;
            const hit = HeroVfx.findActiveByName(k, lowerName);
            if (hit) return hit;
        }
        return null;
    }
}

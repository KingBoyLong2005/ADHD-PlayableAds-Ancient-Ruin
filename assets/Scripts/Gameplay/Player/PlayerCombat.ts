import { _decorator, CCFloat, Component, Enum, Vec3 } from 'cc';
import { SoundManager } from '../../Utility/SoundManager';
import { AttackType } from '../Combat/AttackType';
import { CharacterFacing } from '../Combat/CharacterFacing';
import { CharacterStats } from '../Combat/CharacterStats';
import { CombatGate } from '../Combat/CombatGate';
import { DamageDealer } from '../Combat/DamageDealer';
import { ProjectileFlightMode } from '../Combat/ProjectileFlightMode';
import { GameplayLog } from '../Debug/GameplayLog';
import { EnemyController } from '../Enemy/EnemyController';
import { GameManager } from '../Managers/GameManager';
import { GameplayPoolService } from '../Managers/GameplayPoolService';
import { NavGrid } from '../Map/NavGrid';
import { SkillApplier } from '../Skills/SkillApplier';
import { HeroVfx } from '../Vfx/HeroVfx';
import { AnimState, PlayerAnimation } from './PlayerAnimation';
import { PlayerController } from './PlayerController';

const { ccclass, property } = _decorator;

@ccclass('PlayerCombat')
export class PlayerCombat extends Component {
    @property(PlayerController)
    public player: PlayerController = null;

    @property(CharacterStats)
    public stats: CharacterStats = null;

    @property(PlayerAnimation)
    public anim: PlayerAnimation = null;

    @property(SkillApplier)
    public skillApplier: SkillApplier = null;

    @property
    public preferMeleeWhenBoth: boolean = true;

    @property({ type: Enum(ProjectileFlightMode) })
    public projectileMode: ProjectileFlightMode = ProjectileFlightMode.Straight;

    @property(CCFloat)
    public arcHeight: number = 3;

    private _cooldown: number = 0;

    private _lastBlock: string = '';
    private _holdingBack: boolean = false;

    private _engaged: boolean = false;
    private _vfx: HeroVfx = null;

    public get holdingBackAttack(): boolean {
        return this._holdingBack;
    }

    public get inCombat(): boolean {
        return this._engaged;
    }

    onLoad() {
        if (!this.player) this.player = this.getComponent(PlayerController);
        if (!this.stats) this.stats = this.getComponent(CharacterStats);
        if (!this.anim) this.anim = this.getComponent(PlayerAnimation);
        if (!this.skillApplier) this.skillApplier = this.getComponent(SkillApplier);

        this._vfx = HeroVfx.of(this.node);
    }

    update(dt: number) {
        const gm = GameManager.instance;

        if (gm && !gm.canControl) {
            this._holdingBack = false;
            this._engaged = false;
            this.block(`không điều khiển được (state=${gm.state}, mode=${gm.gameMode}; cần Playing+Solo)`);
            return;
        }

        if (!CombatGate.open) {
            this._holdingBack = false;
            this._engaged = false;
            this.block('trận chưa mở — chờ người chơi đẩy hero đi bước đầu tiên');
            return;
        }
        if (!this.stats || this.stats.isDead) {
            this._holdingBack = false;
            this._engaged = false;
            this.block(this.stats ? 'hero đã chết' : 'thiếu CharacterStats');
            return;
        }

        this._cooldown = Math.max(0, this._cooldown - dt);

        if (this.player && this.player.isMoving) {

            this._holdingBack = this.hasReachableTarget();
            this._engaged = this._holdingBack;
            this.block('đang di chuyển — hero chỉ đánh khi đứng yên');
            return;
        }
        this._holdingBack = false;

        if (this._cooldown > 0) return;

        const target = this.skillApplier?.targetWeakest ? this.findWeakestEnemy() : this.findNearestEnemy();
        if (!target || !target.stats || target.stats.isDead) {
            this._engaged = false;
            this.block(
                `không có mục tiêu nhìn thấy được (EnemyController.all = ${EnemyController.all.length}) `
                    + '— quái sau tường không tính, phải vòng qua mới đánh được',
            );
            return;
        }

        const dist = this.distanceXZ(this.node.worldPosition, target.node.worldPosition);
        const attackType = this.resolveAttackType(dist);
        if (attackType === null) {
            this._engaged = false;
            this.block(
                `mục tiêu gần nhất cách ${dist.toFixed(1)}m, ngoài tầm `
                    + `(melee ${this.stats.meleeRange}, ranged ${this.stats.rangedRange})`,
            );
            return;
        }

        this._engaged = true;
        this.performAttack(target, attackType);
        this._cooldown = this.stats.attackCooldown;

        const p = this.node.worldPosition;
        const t = target.node.worldPosition;
        GameplayLog.log(
            'combat',
            `hero ${GameplayLog.pos(p.x, p.z)} y=${p.y.toFixed(1)} đánh `
                + `${attackType === AttackType.Melee ? 'CẬN' : 'XA'} ${target.node.name} `
                + `${GameplayLog.pos(t.x, t.z)} y=${t.y.toFixed(1)} | cách ${dist.toFixed(1)}m `
                + `| dmg ${this.stats.damage} | hp quái ${target.stats.hp.toFixed(0)}/${target.stats.hpMax}`,
        );
        this._lastBlock = '';
    }

    private hasReachableTarget(): boolean {
        const target = this.skillApplier?.targetWeakest ? this.findWeakestEnemy() : this.findNearestEnemy();
        if (!target || !target.stats || target.stats.isDead) return false;
        const dist = this.distanceXZ(this.node.worldPosition, target.node.worldPosition);
        return this.resolveAttackType(dist) !== null;
    }

    private block(reason: string) {
        if (this._lastBlock === reason) return;
        this._lastBlock = reason;
        GameplayLog.log('combat', `hero chưa đánh: ${reason}`);
    }

    private resolveAttackType(dist: number): AttackType | null {
        const inMelee = dist <= this.stats.meleeRange;
        const inRanged = dist <= this.stats.rangedRange;
        if (!inMelee && !inRanged) return null;
        if (inMelee && (!inRanged || this.preferMeleeWhenBoth)) return AttackType.Melee;
        return AttackType.Ranged;
    }

    private performAttack(target: EnemyController, type: AttackType) {

        this.lookAt(target.node.worldPosition);

        this.anim?.play(AnimState.Attack, true);

        this._vfx?.playAttack(type === AttackType.Melee);

        SoundManager.instance?.playHeroAttack(type === AttackType.Melee);

        if (type === AttackType.Melee) {
            DamageDealer.apply(target.stats, this.stats.damage, this.stats);
            return;
        }

        const pool = GameplayPoolService.instance;

        const origin = this._vfx ? this._vfx.muzzleWorldPos() : this.node.worldPosition.clone();
        if (!this._vfx) origin.y += 1;
        if (pool) {
            const extra = this.skillApplier?.multiShotBonus || 0;
            const shots = 1 + extra;
            for (let i = 0; i < shots; i++) {
                const offset = new Vec3(origin.x + (i - (shots - 1) * 0.5) * 0.35, origin.y, origin.z);
                pool.spawnProjectile(
                    this.stats,
                    target.stats,
                    this.stats.damage,
                    false,
                    offset,
                    this.projectileMode,
                    this.arcHeight,
                );
            }
        } else {
            DamageDealer.apply(target.stats, this.stats.damage, this.stats);
        }
    }

    private findNearestEnemy(): EnemyController {
        const enemies = EnemyController.all;
        let best: EnemyController = null;
        let bestDist = Number.MAX_VALUE;
        const origin = this.node.worldPosition;
        for (let i = 0; i < enemies.length; i++) {
            const e = enemies[i];
            if (!e || !e.node.active || e.stats?.isDead) continue;
            const d = this.distanceXZ(origin, e.node.worldPosition);
            if (d >= bestDist || !NavGrid.canShoot(origin, e.node.worldPosition)) continue;
            bestDist = d;
            best = e;
        }
        return best;
    }

    private findWeakestEnemy(): EnemyController {
        const enemies = EnemyController.all;
        let best: EnemyController = null;
        let bestHp = Number.MAX_VALUE;
        const origin = this.node.worldPosition;
        for (let i = 0; i < enemies.length; i++) {
            const e = enemies[i];
            if (!e || !e.node.active || e.stats?.isDead) continue;
            if (e.stats.hp >= bestHp || !NavGrid.canShoot(origin, e.node.worldPosition)) continue;
            bestHp = e.stats.hp;
            best = e;
        }
        return best;
    }

    private lookAt(worldPos: Vec3) {

        CharacterFacing.lookAtXZ(this.player ? this.player.facingNode : this.node, worldPos);
    }

    private distanceXZ(a: Vec3, b: Vec3): number {
        const dx = a.x - b.x;
        const dz = a.z - b.z;
        return Math.sqrt(dx * dx + dz * dz);
    }
}

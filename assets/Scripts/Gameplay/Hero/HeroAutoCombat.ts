import { _decorator, CCFloat, Component, Enum, Vec3 } from 'cc';
import { SoundManager } from '../../Utility/SoundManager';
import { AttackType } from '../Combat/AttackType';
import { CombatGate } from '../Combat/CombatGate';
import { DamageDealer } from '../Combat/DamageDealer';
import { ProjectileFlightMode } from '../Combat/ProjectileFlightMode';
import { EnemyController } from '../Enemy/EnemyController';
import { GameManager } from '../Managers/GameManager';
import { GameplayPoolService } from '../Managers/GameplayPoolService';
import { NavGrid } from '../Map/NavGrid';
import { AnimState } from '../Player/PlayerAnimation';
import { SkillApplier } from '../Skills/SkillApplier';
import { HeroVfx } from '../Vfx/HeroVfx';
import { HeroController } from './HeroController';

const { ccclass, property } = _decorator;

@ccclass('HeroAutoCombat')
export class HeroAutoCombat extends Component {
    @property(HeroController)
    public hero: HeroController = null;

    @property
    public preferMeleeWhenBoth: boolean = true;

    @property({ type: Enum(ProjectileFlightMode) })
    public projectileMode: ProjectileFlightMode = ProjectileFlightMode.Straight;

    @property(CCFloat)
    public arcHeight: number = 3;

    private _cooldown: number = 0;

    onLoad() {
        if (!this.hero) this.hero = this.getComponent(HeroController);
    }

    update(dt: number) {
        const gm = GameManager.instance;
        if (gm && gm.isPaused) return;

        if (!CombatGate.open) return;
        if (!this.hero || !this.hero.autoCombat || !this.hero.isAlive) return;

        const stats = this.hero.stats;
        if (!stats) return;

        this._cooldown = Math.max(0, this._cooldown - dt);

        const target = this.findTarget();
        if (!target || !target.stats || target.stats.isDead) {
            this.hero.stopMove();
            return;
        }

        const dist = this.distanceXZ(this.node.worldPosition, target.node.worldPosition);
        const attackType = this.resolveAttackType(dist, stats.meleeRange, stats.rangedRange);

        if (attackType === null || !NavGrid.canShoot(this.node.worldPosition, target.node.worldPosition)) {
            this.hero.moveToward(target.node.worldPosition, dt);
            return;
        }

        this.hero.stopMove();
        if (this._cooldown > 0) return;

        this.performAttack(target, attackType);
        this._cooldown = stats.attackCooldown;
    }

    private resolveAttackType(dist: number, meleeRange: number, rangedRange: number): AttackType | null {
        const inMelee = dist <= meleeRange;
        const inRanged = dist <= rangedRange;
        if (!inMelee && !inRanged) return null;
        if (inMelee && (!inRanged || this.preferMeleeWhenBoth)) return AttackType.Melee;
        return AttackType.Ranged;
    }

    private performAttack(target: EnemyController, type: AttackType) {
        const stats = this.hero.stats;
        this.hero.faceToward(target.node.worldPosition);

        this.hero.anim?.play(AnimState.Attack, true);

        (this.hero.vfx || HeroVfx.of(this.node))?.playAttack(type === AttackType.Melee);

        SoundManager.instance?.playHeroAttack(type === AttackType.Melee);

        if (type === AttackType.Melee) {
            DamageDealer.apply(target.stats, stats.damage, stats);
            return;
        }

        const applier = this.hero.skillApplier || this.getComponent(SkillApplier);
        const pool = GameplayPoolService.instance;

        const vfx = this.hero.vfx || HeroVfx.of(this.node);
        const origin = vfx ? vfx.muzzleWorldPos() : this.node.worldPosition.clone();
        if (!vfx) origin.y += 1;
        if (pool) {
            const extra = applier?.multiShotBonus || 0;
            const shots = 1 + extra;
            for (let i = 0; i < shots; i++) {
                const offset = new Vec3(origin.x + (i - (shots - 1) * 0.5) * 0.35, origin.y, origin.z);
                pool.spawnProjectile(
                    stats,
                    target.stats,
                    stats.damage,
                    false,
                    offset,
                    this.projectileMode,
                    this.arcHeight,
                );
            }
        } else {
            DamageDealer.apply(target.stats, stats.damage, stats);
        }
    }

    private findTarget(): EnemyController {
        const applier = this.hero.skillApplier || this.getComponent(SkillApplier);
        if (applier?.targetWeakest) {
            return this.findWeakestEnemy();
        }
        return this.findNearestEnemy();
    }

    private findNearestEnemy(): EnemyController {
        const enemies = EnemyController.all;
        let best: EnemyController = null;
        let bestDist = Number.MAX_VALUE;
        let seen: EnemyController = null;
        let seenDist = Number.MAX_VALUE;
        const origin = this.node.worldPosition;
        for (let i = 0; i < enemies.length; i++) {
            const e = enemies[i];
            if (!e || !e.node.active || e.stats?.isDead) continue;
            const d = this.distanceXZ(origin, e.node.worldPosition);
            if (d < bestDist) {
                bestDist = d;
                best = e;
            }
            if (d >= seenDist || !NavGrid.canShoot(origin, e.node.worldPosition)) continue;
            seenDist = d;
            seen = e;
        }
        return seen || best;
    }

    private findWeakestEnemy(): EnemyController {
        const enemies = EnemyController.all;
        let best: EnemyController = null;
        let bestHp = Number.MAX_VALUE;
        let seen: EnemyController = null;
        let seenHp = Number.MAX_VALUE;
        const origin = this.node.worldPosition;
        for (let i = 0; i < enemies.length; i++) {
            const e = enemies[i];
            if (!e || !e.node.active || e.stats?.isDead) continue;
            const hp = e.stats.hp;
            if (hp < bestHp) {
                bestHp = hp;
                best = e;
            }
            if (hp >= seenHp || !NavGrid.canShoot(origin, e.node.worldPosition)) continue;
            seenHp = hp;
            seen = e;
        }
        return seen || best;
    }

    private distanceXZ(a: Vec3, b: Vec3): number {
        const dx = a.x - b.x;
        const dz = a.z - b.z;
        return Math.sqrt(dx * dx + dz * dz);
    }
}

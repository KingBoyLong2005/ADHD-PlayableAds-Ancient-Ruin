import { _decorator, CCFloat, Component, Enum } from 'cc';
import { SoundManager } from '../../Utility/SoundManager';
import { ProjectileFlightMode } from '../Combat/ProjectileFlightMode';
import { GameManager } from '../Managers/GameManager';
import { GameplayPoolService } from '../Managers/GameplayPoolService';
import { AnimState } from '../Player/PlayerAnimation';
import { AggroState } from './EnemyAggro';
import { EnemyController } from './EnemyController';

const { ccclass, property } = _decorator;

@ccclass('EnemyRangedAI')
export class EnemyRangedAI extends Component {
    @property(EnemyController)
    public enemy: EnemyController = null;

    @property({ type: Enum(ProjectileFlightMode) })
    public projectileMode: ProjectileFlightMode = ProjectileFlightMode.Straight;

    @property(CCFloat)
    public arcHeight: number = 3;

    @property({ type: CCFloat, range: [0.1, 1], slide: true })
    public approachPercent: number = 0.8;

    private _cooldown: number = 0;

    onLoad() {
        if (!this.enemy) this.enemy = this.getComponent(EnemyController);
    }

    update(dt: number) {
        const gm = GameManager.instance;
        if (gm && gm.isPaused) return;
        if (!this.enemy || !this.enemy.stats || this.enemy.stats.isDead) return;

        if (!this.enemy.canAct) return;

        this._cooldown = Math.max(0, this._cooldown - dt);

        const hero = this.enemy.getTargetHero();
        if (!hero || !hero.isAlive || !hero.stats) {
            this.enemy.stopMove();
            return;
        }

        const aggro = this.enemy.aggro;
        if (aggro) {
            const state = aggro.evaluate(hero.node.worldPosition);
            if (state === AggroState.Idle) {
                this.enemy.stopMove();
                return;
            }
            if (state === AggroState.Returning) {
                this.enemy.moveToward(aggro.home, dt);
                return;
            }
        }

        const range = this.enemy.stats.rangedRange;
        const dist = this.enemy.distanceToTarget(hero);

        if (dist > range * this.approachPercent || !this.enemy.hasSightTo(hero.node.worldPosition)) {
            this.enemy.moveToward(hero.node.worldPosition, dt);
            return;
        }

        this.enemy.stopMove();
        if (dist > range) return;

        this.enemy.faceTarget(hero);
        if (this._cooldown > 0) return;

        this.enemy.anim?.play(AnimState.Attack);
        SoundManager.instance?.playEnemyAttack();
        const pool = GameplayPoolService.instance;
        const origin = this.enemy.node.worldPosition.clone();
        origin.y += 1;
        if (pool) {
            pool.spawnProjectile(
                this.enemy.stats,
                hero.stats,
                this.enemy.stats.damage,
                true,
                origin,
                this.projectileMode,
                this.arcHeight,
            );
        }
        this._cooldown = this.enemy.stats.attackCooldown;
    }
}

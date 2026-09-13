import { _decorator, CCFloat, Component } from 'cc';
import { SoundManager } from '../../Utility/SoundManager';
import { DamageDealer } from '../Combat/DamageDealer';
import { GameManager } from '../Managers/GameManager';
import { AnimState } from '../Player/PlayerAnimation';
import { AggroState } from './EnemyAggro';
import { EnemyController } from './EnemyController';

const { ccclass, property } = _decorator;

@ccclass('EnemyMeleeAI')
export class EnemyMeleeAI extends Component {
    @property(EnemyController)
    public enemy: EnemyController = null;

    @property({ type: CCFloat, range: [0.1, 1], slide: true })
    public approachPercent: number = 0.85;

    private _cooldown: number = 0;

    private _engaged: boolean = false;

    onLoad() {
        if (!this.enemy) this.enemy = this.getComponent(EnemyController);
    }

    onEnable() {
        this._engaged = false;
        this._cooldown = 0;
    }

    update(dt: number) {
        const gm = GameManager.instance;
        if (gm && gm.isPaused) return;
        if (!this.enemy || !this.enemy.stats || this.enemy.stats.isDead) return;

        if (!this.enemy.canAct) return;

        this._cooldown = Math.max(0, this._cooldown - dt);
        const hero = this.enemy.getTargetHero();
        if (!hero || !hero.isAlive || !hero.stats) {
            this._engaged = false;
            this.enemy.stopMove();
            return;
        }

        const aggro = this.enemy.aggro;
        if (aggro) {
            const state = aggro.evaluate(hero.node.worldPosition);
            if (state === AggroState.Idle) {
                this._engaged = false;
                this.enemy.stopMove();
                return;
            }
            if (state === AggroState.Returning) {
                this._engaged = false;
                this.enemy.moveToward(aggro.home, dt);
                return;
            }
        }

        const dist = this.enemy.distanceToTarget(hero);
        const range = this.enemy.stats.meleeRange;

        const sight = this.enemy.hasSightTo(hero.node.worldPosition);

        if (!sight) {
            this._engaged = false;
        } else if (this._engaged) {
            if (dist > range) this._engaged = false;
        } else if (dist <= range * this.approachPercent) {
            this._engaged = true;
        }

        if (!this._engaged) {
            this.enemy.moveToward(hero.node.worldPosition, dt);
            return;
        }

        this.enemy.stopMove();
        this.enemy.faceTarget(hero);
        if (this._cooldown > 0) return;

        this.enemy.anim?.play(AnimState.Attack);
        SoundManager.instance?.playEnemyAttack();
        DamageDealer.apply(hero.stats, this.enemy.stats.damage, this.enemy.stats);
        this._cooldown = this.enemy.stats.attackCooldown;
    }
}

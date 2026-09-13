import { _decorator, CCFloat, Component } from 'cc';
import EventManager from '../../Utility/EventManager';
import { GameplayEvents } from '../Events/GameplayEvents';

const { ccclass, property } = _decorator;

@ccclass('CharacterStats')
export class CharacterStats extends Component {
    @property(CCFloat)
    public hpMax: number = 100;

    @property(CCFloat)
    public moveSpeed: number = 5;

    @property(CCFloat)
    public meleeRange: number = 2;

    @property(CCFloat)
    public rangedRange: number = 8;

    @property(CCFloat)
    public damage: number = 10;

    @property(CCFloat)
    public attackCooldown: number = 0.8;

    @property(CCFloat)
    public separationRadius: number = 0.8;

    @property({ type: CCFloat, range: [0, 1], slide: true })
    public critChance: number = 0;

    @property(CCFloat)
    public critMultiplier: number = 2;

    @property({ type: CCFloat, range: [0, 1], slide: true })
    public lifestealPercent: number = 0;

    public hp: number = 100;
    public isDead: boolean = false;
    public isPlayer: boolean = false;

    onLoad() {
        this.hp = this.hpMax;
        this.isDead = false;
    }

    public get hpRatio(): number {
        if (this.hpMax <= 0) return 0;
        return Math.max(0, Math.min(1, this.hp / this.hpMax));
    }

    public get attackRange(): number {
        return Math.max(this.meleeRange, this.rangedRange);
    }

    public healToFull() {
        this.hp = this.hpMax;
        this.isDead = false;
        this.emitHpChanged();
    }

    public applyDamage(amount: number): boolean {
        if (this.isDead || amount <= 0) return false;
        this.hp = Math.max(0, this.hp - amount);
        if (this.hp <= 0) this.isDead = true;
        this.emitHpChanged();
        return this.isDead;
    }

    public addMaxHp(amount: number, healCurrent: boolean = true) {
        this.hpMax += amount;
        if (healCurrent) {
            this.gainFromMaxHp(amount);
            return;
        }
        this.emitHpChanged();
    }

    public addMoveSpeed(amount: number) {
        this.moveSpeed += amount;
    }

    public addDamage(amount: number) {
        this.damage += amount;
    }

    public addDamagePercent(pct: number) {
        if (pct === 0) return;
        this.damage *= 1 + pct;
    }

    public addMaxHpPercent(pct: number, healCurrent: boolean = true) {
        if (pct === 0) return;
        const before = this.hpMax;
        this.hpMax *= 1 + pct;
        if (healCurrent) {
            this.gainFromMaxHp(this.hpMax - before);
            return;
        }
        this.emitHpChanged();
    }

    private gainFromMaxHp(delta: number) {
        const gained = delta > 0 && !this.isDead ? delta : 0;
        if (gained > 0) this.hp = Math.min(this.hpMax, this.hp + gained);
        this.emitHpChanged();
        if (gained > 0) EventManager.instance.emit(GameplayEvents.Healed, this, gained, false);
    }

    public healPercentOfMax(pct: number) {
        if (this.isDead || pct <= 0) return;
        this.heal(this.hpMax * pct);
    }

    public heal(amount: number, fromLifesteal: boolean = false): number {
        if (this.isDead || amount <= 0) return 0;
        const before = this.hp;
        this.hp = Math.min(this.hpMax, this.hp + amount);
        const gained = this.hp - before;

        if (gained > 0) {
            this.emitHpChanged();
            EventManager.instance.emit(GameplayEvents.Healed, this, gained, fromLifesteal);
        } else if (!fromLifesteal) {

            EventManager.instance.emit(GameplayEvents.Healed, this, 0, false);
        }
        return gained;
    }

    public addMoveSpeedPercent(pct: number) {
        if (pct === 0) return;
        this.moveSpeed *= 1 + pct;
    }

    public addAttackSpeedPercent(pct: number) {
        if (pct <= -1) return;
        this.attackCooldown = Math.max(0.05, this.attackCooldown / (1 + pct));
    }

    public addCritChance(amount: number) {
        this.critChance = Math.max(0, Math.min(1, this.critChance + amount));
    }

    public addCritDamage(amount: number) {
        this.critMultiplier = Math.max(1, this.critMultiplier + amount);
    }

    public addLifesteal(amount: number) {
        this.lifestealPercent = Math.max(0, Math.min(1, this.lifestealPercent + amount));
    }

    public addAttackRangePercent(pct: number) {
        if (pct === 0) return;
        this.meleeRange *= 1 + pct;
        this.rangedRange *= 1 + pct;
    }

    public addMeleeRange(amount: number) {
        this.meleeRange += amount;
    }

    public addRangedRange(amount: number) {
        this.rangedRange += amount;
    }

    private emitHpChanged() {
        EventManager.instance.emit(GameplayEvents.HpChanged, this, this.hp, this.hpMax, this.hpRatio);
    }
}

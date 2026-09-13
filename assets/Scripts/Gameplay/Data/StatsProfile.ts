import { _decorator, CCFloat } from 'cc';
import { CharacterStats } from '../Combat/CharacterStats';

const { ccclass, property } = _decorator;

@ccclass('StatsProfile')
export class StatsProfile {
    @property(CCFloat)
    public hpMax: number = 100;

    @property(CCFloat)
    public moveSpeed: number = 5;

    @property(CCFloat)
    public damage: number = 10;

    @property(CCFloat)
    public attackCooldown: number = 0.8;

    @property({ type: CCFloat })
    public meleeRange: number = 2;

    @property({ type: CCFloat })
    public rangedRange: number = 8;

    @property(CCFloat)
    public separationRadius: number = 0.8;

    @property({ type: CCFloat, range: [0, 1], slide: true })
    public critChance: number = 0;

    @property(CCFloat)
    public critMultiplier: number = 2;

    @property({ type: CCFloat, range: [0, 1], slide: true })
    public lifestealPercent: number = 0;

    public applyTo(stats: CharacterStats) {
        if (!stats) return;
        stats.hpMax = this.hpMax;
        stats.moveSpeed = this.moveSpeed;
        stats.damage = this.damage;
        stats.attackCooldown = this.attackCooldown;
        stats.meleeRange = this.meleeRange;
        stats.rangedRange = this.rangedRange;
        stats.separationRadius = this.separationRadius;
        stats.critChance = this.critChance;
        stats.critMultiplier = this.critMultiplier;
        stats.lifestealPercent = this.lifestealPercent;
        stats.healToFull();
    }

}

import { _decorator, CCFloat, CCInteger, Component } from 'cc';
import EventManager from '../../Utility/EventManager';
import { LevelUpConfig } from '../Data/LevelUpConfig';
import { GameplayEvents } from '../Events/GameplayEvents';
import type { HeroController } from './HeroController';

const { ccclass, property } = _decorator;

@ccclass('HeroProgress')
export class HeroProgress extends Component {

    public hero: HeroController = null;

    @property({ type: CCInteger })
    public startLevel: number = 1;

    @property({ type: CCFloat })
    public baseExpToLevelOverride: number = 0;

    @property({ type: CCFloat })
    public expGrowthOverride: number = 0;

    @property({ type: CCFloat })
    public expShareWeight: number = 1;

    public exp: number = 0;
    public level: number = 1;
    public expToNext: number = 20;

    private _pendingLevelUps: number = 0;

    onLoad() {
        this.level = Math.max(1, Math.floor(this.startLevel));
        this.recalcExpToNext();
    }

    start() {
        this.recalcExpToNext();
    }

    public get pendingLevelUps(): number {
        return this._pendingLevelUps;
    }

    public addExp(amount: number) {
        if (amount <= 0 || !this.hero?.isAlive) return;
        this.exp += amount;

        while (this.exp >= this.expToNext) {
            this.exp -= this.expToNext;
            this.level += 1;
            this._pendingLevelUps += 1;
            this.recalcExpToNext();
            EventManager.instance.emit(GameplayEvents.HeroLevelUp, this.hero, this.level);
        }
    }

    public consumePendingLevelUp(): boolean {
        if (this._pendingLevelUps <= 0) return false;
        this._pendingLevelUps -= 1;
        return true;
    }

    public recalcExpToNext() {
        const cfg = LevelUpConfig.instance;

        const hasOverride = this.baseExpToLevelOverride > 0 || this.expGrowthOverride > 0;
        if (cfg && cfg.useKillThresholds && !hasOverride) {
            const kills = cfg.killsForLevel(this.level);
            this.expToNext = Math.max(1, Math.round(kills * Math.max(1, cfg.expPerKill)));
            return;
        }

        const base = this.baseExpToLevelOverride > 0
            ? this.baseExpToLevelOverride
            : (cfg ? Math.max(1, cfg.baseExpToLevel) : 20);
        const growth = this.expGrowthOverride > 0
            ? this.expGrowthOverride
            : (cfg ? Math.max(1, cfg.expGrowthPerLevel) : 1.2);
        this.expToNext = Math.max(1, Math.floor(base * Math.pow(growth, Math.max(0, this.level - 1))));
    }
}

import { _decorator, CCFloat, CCInteger, Component } from 'cc';

const { ccclass, property } = _decorator;

@ccclass('LevelUpConfig')
export class LevelUpConfig extends Component {
    public static instance: LevelUpConfig;

    @property(CCInteger)
    public killsPerLevel: number = 5;

    @property(CCFloat)
    public expPerKill: number = 10;

    @property
    public useKillThresholds: boolean = true;

    @property({ type: CCInteger })
    public killsToFirstLevel: number = 3;

    @property({ type: CCInteger })
    public killsToSecondLevel: number = 4;

    @property({ type: CCFloat })
    public killGrowthPerLevel: number = 2;

    public killsForLevel(level: number): number {
        if (level <= 1) return Math.max(1, Math.floor(this.killsToFirstLevel));
        const second = Math.max(1, Math.floor(this.killsToSecondLevel));
        const growth = Math.max(1, this.killGrowthPerLevel);
        return Math.max(1, Math.round(second * Math.pow(growth, level - 2)));
    }

    @property({ type: CCFloat })
    public baseExpToLevel: number = 20;

    @property({ type: CCFloat })
    public expGrowthPerLevel: number = 1.2;

    onLoad() {
        LevelUpConfig.instance = this;
    }
}

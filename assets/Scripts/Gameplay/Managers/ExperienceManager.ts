import { _decorator, Component } from 'cc';
import EventManager from '../../Utility/EventManager';
import { LevelUpConfig } from '../Data/LevelUpConfig';
import { GameplayEvents } from '../Events/GameplayEvents';
import { HeroPartyManager } from '../Hero/HeroPartyManager';
import { HeroProgress } from '../Hero/HeroProgress';
import { PlayerController } from '../Player/PlayerController';
import { GameManager } from './GameManager';
import { GameMode } from './GameMode';

const { ccclass, property } = _decorator;

@ccclass('ExperienceManager')
export class ExperienceManager extends Component {
    public static instance: ExperienceManager;

    @property(LevelUpConfig)
    public config: LevelUpConfig = null;

    @property(HeroPartyManager)
    public party: HeroPartyManager = null;

    onLoad() {
        ExperienceManager.instance = this;
        if (!this.config) this.config = this.getComponent(LevelUpConfig) || LevelUpConfig.instance;
        if (!this.party) this.party = HeroPartyManager.instance;
    }

    onEnable() {
        EventManager.instance.on(GameplayEvents.EnemyDied, this.onEnemyDied, this);
    }

    onDisable() {
        EventManager.instance.off(GameplayEvents.EnemyDied, this.onEnemyDied, this);
    }

    private onEnemyDied() {
        const cfg = this.config || LevelUpConfig.instance;
        const expPerKill = cfg ? Math.max(0, cfg.expPerKill) : 10;
        if (expPerKill <= 0) return;

        const party = this.party || HeroPartyManager.instance;
        const gm = GameManager.instance;
        const mode = gm ? gm.gameMode : GameMode.Solo;

        if (party) {
            const alive = party.aliveHeroes;
            if (alive.length === 0) return;

            if (mode === GameMode.MultiHero) {

                let totalWeight = 0;
                for (let i = 0; i < alive.length; i++) {
                    totalWeight += Math.max(0, alive[i].progress?.expShareWeight ?? 1);
                }
                if (totalWeight <= 0) return;

                for (let i = 0; i < alive.length; i++) {
                    const p = alive[i].progress;
                    if (!p) continue;
                    const w = Math.max(0, p.expShareWeight ?? 1);
                    if (w > 0) p.addExp(expPerKill * w / totalWeight);
                }
            } else {
                const main = party.mainHero;
                main?.progress?.addExp(expPerKill);
            }
            return;
        }

        const progress =
            PlayerController.instance?.getComponent(HeroProgress) ||
            this.getComponent(HeroProgress);
        progress?.addExp(expPerKill);
    }
}

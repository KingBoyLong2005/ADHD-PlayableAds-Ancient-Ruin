import { _decorator, CCFloat, Component, Enum } from 'cc';
import { GlobalEvent } from '../../Utility/Event/GlobalEvent';
import EventManager from '../../Utility/EventManager';
import { GameplayLog } from '../Debug/GameplayLog';
import { GameplayEvents } from '../Events/GameplayEvents';
import { HeroPartyManager } from '../Hero/HeroPartyManager';
import { PlayerController } from '../Player/PlayerController';
import { AnimState } from '../Player/PlayerAnimation';
import { WinLoseUI } from '../UI/WinLoseUI';
import { GameMode } from './GameMode';
import { LevelUpManager } from './LevelUpManager';
import { RunFlowHook } from './RunFlow';

const { ccclass, property } = _decorator;

export enum GameState {
    Ready = 0,
    Playing = 1,
    Paused = 2,
    Win = 3,
    Lose = 4,
}

@ccclass('GameManager')
export class GameManager extends Component {
    public static instance: GameManager;

    @property({ type: Enum(GameState) })
    public state: GameState = GameState.Ready;

    @property({ type: Enum(GameMode) })
    public gameMode: GameMode = GameMode.Solo;

    @property(WinLoseUI)
    public winLoseUI: WinLoseUI = null;

    @property
    public autoStart: boolean = true;

    @property
    public requireHeroSelect: boolean = false;

    @property({ type: CCFloat })
    public losePopupDelay: number = 1.2;

    public flow: RunFlowHook = null;

    private _winPending: boolean = false;

    public get isPaused(): boolean {
        return this.state === GameState.Paused || this.state === GameState.Win || this.state === GameState.Lose;
    }

    public inputLocked: boolean = false;

    public get canControl(): boolean {
        return this.state === GameState.Playing && this.gameMode === GameMode.Solo && !this.inputLocked;
    }

    public get isPlaying(): boolean {
        return this.state === GameState.Playing;
    }

    onLoad() {
        GameManager.instance = this;
    }

    onEnable() {
        EventManager.instance.on(GameplayEvents.AllEnemiesCleared, this.onAllEnemiesCleared, this);
        EventManager.instance.on(GameplayEvents.PlayerDied, this.onPlayerDied, this);
        EventManager.instance.on(GameplayEvents.AllHeroesDied, this.onAllHeroesDied, this);
        EventManager.instance.on(GameplayEvents.LevelUpReady, this.onLevelUpReady, this);
        EventManager.instance.on(GameplayEvents.SkillSelected, this.onSkillSelected, this);
        EventManager.instance.on(GameplayEvents.HpChanged, this.onHpChanged, this);
    }

    onDisable() {
        EventManager.instance.off(GameplayEvents.AllEnemiesCleared, this.onAllEnemiesCleared, this);
        EventManager.instance.off(GameplayEvents.PlayerDied, this.onPlayerDied, this);
        EventManager.instance.off(GameplayEvents.AllHeroesDied, this.onAllHeroesDied, this);
        EventManager.instance.off(GameplayEvents.LevelUpReady, this.onLevelUpReady, this);
        EventManager.instance.off(GameplayEvents.SkillSelected, this.onSkillSelected, this);
        EventManager.instance.off(GameplayEvents.HpChanged, this.onHpChanged, this);
    }

    start() {

        if (this.autoStart && !this.requireHeroSelect) {
            this.startGame();
        }
    }

    public startGame() {
        this.state = GameState.Playing;
        this._winPending = false;
        EventManager.instance.emit(GameplayEvents.GameResumed);
    }

    public pauseGame() {
        if (this.state !== GameState.Playing) return;
        this.state = GameState.Paused;
        GameplayLog.log('game', 'PAUSE — hero/enemy dừng, animation đóng băng');
        EventManager.instance.emit(GameplayEvents.GamePaused);
    }

    public resumeGame() {
        if (this.state !== GameState.Paused) return;
        this.state = GameState.Playing;
        GameplayLog.log('game', 'RESUME');
        EventManager.instance.emit(GameplayEvents.GameResumed);
        this.tryFlushPendingWin();
    }

    private onLevelUpReady() {
        GameplayLog.log('game', 'popup chọn skill mở -> yêu cầu dừng game');
        this.pauseGame();
    }

    private onSkillSelected() {

        if (LevelUpManager.instance?.hasPending) return;
        this.resumeGame();
    }

    private onHpChanged(stats: any) {
        if (!stats?.isPlayer || !stats.isDead) return;
        if (this.gameMode !== GameMode.Solo) return;

        const controlled = PlayerController.instance;
        if (controlled?.stats && controlled.stats !== stats) return;

        EventManager.instance.emit(GameplayEvents.PlayerDied);
    }

    private onAllEnemiesCleared() {
        if (this.state === GameState.Win || this.state === GameState.Lose) return;

        this._winPending = true;

        this.scheduleOnce(() => this.tryFlushPendingWin(), 0);
    }

    public tryFlushPendingWin() {
        if (!this._winPending) return;
        if (this.state === GameState.Lose) {
            this._winPending = false;
            return;
        }
        if (LevelUpManager.instance?.hasPending) return;
        if (this.state === GameState.Paused) return;

        if (this.flow && !this.flow.canWin()) {
            this._winPending = false;
            return;
        }

        this._winPending = false;
        this.executeWin();
    }

    private executeWin() {
        if (this.state === GameState.Win || this.state === GameState.Lose) return;
        this.state = GameState.Win;
        const party = HeroPartyManager.instance;
        if (party) {
            const alive = party.aliveHeroes;
            for (let i = 0; i < alive.length; i++) {
                alive[i].playWin();
            }
        } else {
            PlayerController.instance?.anim?.play(AnimState.Win);
        }
        this.winLoseUI?.showWin();
        EventManager.instance.emit(GameplayEvents.GameWin);
    }

    private onPlayerDied() {
        if (this.gameMode === GameMode.MultiHero) return;
        this._winPending = false;

        PlayerController.instance?.playDie();
        this.triggerLose();
    }

    private onAllHeroesDied() {
        this._winPending = false;
        const party = HeroPartyManager.instance;
        const heroes = party?.heroes || [];
        for (let i = 0; i < heroes.length; i++) {
            heroes[i]?.playDie();
        }
        this.triggerLose();
    }

    private triggerLose() {
        if (this.state === GameState.Win || this.state === GameState.Lose) return;
        this.state = GameState.Lose;
        GameplayLog.log('game', 'THUA — hero gục, quái ngừng đánh, chờ bày popup');
        EventManager.instance.emit(GameplayEvents.GameLose);
        this.showLosePopup();
    }

    private showLosePopup() {
        const show = () => {

            if (this.flow?.ownsEnding()) return;
            this.winLoseUI?.showLose();
            EventManager.instance.emit(GlobalEvent.SHOW_LOSE);
        };
        if (this.losePopupDelay > 0) {
            this.scheduleOnce(show, this.losePopupDelay);
        } else {
            show();
        }
    }
}

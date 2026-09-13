import { _decorator, CCFloat, CCInteger, Component } from 'cc';
import EventManager from '../../Utility/EventManager';
import { LevelUpConfig } from '../Data/LevelUpConfig';
import { GameplayLog } from '../Debug/GameplayLog';
import { GameplayEvents } from '../Events/GameplayEvents';
import { HeroController } from '../Hero/HeroController';
import { SkillCatalog } from '../Skills/SkillCatalog';
import { SkillDefinition } from '../Skills/SkillDefinition';
import { SkillSelector } from '../Skills/SkillSelector';
import { MapIntroUI } from '../UI/MapIntroUI';
import { SkillSelectUI } from '../UI/SkillSelectUI';
import { HeroVfx } from '../Vfx/HeroVfx';
import { GameManager, GameState } from './GameManager';

const { ccclass, property } = _decorator;

interface LevelUpRequest {
    hero: HeroController;
    level: number;

    spawnFx: boolean;
}

export interface SpinSkillUI {

    canShowFor(hero: HeroController): boolean;
    showForHero(hero: HeroController): void;
    hide(): void;
    onSkillChosen: (skill: SkillDefinition, index: number) => void;
}

@ccclass('LevelUpManager')
export class LevelUpManager extends Component {
    public static instance: LevelUpManager;

    @property(LevelUpConfig)
    public config: LevelUpConfig = null;

    @property(SkillCatalog)
    public catalog: SkillCatalog = null;

    @property(SkillSelectUI)
    public skillSelectUI: SkillSelectUI = null;

    @property
    public pickOnHeroSelected: boolean = true;

    @property
    public waitForMapIntro: boolean = true;

    @property({ type: CCInteger })
    public maxPopups: number = 3;

    @property({ type: CCFloat })
    public fxLeadTime: number = 0.6;

    public spinUI: SpinSkillUI = null;

    private _queue: LevelUpRequest[] = [];
    private _shownCount: number = 0;
    private _showing: boolean = false;
    private _current: LevelUpRequest = null;
    private _currentChoices: SkillDefinition[] = [];
    private _warnedNoUI: boolean = false;

    public level: number = 1;

    public get hasPending(): boolean {
        return this._showing || this._queue.length > 0;
    }

    private get gameOver(): boolean {
        const gm = GameManager.instance;
        return !!gm && (gm.state === GameState.Lose || gm.state === GameState.Win);
    }

    onLoad() {
        LevelUpManager.instance = this;
        if (!this.config) this.config = this.getComponent(LevelUpConfig);
        if (!this.catalog) this.catalog = this.getComponent(SkillCatalog);
    }

    onEnable() {
        EventManager.instance.on(GameplayEvents.HeroLevelUp, this.onHeroLevelUp, this);
        EventManager.instance.on(GameplayEvents.HeroSelected, this.onHeroSelected, this);
        EventManager.instance.on(GameplayEvents.MapIntroFinished, this.onMapIntroFinished, this);
    }

    onDisable() {
        EventManager.instance.off(GameplayEvents.HeroLevelUp, this.onHeroLevelUp, this);
        EventManager.instance.off(GameplayEvents.HeroSelected, this.onHeroSelected, this);
        EventManager.instance.off(GameplayEvents.MapIntroFinished, this.onMapIntroFinished, this);
    }

    private get introBlocking(): boolean {
        if (!this.waitForMapIntro) return false;
        const intro = MapIntroUI.instance;
        return !!intro && intro.isValid && !intro.isDone;
    }

    private onMapIntroFinished() {
        if (this._showing || this._queue.length === 0) return;
        this.showNext();
    }

    private onHeroSelected(hero: HeroController) {
        if (!this.pickOnHeroSelected || !hero) return;
        this.scheduleOnce(() => {
            if (hero.isValid && hero.isAlive) this.enqueue(hero);
        }, 0);
    }

    private onHeroLevelUp(hero: HeroController, level: number) {
        if (!hero) return;
        this._queue.push({ hero, level, spawnFx: false });
        if (!this._showing) {
            this.showNext();
        }
    }

    public enqueue(hero: HeroController) {
        if (!hero) return;
        this._queue.push({ hero, level: hero.progress?.level || 1, spawnFx: true });
        if (!this._showing) {
            this.showNext();
        }
    }

    public get shownCount(): number {
        return this._shownCount;
    }

    private showNext() {
        if (this.introBlocking) {
            GameplayLog.log('skillui', `hoãn ${this._queue.length} lượt chọn skill — màn giới thiệu map chưa xong`);
            return;
        }

        while (this._queue.length > 0) {

            if (this.gameOver) {
                GameplayLog.log('skillui', `bỏ ${this._queue.length} lượt chọn skill — ván đã kết thúc`);
                this._queue.length = 0;
                break;
            }

            if (this.maxPopups > 0 && this._shownCount >= this.maxPopups) {
                GameplayLog.log('skillui', `bỏ ${this._queue.length} lượt chọn skill — đã đủ ${this.maxPopups} lần`);
                this._queue.length = 0;
                break;
            }

            const req = this._queue.shift();
            if (!req?.hero || !req.hero.isAlive) continue;

            req.hero.progress?.consumePendingLevelUp();

            this._showing = true;
            this._shownCount += 1;
            this._current = req;
            this.level = req.level;

            const spin = this.spinUI && this.spinUI.canShowFor(req.hero) ? this.spinUI : null;
            this._currentChoices = spin
                ? []
                : SkillSelector.pickRandom(this.catalog, 3, null, req.hero.heroClass);
            EventManager.instance.emit(GameplayEvents.LevelUpReady, this._currentChoices, req.level, req.hero);

            if (req.spawnFx) (req.hero.vfx || HeroVfx.of(req.hero.node))?.playLevelUp();

            if (this.fxLeadTime > 0) {
                this.scheduleOnce(() => this.present(req, spin), this.fxLeadTime);
            } else {
                this.present(req, spin);
            }
            return;
        }

        this._showing = false;
        this._current = null;
        this._currentChoices = [];

        const gm = GameManager.instance;
        if (gm && gm.state === GameState.Paused) {
            gm.resumeGame();
        } else {
            gm?.tryFlushPendingWin();
        }
    }

    private present(req: LevelUpRequest, spin: SpinSkillUI) {

        if (this.gameOver || !req.hero || !req.hero.isValid || !req.hero.isAlive) {
            this.finishCurrentAndContinue();
            return;
        }

        if (spin) {
            spin.onSkillChosen = () => {

                spin.hide();
                this.finishCurrentAndContinue();
            };
            spin.showForHero(req.hero);
            return;
        }

        const canShow = !!this.skillSelectUI && this.skillSelectUI.canDisplay;
        if (!canShow && this.skillSelectUI && this._currentChoices.length > 0 && !this._warnedNoUI) {
            this._warnedNoUI = true;
            console.warn(
                '[LevelUpManager] SkillSelectUI chưa dựng xong (thiếu skillSlotPrefab/slotContainer '
                    + 'hoặc slots) — tự chọn skill đầu tiên để game không đứng hình.',
            );
        }

        if (!canShow || this._currentChoices.length === 0) {
            const skill = this._currentChoices[0];
            if (skill) {
                GameplayLog.log(
                    'skillui',
                    `tự chọn "${skill.displayName || skill.id}" cho ${req.hero.heroName} (lv ${req.level}) `
                        + '— panel chưa dựng nên không hỏi người chơi',
                );
                req.hero.skillApplier?.apply(skill, req.hero.stats);
                EventManager.instance.emit(GameplayEvents.SkillSelected, skill, req.hero);
            } else {

                EventManager.instance.emit(GameplayEvents.SkillSelected, null, req.hero);
            }
            this.finishCurrentAndContinue();
            return;
        }

        this.skillSelectUI.showChoices(
            this._currentChoices,
            (skill: SkillDefinition) => {
                req.hero.skillApplier?.apply(skill, req.hero.stats);
                this.skillSelectUI.hide();
                this.finishCurrentAndContinue();
            },
            () => this.rerollChoices(),
            req.hero.heroName,
        );
    }

    private finishCurrentAndContinue() {
        this._current = null;
        this._currentChoices = [];

        this._showing = false;
        this.showNext();
    }

    public rerollChoices() {
        if (!this._showing || !this.skillSelectUI || !this._current) return;

        const exclude = this.skillSelectUI.getCurrentSkillIds();
        const next = SkillSelector.pickRandom(this.catalog, 3, exclude, this._current.hero.heroClass);
        if (next.length === 0) return;

        this._currentChoices = next;
        this.skillSelectUI.refreshChoices(next);
        EventManager.instance.emit(
            GameplayEvents.LevelUpReady,
            this._currentChoices,
            this._current.level,
            this._current.hero,
        );
    }
}

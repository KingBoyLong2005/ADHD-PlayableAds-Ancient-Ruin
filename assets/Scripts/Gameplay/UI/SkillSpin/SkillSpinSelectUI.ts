import { _decorator, Button, CCFloat, CCString, Component, Enum, Label, Node, SpriteFrame } from 'cc';
import { DEBUG } from 'cc/env';
import EventManager from '../../../Utility/EventManager';
import { SoundManager } from '../../../Utility/SoundManager';
import { GameplayEvents } from '../../Events/GameplayEvents';
import { HeroClass } from '../../Hero/HeroClass';

import type { HeroController } from '../../Hero/HeroController';
import { LevelUpManager } from '../../Managers/LevelUpManager';
import { PlayerController } from '../../Player/PlayerController';
import { SkillApplier } from '../../Skills/SkillApplier';
import { SkillDefinition } from '../../Skills/SkillDefinition';
import { getSkillStatKey } from '../../Skills/SkillType';
import { SkillCardView } from './SkillCardView';
import { SkillPool } from './SkillPool';
import { SkillTutorialHand } from './SkillTutorialHand';

const { ccclass, property } = _decorator;

export enum SpinHeroClass {
    Mage = 1,
    Ranger = 2,
    Warrior = 4,
}

@ccclass('SkillSpinSelectUI')
export class SkillSpinSelectUI extends Component {
    public static instance: SkillSpinSelectUI = null;

    @property({ type: Node })
    public panelRoot: Node = null;

    @property({ type: [SkillCardView] })
    public cards: SkillCardView[] = [];

    @property({ type: SkillPool })
    public pool: SkillPool = null;

    public targetHero: HeroController = null;

    @property({ type: Enum(SpinHeroClass) })
    public heroClass: SpinHeroClass = SpinHeroClass.Warrior;

    @property
    public useForLevelUp: boolean = true;

    @property({ type: CCFloat })
    public spinTime: number = 1.1;

    @property({ type: CCFloat })
    public stagger: number = 0.35;

    @property({ type: CCFloat })
    public freeSpinTime: number = 0.45;

    @property({ type: [CCString] })
    public forcedSkillIds: string[] = ['', '', ''];

    @property
    public allowDuplicates: boolean = false;

    @property
    public autoSpinOnStart: boolean = true;

    @property
    public hideOnStart: boolean = false;

    @property
    public hideOnSelect: boolean = true;

    @property
    public respinOnShow: boolean = true;

    @property(Button)
    public spinButton: Button = null;

    @property(Label)
    public titleLabel: Label = null;

    @property({ type: SkillTutorialHand })
    public tutorialHand: SkillTutorialHand = null;

    @property({ type: CCFloat })
    public tutorialDelay: number = 0.6;

    @property
    public tutorialOnce: boolean = false;

    @property
    public dimCardsWhileSpinning: boolean = false;

    public onSkillChosen: (skill: SkillDefinition, index: number) => void = null;

    private _runtimeForced: string[] = null;
    private _results: SkillDefinition[] = [];
    private _spinning: boolean = false;
    private _pending: number = 0;

    private _selectable: boolean = false;

    private _hasStarted: boolean = false;

    private static _tutorialShown: boolean = false;

    public get isSpinning(): boolean {
        return this._spinning;
    }

    public get canSelect(): boolean {
        return this._selectable;
    }

    public get results(): SkillDefinition[] {
        return this._results.slice();
    }

    onLoad() {
        SkillSpinSelectUI.instance = this;

        if (DEBUG) (globalThis as any).SkillSpin = this;

        if (!this.pool) this.pool = this.getComponent(SkillPool);

        for (let i = 0; i < this.cards.length; i++) {
            const card = this.cards[i];
            if (!card) continue;
            card.setSelectHandler((skill) => this.onCardSelected(skill, i));
        }
        this.setCardsSelectable(false);

        if (this.panelRoot && this.panelRoot !== this.node) {
            this.panelRoot.on(Node.EventType.ACTIVE_IN_HIERARCHY_CHANGED, this.onPanelActiveChanged, this);
        }

        this.registerWithLevelUp();
    }

    onEnable() {
        if (this.spinButton) this.spinButton.node.on(Button.EventType.CLICK, this.onSpinButton, this);

        this.scheduleRespin();
    }

    onDisable() {
        if (this.spinButton) this.spinButton.node.off(Button.EventType.CLICK, this.onSpinButton, this);

        this.abortSpin();
    }

    start() {

        this.registerWithLevelUp();
        this._hasStarted = true;

        if (this.hideOnStart) {
            this.hide();
            return;
        }
        if (this.autoSpinOnStart) this.spin();
    }

    onDestroy() {
        if (this.panelRoot && this.panelRoot.isValid && this.panelRoot !== this.node) {
            this.panelRoot.off(Node.EventType.ACTIVE_IN_HIERARCHY_CHANGED, this.onPanelActiveChanged, this);
        }
        if (SkillSpinSelectUI.instance === this) SkillSpinSelectUI.instance = null;
        if (DEBUG && (globalThis as any).SkillSpin === this) (globalThis as any).SkillSpin = null;
        const mgr = LevelUpManager.instance;
        if (mgr && mgr.spinUI === this) mgr.spinUI = null;
    }

    private isPanelVisible(): boolean {
        const root = this.panelRoot || this.node;
        return root.isValid && root.activeInHierarchy;
    }

    private onPanelActiveChanged() {
        if (!this.panelRoot || !this.panelRoot.isValid) return;
        if (!this.panelRoot.activeInHierarchy) {
            this.abortSpin();
            return;
        }
        this.scheduleRespin();
    }

    private scheduleRespin() {
        if (!this._hasStarted || !this.respinOnShow) return;
        if (!this.isPanelVisible()) return;
        this.setCardsSelectable(false);
        this.stopTutorial();
        this.unschedule(this._respin);
        this.scheduleOnce(this._respin, 0);
    }

    private _respin = () => {
        if (this._spinning || !this.isPanelVisible()) return;
        this.spin();
    };

    private registerWithLevelUp() {
        if (!this.useForLevelUp) return;
        const mgr = LevelUpManager.instance;
        if (mgr) mgr.spinUI = this;
    }

    public show(heroClass: SpinHeroClass = null) {
        if (heroClass !== null) this.heroClass = heroClass;
        if (this.panelRoot) this.panelRoot.active = true;
        this.node.active = true;
        this.spin();
    }

    public canShowFor(hero: HeroController): boolean {
        if (!this.pool) return false;
        const cls = hero?.heroClass || (this.heroClass as number as HeroClass);
        if (this.pool.getClassSkills(cls).length === 0) return false;
        for (const card of this.cards) {
            if (card) return true;
        }
        return false;
    }

    public showForHero(hero: HeroController) {
        this.abortSpin();
        this.targetHero = hero;

        if (this.titleLabel) this.titleLabel.string = (hero?.heroName || '').toUpperCase();
        this.show();
    }

    public hide() {

        this.abortSpin();
        if (this.panelRoot) this.panelRoot.active = false;
    }

    public abortSpin() {

        this.stopTutorial();
        this.setCardsSelectable(false);
        this.unschedule(this._respin);
        if (!this._spinning && this._pending === 0) return;
        this.unscheduleAllCallbacks();
        this._pending = 0;
        this._spinning = false;
    }

    public setForcedSkills(ids: string[]) {
        this._runtimeForced = ids ? ids.slice() : null;
    }

    public spin(forcedIds: string[] = null) {
        if (this._spinning) return;
        if (forcedIds) this.setForcedSkills(forcedIds);

        const pool = this.getHeroSkills();
        if (pool.length === 0) {
            console.warn('[SkillSpinSelectUI] Không có skill nào hợp lệ cho class này.');
            return;
        }

        this._results = this.resolveResults(pool);
        this._runtimeForced = null;

        const spinIcons = this.buildSpinIcons(pool);
        this._spinning = true;
        this._pending = 0;

        this.stopTutorial();
        this.setCardsSelectable(false);
        SoundManager.instance?.playSpinStart();

        for (const card of this.cards) {
            if (!card) continue;
            card.setSpinPool(spinIcons);
            card.beginSpin();
        }

        for (let i = 0; i < this.cards.length; i++) {
            const card = this.cards[i];
            if (!card) continue;
            const skill = this._results[i] || null;
            const icon = skill ? this.pool?.getIcon(skill.id) : null;
            this._pending++;
            this.scheduleOnce(() => {
                card.settle(skill, icon, this.spinTime);
                this.scheduleOnce(() => this.onCardSettled(), this.spinTime);
            }, this.freeSpinTime + i * this.stagger);
        }

        if (this._pending === 0) this._spinning = false;
    }

    private setCardsSelectable(value: boolean) {
        this._selectable = value;
        for (const card of this.cards) {
            if (card) card.setSelectable(value, this.dimCardsWhileSpinning);
        }
    }

    private onAllRevealed() {
        this.setCardsSelectable(true);
        if (!this.tutorialHand) return;

        if (!this.isPanelVisible()) return;
        if (this.tutorialOnce && SkillSpinSelectUI._tutorialShown) return;

        if (!this.cards.some((c) => c && c.skill)) return;
        this.scheduleOnce(this._startTutorial, Math.max(0, this.tutorialDelay));
    }

    private _startTutorial = () => {
        if (!this.tutorialHand || !this._selectable) return;
        SkillSpinSelectUI._tutorialShown = true;
        const targets: Node[] = [];
        for (const card of this.cards) {
            if (card && card.skill) targets.push(card.node);
        }
        if (targets.length > 0) this.tutorialHand.play(targets);
    };

    private stopTutorial() {
        this.unschedule(this._startTutorial);
        if (this.tutorialHand) this.tutorialHand.stop();
    }

    public snapTo(ids: string[]) {

        this.abortSpin();
        const pool = this.getHeroSkills();
        if (pool.length === 0) return;
        this.setForcedSkills(ids);
        this._results = this.resolveResults(pool);
        this._runtimeForced = null;
        for (let i = 0; i < this.cards.length; i++) {
            const card = this.cards[i];
            if (!card) continue;
            const skill = this._results[i] || null;
            card.setSpinPool(this.buildSpinIcons(pool));
            card.snap(skill, skill ? this.pool?.getIcon(skill.id) : null);
        }

        this.onAllRevealed();
    }

    private getHeroSkills(): SkillDefinition[] {
        if (!this.pool) return [];

        const cls = this.targetHero?.heroClass || (this.heroClass as number as HeroClass);
        return this.pool.getClassSkills(cls);
    }

    private getForcedIds(): string[] {
        return this._runtimeForced || this.forcedSkillIds || [];
    }

    private resolveResults(pool: SkillDefinition[]): SkillDefinition[] {
        const count = this.cards.length || 3;
        const forced = this.getForcedIds();
        const results: SkillDefinition[] = new Array(count).fill(null);
        const used = new Set<string>();
        const usedStats = new Set<string>();

        const statKey = (s: SkillDefinition) => getSkillStatKey(s.effectKind, s.statBuffKind, s.skillType);
        const take = (i: number, skill: SkillDefinition) => {
            results[i] = skill;
            used.add(skill.id);
            const key = statKey(skill);
            if (key) usedStats.add(key);
        };

        for (let i = 0; i < count; i++) {
            const id = forced[i];
            if (!id) continue;
            const skill = pool.find((s) => s.id === id);
            if (!skill) {
                console.warn(
                    `[SkillSpinSelectUI] "${id}" không thuộc bộ skill của class hiện tại — cột ${i} sẽ random.`,
                );
                continue;
            }
            take(i, skill);
        }

        const pickFrom = (): SkillDefinition[] => {
            if (this.allowDuplicates) return pool;
            const byId = pool.filter((s) => !used.has(s.id));
            const byStat = byId.filter((s) => {
                const key = statKey(s);
                return !key || !usedStats.has(key);
            });
            if (byStat.length > 0) return byStat;
            if (byId.length > 0) return byId;
            return pool;
        };

        for (let i = 0; i < count; i++) {
            if (results[i]) continue;
            const candidates = pickFrom();
            if (candidates.length === 0) continue;
            take(i, candidates[Math.floor(Math.random() * candidates.length)]);
        }

        return results;
    }

    private buildSpinIcons(pool: SkillDefinition[]): SpriteFrame[] {
        if (!this.pool) return [];
        const icons: SpriteFrame[] = [];
        for (const skill of pool) {
            const icon = this.pool.getIcon(skill.id);
            if (icon && icons.indexOf(icon) < 0) icons.push(icon);
        }
        return icons;
    }

    private onCardSettled() {
        this._pending--;
        if (this._pending > 0) return;
        this._spinning = false;

        SoundManager.instance?.playSpinStop();
        this.onAllRevealed();
    }

    private onSpinButton() {
        if (this._spinning) return;
        SoundManager.instance?.playButtonClick();
        this.spin();
    }

    private onCardSelected(skill: SkillDefinition, index: number) {

        if (this._spinning || !this._selectable || !skill) return;

        this.setCardsSelectable(false);
        this.stopTutorial();

        const hero = this.targetHero;
        const applier = hero?.skillApplier || SkillApplier.instance;
        const stats = hero?.stats || PlayerController.instance?.stats || null;
        if (applier && stats) {

            applier.apply(skill, stats);
        } else {

            EventManager.instance.emit(GameplayEvents.SkillSelected, skill, hero || null);
        }

        if (DEBUG) console.log(`[SkillSpinSelectUI] Đã chọn: ${skill.id} (cột ${index})`);

        if (this.onSkillChosen) this.onSkillChosen(skill, index);

        if (this.hideOnSelect) this.hide();
    }
}

import { _decorator, CCFloat, Component, Enum, instantiate, Node, Prefab } from 'cc';
import EventManager from '../../Utility/EventManager';
import { GameplayEvents } from '../Events/GameplayEvents';
import { GameManager } from '../Managers/GameManager';
import { HeroClass } from './HeroClass';
import { MapIntroUI } from '../UI/MapIntroUI';
import { HeroController } from './HeroController';
import { HeroPartyManager } from './HeroPartyManager';

const { ccclass, property } = _decorator;

@ccclass('HeroSelectOption')
export class HeroSelectOption {
    @property({ type: Enum(HeroClass) })
    public heroClass: HeroClass = HeroClass.None;

    @property({ type: Prefab })
    public prefab: Prefab = null;

    @property({ type: Node })
    public sceneNode: Node = null;

    @property({ type: Prefab })
    public previewPrefab: Prefab = null;

    @property
    public displayName: string = '';
}

@ccclass('HeroSelectManager')
export class HeroSelectManager extends Component {
    public static instance: HeroSelectManager = null;

    @property({ type: [HeroSelectOption] })
    public options: HeroSelectOption[] = [];

    @property({ type: Node })
    public spawnPoint: Node = null;

    @property({ type: Node })
    public heroParent: Node = null;

    @property({ type: HeroPartyManager })
    public party: HeroPartyManager = null;

    @property({ type: Enum(HeroClass) })
    public fallbackClass: HeroClass = HeroClass.None;

    @property({ type: CCFloat })
    public fallbackDelay: number = 0;

    @property
    public waitForMapIntro: boolean = true;

    private _selected: HeroClass = HeroClass.None;
    private _hero: HeroController = null;

    public get selected(): HeroClass {
        return this._selected;
    }

    public get hero(): HeroController {
        return this._hero;
    }

    public get hasSelected(): boolean {
        return this._hero !== null;
    }

    onLoad() {
        HeroSelectManager.instance = this;
        if (!this.party) this.party = HeroPartyManager.instance || this.getComponent(HeroPartyManager);

        for (let i = 0; i < this.options.length; i++) {
            const n = this.options[i]?.sceneNode;
            if (n) n.active = false;
        }
    }

    start() {
        this.armFallback();
    }

    onDestroy() {
        EventManager.instance.off(GameplayEvents.MapIntroFinished, this.armFallback, this);
    }

    private armFallback() {
        if (this.fallbackClass === HeroClass.None || this.hasSelected) return;

        EventManager.instance.off(GameplayEvents.MapIntroFinished, this.armFallback, this);

        const intro = MapIntroUI.instance;
        if (this.waitForMapIntro && intro && intro.isValid && !intro.isDone) {
            EventManager.instance.on(GameplayEvents.MapIntroFinished, this.armFallback, this);
            return;
        }

        if (this.fallbackDelay > 0) {
            this.scheduleOnce(() => {
                if (!this.hasSelected) this.selectByClass(this.fallbackClass);
            }, this.fallbackDelay);
        } else {
            this.selectByClass(this.fallbackClass);
        }
    }

    public onClickSelect(_event: unknown, customEventData: string) {
        const cls = HeroClass[customEventData as keyof typeof HeroClass];
        if (typeof cls !== 'number') {
            console.warn('[HeroSelectManager] unknown HeroClass in CustomEventData:', customEventData);
            return;
        }
        this.selectByClass(cls as HeroClass);
    }

    public selectByClass(heroClass: HeroClass): HeroController {
        const opt = this.options.find((o) => o && o.heroClass === heroClass);
        if (!opt) {
            console.warn('[HeroSelectManager] no option for HeroClass', heroClass);
            return null;
        }
        return this.select(opt);
    }

    private select(opt: HeroSelectOption): HeroController {

        if (this.hasSelected) return this._hero;

        const node = this.buildHeroNode(opt);
        if (!node) return null;

        const hero = node.getComponent(HeroController);
        if (!hero) {
            console.warn('[HeroSelectManager] picked node has no HeroController:', node.name);
            node.destroy();
            return null;
        }

        hero.applyClass(opt.heroClass);
        this._hero = hero;
        this._selected = opt.heroClass;

        for (let i = 0; i < this.options.length; i++) {
            const other = this.options[i];
            if (other && other.sceneNode && other.sceneNode !== node) other.sceneNode.active = false;
        }

        const party = this.party || HeroPartyManager.instance;
        if (party) party.heroes = [hero];

        EventManager.instance.emit(GameplayEvents.HeroSelected, hero, opt.heroClass);
        GameManager.instance?.startGame();
        return hero;
    }

    private buildHeroNode(opt: HeroSelectOption): Node {
        if (opt.sceneNode) {
            opt.sceneNode.active = true;
            return opt.sceneNode;
        }
        if (!opt.prefab) {
            console.warn('[HeroSelectManager] option has neither prefab nor sceneNode');
            return null;
        }

        const node = instantiate(opt.prefab);
        const party = this.party || HeroPartyManager.instance;
        node.setParent(this.heroParent || party?.node || this.node);
        const anchor = this.spawnPoint || this.node;
        node.setWorldPosition(anchor.worldPosition);
        node.setWorldRotation(anchor.worldRotation);
        node.active = true;
        return node;
    }
}

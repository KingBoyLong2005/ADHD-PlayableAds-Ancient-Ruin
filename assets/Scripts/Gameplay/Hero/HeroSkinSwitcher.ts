import { _decorator, Animation, CCFloat, Component, Enum, Node, SkeletalAnimation } from 'cc';
import EventManager from '../../Utility/EventManager';
import { CharacterStats } from '../Combat/CharacterStats';
import { ProjectileFlightMode } from '../Combat/ProjectileFlightMode';
import { StatsProfile } from '../Data/StatsProfile';
import { GameplayEvents } from '../Events/GameplayEvents';
import { AnimState, PlayerAnimation } from '../Player/PlayerAnimation';
import { PlayerCombat } from '../Player/PlayerCombat';
import { HeroAutoCombat } from './HeroAutoCombat';
import { HeroClass } from './HeroClass';
import { HeroController } from './HeroController';

const { ccclass, property } = _decorator;

@ccclass('HeroSkinEntry')
export class HeroSkinEntry {
    @property({ type: Enum(HeroClass) })
    public heroClass: HeroClass = HeroClass.None;

    @property({ type: Node })
    public skin: Node = null;

    @property
    public applyStats: boolean = true;

    @property({ type: StatsProfile })
    public stats: StatsProfile = new StatsProfile();

    @property
    public applyCombatShape: boolean = true;

    @property({ type: Enum(ProjectileFlightMode) })
    public projectileMode: ProjectileFlightMode = ProjectileFlightMode.Straight;

    @property(CCFloat)
    public arcHeight: number = 3;

    @property
    public preferMeleeWhenBoth: boolean = true;
}

@ccclass('HeroSkinSwitcher')
export class HeroSkinSwitcher extends Component {
    @property({ type: [HeroSkinEntry] })
    public skins: HeroSkinEntry[] = [];

    @property(HeroController)
    public hero: HeroController = null;

    @property(PlayerAnimation)
    public anim: PlayerAnimation = null;

    @property
    public listenHeroSelected: boolean = true;

    @property({ type: Enum(HeroClass) })
    public defaultClass: HeroClass = HeroClass.None;

    private _current: HeroClass = HeroClass.None;

    public get current(): HeroClass {
        return this._current;
    }

    onLoad() {
        if (!this.hero) this.hero = this.getComponent(HeroController);
        this.resolveAnim();
        if (this.defaultClass !== HeroClass.None) {
            this.apply(this.defaultClass);
        }
    }

    onEnable() {
        if (this.listenHeroSelected) {
            EventManager.instance.on(GameplayEvents.HeroSelected, this.onHeroSelected, this);
        }
    }

    onDisable() {
        if (this.listenHeroSelected) {
            EventManager.instance.off(GameplayEvents.HeroSelected, this.onHeroSelected, this);
        }
    }

    private onHeroSelected(hero: HeroController, heroClass: HeroClass) {

        if (this.hero && hero !== this.hero) return;
        this.apply(heroClass);
    }

    public apply(heroClass: HeroClass): boolean {
        const entry = this.findEntry(heroClass);
        if (!entry || !entry.skin) {
            console.warn('[HeroSkinSwitcher] no skin for HeroClass', heroClass);
            return false;
        }

        for (let i = 0; i < this.skins.length; i++) {
            const s = this.skins[i];

            if (s && s.skin && s.skin !== entry.skin) s.skin.active = false;
        }
        entry.skin.active = true;

        this._current = entry.heroClass;

        if (this.hero) this.hero.applyClass(entry.heroClass);
        this.applyStats(entry);
        this.applyCombatShape(entry);
        this.rebindAnimation(entry.skin);
        return true;
    }

    private applyStats(entry: HeroSkinEntry) {
        if (!entry.applyStats || !entry.stats) return;
        const stats = this.hero?.stats || this.getComponent(CharacterStats);
        if (!stats) {
            console.warn('[HeroSkinSwitcher] no CharacterStats to apply the profile to');
            return;
        }
        entry.stats.applyTo(stats);
    }

    private applyCombatShape(entry: HeroSkinEntry) {
        if (!entry.applyCombatShape) return;
        const host = this.hero?.node || this.node;

        const auto = host.getComponent(HeroAutoCombat);
        if (auto) {
            auto.projectileMode = entry.projectileMode;
            auto.arcHeight = entry.arcHeight;
            auto.preferMeleeWhenBoth = entry.preferMeleeWhenBoth;
        }

        const manual = host.getComponent(PlayerCombat);
        if (manual) {
            manual.projectileMode = entry.projectileMode;
            manual.arcHeight = entry.arcHeight;
            manual.preferMeleeWhenBoth = entry.preferMeleeWhenBoth;
        }
    }

    private findEntry(heroClass: HeroClass): HeroSkinEntry {
        if (heroClass === HeroClass.None) return null;
        let masked: HeroSkinEntry = null;
        for (let i = 0; i < this.skins.length; i++) {
            const s = this.skins[i];
            if (!s || s.heroClass === HeroClass.None) continue;
            if (s.heroClass === heroClass) return s;
            if (!masked && (s.heroClass & heroClass) !== 0) masked = s;
        }
        return masked;
    }

    private rebindAnimation(skin: Node) {

        if (!this.anim) this.resolveAnim();
        if (!this.anim) return;

        const skeletal = skin.getComponent(SkeletalAnimation) || skin.getComponentInChildren(SkeletalAnimation);
        const animation = skeletal ? null : skin.getComponent(Animation) || skin.getComponentInChildren(Animation);
        if (!skeletal && !animation) {
            console.warn('[HeroSkinSwitcher] skin has no animation component:', skin.name);
            return;
        }

        this.anim.setSource(skeletal, animation);
        this.anim.play(AnimState.Idle, true);
    }

    private resolveAnim() {
        if (this.anim) return;
        this.anim = this.hero?.anim || this.getComponent(PlayerAnimation) || this.getComponentInChildren(PlayerAnimation);

        if (this.hero && !this.hero.anim) this.hero.anim = this.anim;
    }
}

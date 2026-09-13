import { _decorator, CCFloat, Component, Enum, instantiate, Node, Vec3 } from 'cc';
import EventManager from '../../Utility/EventManager';
import { VfxId } from '../../Utility/Pool/PoolManager';
import { GameplayLog } from '../Debug/GameplayLog';
import { GameplayEvents } from '../Events/GameplayEvents';
import { GameManager } from '../Managers/GameManager';
import { AnimState } from '../Player/PlayerAnimation';
import { PlayerCombat } from '../Player/PlayerCombat';
import { PlayerController } from '../Player/PlayerController';
import { HeroVfx } from '../Vfx/HeroVfx';
import { VfxService } from '../Vfx/VfxService';
import { HeroAutoCombat } from './HeroAutoCombat';
import { HeroClass } from './HeroClass';
import { HeroController } from './HeroController';
import { HeroPartyManager } from './HeroPartyManager';
import { SquadFollow } from './SquadFollow';
import { HeroSkinSwitcher } from './HeroSkinSwitcher';

const { ccclass, property } = _decorator;

const _joinSlot = new Vec3();

@ccclass('AllyRescue')
export class AllyRescue extends Component {
    @property({ type: HeroController })
    public hero: HeroController = null;

    @property({ type: Node })
    public heroTemplate: Node = null;

    @property({ type: Enum(HeroClass) })
    public heroClass: HeroClass = HeroClass.Mage;

    @property
    public heroName: string = 'Ally';

    @property({ type: Node })
    public heroParent: Node = null;

    @property({ type: Node })
    public cage: Node = null;

    @property({ type: Enum(VfxId) })
    public trapVfx: VfxId = VfxId.FX_Frost_Status;

    @property({ type: Enum(VfxId) })
    public rescueVfx: VfxId = VfxId.FX_Skeleton_Undead_Revive;

    @property({ type: CCFloat })
    public trapVfxLifetime: number = 0;

    @property
    public joinParty: boolean = true;

    @property({ type: CCFloat })
    public squadSlotAngle: number = 180;

    @property({ type: CCFloat })
    public squadSlotDistance: number = 2.4;

    @property({ type: CCFloat })
    public squadMaxLeash: number = 6;

    @property({ type: CCFloat })
    public joinDistance: number = 0.7;

    @property({ type: CCFloat })
    public joinMinTime: number = 0.4;

    @property({ type: CCFloat })
    public joinTimeout: number = 8;

    private _trapFx: Node = null;
    private _captive: boolean = false;
    private _freed: boolean = false;

    private _joining: boolean = false;
    private _joinWait: number = 0;
    private _squad: SquadFollow = null;

    public get freed(): boolean {
        return this._freed;
    }

    public get captive(): boolean {
        return this._captive;
    }

    public get joining(): boolean {
        return this._joining;
    }

    onLoad() {
        if (!this.hero) this.hero = this.getComponent(HeroController) || this.getComponentInChildren(HeroController);
    }

    onDisable() {
        this.clearTrapFx();

        if (this._joining) this.endJoin('node bị tắt giữa chừng');
    }

    update(dt: number) {
        if (!this._joining) return;

        const gm = GameManager.instance;
        if (gm && gm.isPaused) return;

        this._joinWait += dt;

        const hero = this.hero;
        const main = HeroPartyManager.instance?.mainHero;
        let arrived = !hero || !hero.isValid || !hero.isAlive || !main || main === hero;
        if (!arrived) {

            if (this._squad?.isValid) this._squad.slotWorldPosition(main, _joinSlot, dt);
            else Vec3.copy(_joinSlot, main.node.worldPosition);

            const p = hero.node.worldPosition;
            const dx = _joinSlot.x - p.x;
            const dz = _joinSlot.z - p.z;

            arrived = dx * dx + dz * dz <= this.joinDistance * this.joinDistance
                && this._joinWait >= this.joinMinTime;
            if (!arrived) hero.moveToward(_joinSlot, dt);
        }

        if (!arrived && (this.joinTimeout <= 0 || this._joinWait < this.joinTimeout)) return;
        this.endJoin(arrived ? 'đã đứng vào đội hình' : `chờ quá ${this.joinTimeout}s, thôi chạy`);
    }

    public cancelJoin() {
        if (this._joining) this.endJoin('bị gọi dừng');
    }

    private beginJoin(hero: HeroController, squad: SquadFollow) {
        const main = HeroPartyManager.instance?.mainHero;
        if (!main || main === hero) return;
        this._squad = squad;
        this._joining = true;
        this._joinWait = 0;
        if (squad) squad.enabled = false;
        hero.autoCombat = false;
        GameplayLog.log('game', `${this.displayName} chạy về nhập đội`);
    }

    private endJoin(why: string) {
        this._joining = false;
        const hero = this.hero;
        if (hero?.isValid) {
            hero.stopMove();
            const main = HeroPartyManager.instance?.mainHero;
            if (main && main !== hero) hero.faceToward(main.node.worldPosition);
            hero.autoCombat = true;
        }
        if (this._squad?.isValid) this._squad.enabled = true;
        this._squad = null;
        GameplayLog.log('game', `${this.displayName}: ${why}`);
    }

    public setCaptive() {
        if (this._freed) return;
        this._captive = true;

        const hero = this.hero || this.buildHero();
        if (hero) {
            hero.autoCombat = false;
            hero.stopMove();
            hero.anim?.play(AnimState.Idle, true);

            const main = HeroPartyManager.instance?.mainHero;
            if (main && main !== hero) hero.faceToward(main.node.worldPosition);

            const party = HeroPartyManager.instance;
            if (party?.heroes) {
                const i = party.heroes.indexOf(hero);
                if (i >= 0) party.heroes.splice(i, 1);
            }
        }

        if (this.cage) this.cage.active = true;
        this.spawnTrapFx();
        GameplayLog.log('game', `${this.displayName} đang bị nhốt — dọn sạch lượt quái này thì được cứu`);
    }

    public release(): boolean {
        if (this._freed) return false;
        const hero = this.hero;
        if (!hero || !hero.isValid) return false;

        this._freed = true;
        this._captive = false;

        this.clearTrapFx();
        if (this.cage) this.cage.active = false;

        if (this.rescueVfx !== VfxId.None) {
            VfxService.spawnAt(this.rescueVfx, hero.node.worldPosition, hero.heroClass);
        }
        (hero.vfx || HeroVfx.of(hero.node))?.playLevelUp();

        if (this.joinParty) {
            const party = HeroPartyManager.instance;
            if (party) {
                if (!party.heroes) party.heroes = [];
                if (party.heroes.indexOf(hero) < 0) party.heroes.push(hero);
            }

            if (!hero.node.getComponent(HeroAutoCombat)) hero.node.addComponent(HeroAutoCombat);

            const squad = hero.node.getComponent(SquadFollow) || hero.node.addComponent(SquadFollow);
            squad.hero = hero;
            squad.slotAngle = this.squadSlotAngle;
            squad.slotDistance = this.squadSlotDistance;
            squad.maxLeash = this.squadMaxLeash;
            hero.autoCombat = true;

            this.beginJoin(hero, squad);
        }

        GameplayLog.log('game', `${this.displayName} được giải cứu, nhập team`);
        EventManager.instance.emit(GameplayEvents.AllyRescued, hero);
        return true;
    }

    private get displayName(): string {
        return this.hero?.heroName || this.heroName || this.node.name;
    }

    private buildHero(): HeroController {
        if (!this.heroTemplate) {
            console.warn('[AllyRescue] chưa gắn hero lẫn heroTemplate:', this.node.name);
            return null;
        }

        const owner = PlayerController.instance;
        const node = instantiate(this.heroTemplate);
        node.name = this.heroName || 'Ally';
        node.setParent(this.heroParent || this.node.parent || this.node);
        node.setWorldPosition(this.node.worldPosition);
        node.setWorldRotation(this.node.worldRotation);
        node.active = true;

        const pc = node.getComponent(PlayerController);
        if (pc) {
            pc.enabled = false;
            pc.destroy();
        }
        const manual = node.getComponent(PlayerCombat);
        if (manual) {
            manual.enabled = false;
            manual.destroy();
        }
        if (owner && owner.isValid) PlayerController.instance = owner;

        const hero = node.getComponent(HeroController);
        if (!hero) {
            console.warn('[AllyRescue] heroTemplate không có HeroController:', this.heroTemplate.name);
            node.destroy();
            return null;
        }
        hero.heroName = this.heroName || hero.heroName;
        hero.autoCombat = false;

        const skin = node.getComponent(HeroSkinSwitcher);
        if (skin) skin.apply(this.heroClass);
        else hero.applyClass(this.heroClass);

        this.hero = hero;
        return hero;
    }

    private spawnTrapFx() {
        this.clearTrapFx();
        if (this.trapVfx === VfxId.None || !this.hero) return;
        this._trapFx = VfxService.attachTo(
            this.trapVfx,
            this.hero.node,
            this.hero.heroClass,
            null,
            this.trapVfxLifetime,
        );
    }

    private clearTrapFx() {
        if (this._trapFx && this._trapFx.isValid) this._trapFx.destroy();
        this._trapFx = null;
    }
}

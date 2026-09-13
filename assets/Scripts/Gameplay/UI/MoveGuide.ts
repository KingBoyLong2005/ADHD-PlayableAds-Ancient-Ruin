import { _decorator, Animation, CCFloat, Component, director, find, input, Input, Node } from 'cc';
import EventManager from '../../Utility/EventManager';
import { GameplayLog } from '../Debug/GameplayLog';
import { GameplayEvents } from '../Events/GameplayEvents';
import { JoystickInput } from '../Input/JoystickInput';
import { GameManager, GameState } from '../Managers/GameManager';
import { PlayerCombat } from '../Player/PlayerCombat';

const { ccclass, property } = _decorator;

@ccclass('MoveGuide')
export class MoveGuide extends Component {
    @property({ type: Node })
    public guideNode: Node = null;

    @property({ type: JoystickInput })
    public joystick: JoystickInput = null;

    @property({ type: PlayerCombat })
    public combat: PlayerCombat = null;

    @property
    public quietWhileFighting: boolean = true;

    @property({ type: CCFloat })
    public idleDelay: number = 5;

    @property({ type: CCFloat })
    public firstShowDelay: number = 0.3;

    @property
    public waitForLevelUp: boolean = true;

    @property({ type: CCFloat })
    public armFallback: number = 3;

    @property
    public touchIsInteract: boolean = true;

    private _picked: boolean = false;

    private _sawLevelUp: boolean = false;

    private _armed: boolean = false;

    private _stopped: boolean = false;

    private _idle: number = 0;
    private _shown: boolean = false;
    private _touching: boolean = false;
    private _touchBound: boolean = false;

    onLoad() {

        EventManager.instance.on(GameplayEvents.HeroSelected, this.onHeroSelected, this);
        EventManager.instance.on(GameplayEvents.LevelUpReady, this.onLevelUpReady, this);
        EventManager.instance.on(GameplayEvents.GamePaused, this.hideGuide, this);
        EventManager.instance.on(GameplayEvents.GameResumed, this.onGameResumed, this);
        EventManager.instance.on(GameplayEvents.GameWin, this.stop, this);
        EventManager.instance.on(GameplayEvents.GameLose, this.stop, this);
        EventManager.instance.on(GameplayEvents.PlayerDied, this.stop, this);
        EventManager.instance.on(GameplayEvents.AllHeroesDied, this.stop, this);

        this.resolveGuide();
        this.hideGuide();
    }

    start() {
        this.resolveJoystick();
        this.bindTouch();
    }

    onDestroy() {
        EventManager.instance.off(GameplayEvents.HeroSelected, this.onHeroSelected, this);
        EventManager.instance.off(GameplayEvents.LevelUpReady, this.onLevelUpReady, this);
        EventManager.instance.off(GameplayEvents.GamePaused, this.hideGuide, this);
        EventManager.instance.off(GameplayEvents.GameResumed, this.onGameResumed, this);
        EventManager.instance.off(GameplayEvents.GameWin, this.stop, this);
        EventManager.instance.off(GameplayEvents.GameLose, this.stop, this);
        EventManager.instance.off(GameplayEvents.PlayerDied, this.stop, this);
        EventManager.instance.off(GameplayEvents.AllHeroesDied, this.stop, this);
        this.unbindTouch();
    }

    update(dt: number) {

        if (this.isGameOver()) {
            this.stop();
            return;
        }
        if (!this._armed || this._stopped) return;

        if (GameManager.instance?.isPaused || GameManager.instance?.inputLocked) {
            this.hideGuide();
            return;
        }

        if (this.isInteracting()) {
            this._idle = 0;
            this.hideGuide();
            return;
        }

        this._idle += dt;
        if (!this._shown && this._idle >= this.idleDelay) this.showGuide();
    }

    public showGuide() {
        if (this._stopped) return;
        const node = this.resolveGuide();
        if (!node) return;

        this._shown = true;
        node.active = true;

        const anim = node.getComponent(Animation);
        if (anim && anim.defaultClip) anim.play();
    }

    public hideGuide() {
        const node = this.guideNode;
        if (!node || !node.isValid) return;
        this._shown = false;
        if (node.active) node.active = false;
    }

    public stop() {
        this._stopped = true;
        this._armed = false;
        this.hideGuide();
    }

    private onHeroSelected() {
        this._picked = true;
        this._sawLevelUp = false;
        this.hideGuide();

        if (!this.waitForLevelUp) {
            this.arm('không chờ level-up');
            return;
        }

        if (this.armFallback > 0) {
            this.scheduleOnce(() => {
                if (this._armed || this._stopped || this._sawLevelUp) return;
                if (GameManager.instance?.isPaused) return;

                if (GameManager.instance?.inputLocked) return;
                this.arm('quá hạn chờ panel skill');
            }, this.armFallback);
        }
    }

    private onLevelUpReady() {
        this._sawLevelUp = true;
        this.hideGuide();
    }

    private onGameResumed() {
        if (this._stopped || !this._picked) return;
        if (this.waitForLevelUp && !this._sawLevelUp) return;
        this.arm('đóng panel skill');
    }

    private arm(reason: string) {
        if (this._stopped) return;

        const first = !this._armed;
        this._armed = true;
        this._idle = first ? Math.max(0, this.idleDelay - Math.max(0, this.firstShowDelay)) : 0;
        if (first) GameplayLog.log('guide', `bật hướng dẫn di chuyển (${reason})`);
    }

    private isGameOver(): boolean {
        const gm = GameManager.instance;
        return !!gm && (gm.state === GameState.Lose || gm.state === GameState.Win);
    }

    private isInteracting(): boolean {
        const joy = this.joystick;
        if (joy && joy.isValid && joy.isActive) return true;
        if (this.touchIsInteract && this._touching) return true;
        return this.isFighting();
    }

    private isFighting(): boolean {
        if (!this.quietWhileFighting) return false;
        const combat = this.resolveCombat();
        return !!combat && combat.inCombat;
    }

    private bindTouch() {
        if (!this.touchIsInteract || this._touchBound) return;
        this._touchBound = true;
        input.on(Input.EventType.TOUCH_START, this.onTouchStart, this);
        input.on(Input.EventType.TOUCH_END, this.onTouchEnd, this);
        input.on(Input.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
    }

    private unbindTouch() {
        if (!this._touchBound) return;
        this._touchBound = false;
        input.off(Input.EventType.TOUCH_START, this.onTouchStart, this);
        input.off(Input.EventType.TOUCH_END, this.onTouchEnd, this);
        input.off(Input.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
    }

    private onTouchStart() {
        this._touching = true;
        this._idle = 0;
        this.hideGuide();
    }

    private onTouchEnd() {
        this._touching = false;

        this._idle = 0;
    }

    private resolveGuide(): Node {
        if (this.guideNode && this.guideNode.isValid) return this.guideNode;

        this.guideNode = find('Canvas/GuideMove') || this.findByName(director.getScene(), 'GuideMove');
        if (!this.guideNode) {
            GameplayLog.log('guide', 'không tìm thấy node "GuideMove" — kéo tay vào ô guideNode');
        }
        return this.guideNode;
    }

    private resolveCombat(): PlayerCombat {
        if (this.combat && this.combat.isValid) return this.combat;

        this.combat = director.getScene()?.getComponentInChildren(PlayerCombat);
        return this.combat;
    }

    private resolveJoystick() {
        if (this.joystick && this.joystick.isValid) return;
        this.joystick = director.getScene()?.getComponentInChildren(JoystickInput);
        if (!this.joystick) {
            GameplayLog.log('guide', 'không tìm thấy JoystickInput — guide chỉ tắt khi có cú chạm');
        }
    }

    private findByName(root: Node, name: string): Node {
        if (!root) return null;
        const children = root.children;
        for (let i = 0; i < children.length; i++) {
            const child = children[i];
            if (child.name === name) return child;
            const found = this.findByName(child, name);
            if (found) return found;
        }
        return null;
    }
}

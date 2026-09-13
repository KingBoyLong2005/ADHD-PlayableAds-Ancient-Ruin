import { _decorator, CCInteger, Component, EventTouch, Node, UIOpacity, UITransform, Vec2, Vec3 } from 'cc';
import EventManager from '../../Utility/EventManager';
import { GameplayEvents } from '../Events/GameplayEvents';

const { ccclass, property } = _decorator;

@ccclass('JoystickInput')
export class JoystickInput extends Component {
    @property(Node)
    public knob: Node = null;

    @property(Node)
    public background: Node = null;

    @property
    public maxRadius: number = 130;

    @property
    public deadZone: number = 0.1;

    @property
    public hideUntilHeroSelected: boolean = true;

    @property({ type: CCInteger, range: [0, 255] })
    public hiddenOpacity: number = 0;

    @property({ type: CCInteger, range: [0, 255] })
    public visibleOpacity: number = 255;

    @property
    public followTouch: boolean = true;

    @property
    public fullScreenTouch: boolean = true;

    private _direction: Vec2 = new Vec2();
    private _touching: boolean = false;

    private _space: UITransform = null;
    private _knobOrigin: Vec3 = new Vec3();

    public get direction(): Readonly<Vec2> {
        return this._direction;
    }

    public get isActive(): boolean {

        return this._touching && this._direction.lengthSqr() > 1e-6;
    }

    onLoad() {

        const space = (this.background || this.knob)?.parent || this.node;
        this._space = space.getComponent(UITransform) || this.node.getComponent(UITransform);
        if (this.knob) {
            this._knobOrigin = this.knob.position.clone();
        }

        EventManager.instance.on(GameplayEvents.HeroSelected, this.show, this);

        EventManager.instance.on(GameplayEvents.GameResumed, this.show, this);

        EventManager.instance.on(GameplayEvents.LevelUpReady, this.hide, this);
        EventManager.instance.on(GameplayEvents.GamePaused, this.hide, this);

        if (this.hideUntilHeroSelected) this.hide();
        else if (this.followTouch) this.applyOpacity(this.hiddenOpacity);
    }

    onDestroy() {
        EventManager.instance.off(GameplayEvents.HeroSelected, this.show, this);
        EventManager.instance.off(GameplayEvents.GameResumed, this.show, this);
        EventManager.instance.off(GameplayEvents.LevelUpReady, this.hide, this);
        EventManager.instance.off(GameplayEvents.GamePaused, this.hide, this);
    }

    public show() {
        this.enabled = true;

        this.applyOpacity(this.followTouch ? this.hiddenOpacity : this.visibleOpacity);
    }

    public hide() {
        this.applyOpacity(this.hiddenOpacity);

        this.enabled = false;
    }

    private fitTouchArea() {
        if (!this.fullScreenTouch) return;
        const area = this.node.getComponent(UITransform);
        const parent = this.node.parent?.getComponent(UITransform);
        if (!area || !parent) return;
        area.setContentSize(parent.contentSize);
    }

    private applyOpacity(value: number) {
        const opacity = this.getComponent(UIOpacity) || this.addComponent(UIOpacity);
        opacity.opacity = value;
    }

    onEnable() {
        this.fitTouchArea();
        this.node.on(Node.EventType.TOUCH_START, this.onTouchStart, this);
        this.node.on(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
        this.node.on(Node.EventType.TOUCH_END, this.onTouchEnd, this);
        this.node.on(Node.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
    }

    onDisable() {
        this.node.off(Node.EventType.TOUCH_START, this.onTouchStart, this);
        this.node.off(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
        this.node.off(Node.EventType.TOUCH_END, this.onTouchEnd, this);
        this.node.off(Node.EventType.TOUCH_CANCEL, this.onTouchEnd, this);

        this._touching = false;
        this.resetKnob();
    }

    private onTouchStart(event: EventTouch) {
        this._touching = true;
        if (this.followTouch) {
            this.moveToTouch(event);
            this.applyOpacity(this.visibleOpacity);
        }
        this.updateFromTouch(event);
    }

    private moveToTouch(event: EventTouch) {
        if (!this._space) return;
        const uiPos = event.getUILocation();
        const center = this._space.convertToNodeSpaceAR(new Vec3(uiPos.x, uiPos.y, 0));
        center.z = 0;

        if (this.background) this.background.setPosition(center);
        this._knobOrigin.set(center);
        if (this.knob) this.knob.setPosition(center);
    }

    private onTouchMove(event: EventTouch) {
        if (!this._touching) return;
        this.updateFromTouch(event);
    }

    private onTouchEnd() {
        this._touching = false;
        this.resetKnob();
        if (this.followTouch) this.applyOpacity(this.hiddenOpacity);
    }

    private updateFromTouch(event: EventTouch) {
        if (!this._space) return;
        const uiPos = event.getUILocation();
        const local = this._space.convertToNodeSpaceAR(new Vec3(uiPos.x, uiPos.y, 0));
        const ox = local.x - this._knobOrigin.x;
        const oy = local.y - this._knobOrigin.y;
        const len = Math.sqrt(ox * ox + oy * oy);
        const clamped = len > this.maxRadius ? this.maxRadius / len : 1;
        const x = ox * clamped;
        const y = oy * clamped;

        if (this.knob) {
            this.knob.setPosition(this._knobOrigin.x + x, this._knobOrigin.y + y, this._knobOrigin.z);
        }

        if (this.maxRadius <= 0) {
            this._direction.set(0, 0);
            return;
        }
        const push = Math.min(1, len / this.maxRadius);
        if (push <= this.deadZone || len < 1e-4) {
            this._direction.set(0, 0);
            return;
        }

        const dead = Math.min(0.95, Math.max(0, this.deadZone));
        const scaled = (push - dead) / (1 - dead);
        this._direction.set((ox / len) * scaled, (oy / len) * scaled);
    }

    private resetKnob() {
        this._direction.set(0, 0);
        if (this.knob) {
            this.knob.setPosition(this._knobOrigin);
        }
    }
}

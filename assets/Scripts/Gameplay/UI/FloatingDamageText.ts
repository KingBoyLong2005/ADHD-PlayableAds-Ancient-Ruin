import { _decorator, CCFloat, Color, Component, Label, Sprite, SpriteFrame, UIOpacity, Vec3 } from 'cc';
import { formatCompact } from '../../Utility/NumberFormat';

const { ccclass, property } = _decorator;

@ccclass('FloatingDamageText')
export class FloatingDamageText extends Component {
    @property(Label)
    public label: Label = null;

    @property(Sprite)
    public icon: Sprite = null;

    @property(CCFloat)
    public lifetime: number = 0.8;

    @property(CCFloat)
    public riseDistance: number = 90;

    @property(CCFloat)
    public fadeStartRatio: number = 0.45;

    @property(CCFloat)
    public popScale: number = 1.35;

    @property(CCFloat)
    public popDuration: number = 0.1;

    private _opacity: UIOpacity = null;
    private _start: Vec3 = new Vec3();
    private _pos: Vec3 = new Vec3();
    private _scale: Vec3 = new Vec3();
    private _drift: number = 0;
    private _sizeScale: number = 1;
    private _time: number = 0;
    private _playing: boolean = false;
    private _onFinished: (self: FloatingDamageText) => void = null;

    onLoad() {
        if (!this.label) this.label = this.getComponentInChildren(Label);
        this._opacity = this.getComponent(UIOpacity) || this.addComponent(UIOpacity);
    }

    public play(
        localPos: Vec3,
        damage: number,
        color: Color,
        drift: number,
        onFinished: (self: FloatingDamageText) => void = null,
    ) {
        this.playText(localPos, formatCompact(damage), color, drift, onFinished);
    }

    public playText(
        localPos: Vec3,
        text: string,
        color: Color,
        drift: number,
        onFinished: (self: FloatingDamageText) => void = null,
        options?: { icon?: SpriteFrame; sizeScale?: number },
    ) {
        if (!this.label) this.label = this.getComponentInChildren(Label);
        if (!this._opacity) this._opacity = this.getComponent(UIOpacity) || this.addComponent(UIOpacity);

        if (this.label) {
            this.label.string = text;
            if (color) this.label.color = color;
        }

        const icon = options?.icon || null;
        if (this.icon) {
            this.icon.spriteFrame = icon;
            this.icon.node.active = !!icon;
        }

        this._sizeScale = Math.max(0.01, options?.sizeScale ?? 1);
        this._start.set(localPos);
        this._drift = drift;
        this._time = 0;
        this._playing = true;
        this._onFinished = onFinished;

        this.node.setPosition(this._start);
        const spawn = 0.6 * this._sizeScale;
        this.node.setScale(spawn, spawn, 1);
        this._opacity.opacity = 255;
    }

    update(dt: number) {
        if (!this._playing) return;

        this._time += dt;
        const life = Math.max(0.01, this.lifetime);
        const t = Math.min(1, this._time / life);

        const inv = 1 - t;
        const eased = 1 - inv * inv * inv;
        this._pos.set(
            this._start.x + this._drift * t,
            this._start.y + this.riseDistance * eased,
            this._start.z,
        );
        this.node.setPosition(this._pos);

        const pop = Math.max(0.001, this.popDuration);
        let scale: number;
        if (this._time < pop) {
            scale = 0.6 + (this.popScale - 0.6) * (this._time / pop);
        } else {
            const k = Math.min(1, (this._time - pop) / pop);
            scale = this.popScale + (1 - this.popScale) * k;
        }

        scale *= this._sizeScale;
        this._scale.set(scale, scale, 1);
        this.node.setScale(this._scale);

        const fadeStart = life * Math.max(0, Math.min(0.99, this.fadeStartRatio));
        if (this._time <= fadeStart) {
            this._opacity.opacity = 255;
        } else {
            const k = (this._time - fadeStart) / (life - fadeStart);
            this._opacity.opacity = Math.max(0, Math.round(255 * (1 - k)));
        }

        if (t >= 1) this.stop();
    }

    public stop() {
        if (!this._playing) return;
        this._playing = false;
        const cb = this._onFinished;
        this._onFinished = null;
        if (cb) cb(this);
        else this.node.active = false;
    }
}

import { _decorator, Button, CCFloat, Component, Node, Vec3 } from 'cc';

const { ccclass, property } = _decorator;

@ccclass('ButtonPulseGuide')
export class ButtonPulseGuide extends Component {
    @property({ type: [Node] })
    public targets: Node[] = [];

    @property({ type: CCFloat })
    public period: number = 0.9;

    @property({ type: CCFloat })
    public minScale: number = 0.94;

    @property({ type: CCFloat })
    public maxScale: number = 1.1;

    @property
    public interleave: boolean = true;

    @property({ type: CCFloat })
    public fadeIn: number = 0.25;

    private _base: Vec3[] = [];

    private _pressed: boolean[] = [];

    private _handlers: Array<{ down: () => void; up: () => void }> = [];
    private _time: number = 0;
    private _bound: boolean = false;

    onLoad() {
        this.resolveTargets();
    }

    onEnable() {
        this._time = 0;
        this.bindPress();
        this.applyAll();
    }

    onDisable() {
        this.unbindPress();
        this.restoreAll();
    }

    update(dt: number) {
        this._time += dt;
        this.applyAll();
    }

    private applyAll() {
        const n = this.targets.length;
        if (n === 0 || this.period <= 0) return;

        const amp = this.fadeIn > 0 ? Math.min(1, this._time / this.fadeIn) : 1;
        const turns = this._time / this.period;

        for (let i = 0; i < n; i++) {
            const node = this.targets[i];
            if (!node || !node.isValid || this._pressed[i]) continue;
            const phase = this.interleave ? i / n : 0;

            const k = 0.5 - 0.5 * Math.cos(2 * Math.PI * (turns + phase));
            const raw = this.minScale + (this.maxScale - this.minScale) * k;
            const s = 1 + (raw - 1) * amp;
            const base = this._base[i];
            node.setScale(base.x * s, base.y * s, base.z);
        }
    }

    private restoreAll() {
        for (let i = 0; i < this.targets.length; i++) {
            const node = this.targets[i];
            if (!node || !node.isValid) continue;
            node.setScale(this._base[i]);
        }
    }

    private bindPress() {
        if (this._bound) return;
        this._bound = true;
        for (let i = 0; i < this.targets.length; i++) {
            const node = this.targets[i];
            if (!node || !node.isValid) continue;

            const h = { down: () => this.setPressed(i, true), up: () => this.setPressed(i, false) };
            this._handlers[i] = h;
            node.on(Node.EventType.TOUCH_START, h.down, this);
            node.on(Node.EventType.TOUCH_END, h.up, this);
            node.on(Node.EventType.TOUCH_CANCEL, h.up, this);
        }
    }

    private unbindPress() {
        if (!this._bound) return;
        this._bound = false;
        for (let i = 0; i < this.targets.length; i++) {
            const node = this.targets[i];
            const h = this._handlers[i];
            this._pressed[i] = false;
            if (!node || !node.isValid || !h) continue;
            node.off(Node.EventType.TOUCH_START, h.down, this);
            node.off(Node.EventType.TOUCH_END, h.up, this);
            node.off(Node.EventType.TOUCH_CANCEL, h.up, this);
        }
        this._handlers = [];
    }

    private setPressed(i: number, pressed: boolean) {
        this._pressed[i] = pressed;

        const node = this.targets[i];
        if (!pressed && node && node.isValid) node.setScale(this._base[i]);
    }

    private resolveTargets() {
        if (this.targets.length === 0) {
            const found = this.node.getComponentsInChildren(Button);
            for (let i = 0; i < found.length; i++) this.targets.push(found[i].node);
        }
        this._base = [];
        this._pressed = [];
        for (let i = 0; i < this.targets.length; i++) {
            const node = this.targets[i];
            this._base.push(node && node.isValid ? node.scale.clone() : new Vec3(1, 1, 1));
            this._pressed.push(false);
        }
    }
}

import { _decorator, CCFloat, CCInteger, Component, Node, Sprite, SpriteFrame, UITransform, Vec3 } from 'cc';

const { ccclass, property } = _decorator;

enum ReelState {
    Idle = 0,
    Spinning = 1,
    Stopping = 2,
}

@ccclass('SkillReelView')
export class SkillReelView extends Component {
    @property({ type: Node })
    public strip: Node = null;

    @property({ type: CCFloat })
    public cellHeight: number = 190;

    @property({ type: CCFloat })
    public iconSize: number = 190;

    @property({ type: CCInteger })
    public cellCount: number = 4;

    @property({ type: CCFloat })
    public spinSpeed: number = 2600;

    @property({ type: CCFloat })
    public minStopCells: number = 3;

    public onStopped: () => void = null;

    private _pool: SpriteFrame[] = [];
    private _cells: Sprite[] = [];
    private _state: ReelState = ReelState.Idle;
    private _pos: number = 0;

    private _target: SpriteFrame = null;
    private _landIndex: number = -1;

    private _stopFrom: number = 0;
    private _stopTo: number = 0;
    private _stopTime: number = 0;
    private _stopDuration: number = 1;

    public get isSpinning(): boolean {
        return this._state !== ReelState.Idle;
    }

    onLoad() {
        if (!this.strip) this.strip = this.node;
        this.buildCells();
    }

    private buildCells() {
        if (this._cells.length > 0) return;
        for (let i = 0; i < Math.max(3, this.cellCount); i++) {
            const node = new Node(`Cell_${i}`);
            node.layer = this.node.layer;
            const ui = node.addComponent(UITransform);
            ui.setContentSize(this.iconSize, this.iconSize);
            const sprite = node.addComponent(Sprite);
            sprite.sizeMode = Sprite.SizeMode.CUSTOM;
            sprite.trim = false;
            node.setParent(this.strip);
            this._cells.push(sprite);
        }
    }

    public setPool(icons: SpriteFrame[]) {
        this._pool = (icons || []).filter((i) => !!i);
        this.layout();
    }

    public startSpin() {
        this.buildCells();
        this._target = null;
        this._landIndex = -1;
        this._state = ReelState.Spinning;
    }

    public stopAt(target: SpriteFrame, duration: number = 0.9) {
        this.buildCells();
        this._target = target;

        const h = this.cellHeight;
        const travel = Math.max(
            (this.spinSpeed * Math.max(0.15, duration)) / SkillReelView.EASE_INITIAL_SLOPE,
            h * this.minStopCells,
        );
        this._landIndex = Math.ceil((this._pos + travel) / h);

        this._stopFrom = this._pos;
        this._stopTo = this._landIndex * h;
        this._stopTime = 0;
        this._stopDuration = Math.max(0.15, duration);
        this._state = ReelState.Stopping;
    }

    public snapTo(target: SpriteFrame) {
        this.buildCells();
        this._target = target;
        this._landIndex = Math.ceil(this._pos / this.cellHeight);
        this._pos = this._landIndex * this.cellHeight;
        this._state = ReelState.Idle;
        this.layout();
    }

    update(dt: number) {
        if (this._state === ReelState.Idle) return;

        if (this._state === ReelState.Spinning) {
            this._pos += this.spinSpeed * dt;
        } else {
            this._stopTime += dt;
            const t = Math.min(1, this._stopTime / this._stopDuration);
            this._pos = this._stopFrom + (this._stopTo - this._stopFrom) * SkillReelView.easeOutBack(t);
            if (t >= 1) {
                this._pos = this._stopTo;
                this._state = ReelState.Idle;
                this.layout();
                const cb = this.onStopped;
                if (cb) cb();
                return;
            }
        }

        this.layout();
    }

    private layout() {
        if (this._cells.length === 0) return;
        const h = this.cellHeight;
        const base = Math.floor(this._pos / h);
        const pos = new Vec3();
        for (let j = 0; j < this._cells.length; j++) {
            const idx = base - 1 + j;
            const sprite = this._cells[j];
            pos.set(0, idx * h - this._pos, 0);
            sprite.node.setPosition(pos);
            const frame = this.iconAt(idx);
            if (sprite.spriteFrame !== frame) sprite.spriteFrame = frame;
            sprite.node.active = !!frame;
        }
    }

    private iconAt(idx: number): SpriteFrame {
        if (this._target && idx === this._landIndex) return this._target;
        if (this._pool.length === 0) return this._target;
        return this._pool[SkillReelView.hash(idx) % this._pool.length];
    }

    private static hash(idx: number): number {
        let x = idx | 0;
        x = Math.imul(x ^ 0x9e3779b9, 0x85ebca6b);
        x ^= x >>> 13;
        x = Math.imul(x, 0xc2b2ae35);
        return (x ^ (x >>> 16)) >>> 0;
    }

    private static readonly EASE_C1 = 1.70158 * 0.4;

    private static readonly EASE_INITIAL_SLOPE = 3 * (SkillReelView.EASE_C1 + 1) - 2 * SkillReelView.EASE_C1;

    private static easeOutBack(t: number): number {
        const c1 = SkillReelView.EASE_C1;
        const c3 = c1 + 1;
        const p = t - 1;
        return 1 + c3 * p * p * p + c1 * p * p;
    }
}

import { _decorator, CCFloat, Component, Node, Vec3 } from 'cc';
import { CameraFollow } from './CameraFollow';

const { ccclass, property } = _decorator;

const _from = new Vec3();
const _to = new Vec3();
const _cur = new Vec3();

@ccclass('CameraIntro')
export class CameraIntro extends Component {
    @property({ type: CameraFollow })
    public follow: CameraFollow = null;

    @property({ type: CCFloat })
    public travelTime: number = 1.3;

    @property({ type: CCFloat })
    public holdTime: number = 0.8;

    @property({ type: CCFloat })
    public returnTime: number = 1.8;

    @property({ type: CCFloat, range: [0.35, 1], slide: true })
    public focusZoom: number = 0.65;

    @property({ type: CCFloat, range: [0, 0.3], slide: true })
    public focusPush: number = 0.1;

    @property
    public cutToFirst: boolean = false;

    @property
    public enabledIntro: boolean = true;

    private _offset: Vec3 = new Vec3();
    private _legs: { target: Node; travel: number; hold: number; zoom: number; zoomEnd: number }[] = [];
    private _leg: number = -1;
    private _t: number = 0;
    private _holding: number = 0;
    private _start: Vec3 = new Vec3();
    private _done: (() => void) | null = null;

    public get playing(): boolean {
        return this._leg >= 0;
    }

    onLoad() {
        if (!this.follow) this.follow = this.getComponent(CameraFollow);
    }

    public play(stops: Node[], home: Node, done: () => void) {
        const targets = (stops || []).filter((n) => n && n.isValid);
        if (!this.enabledIntro || !home || targets.length === 0) {
            done();
            return;
        }

        Vec3.subtract(this._offset, this.node.worldPosition, home.worldPosition);

        const near = Math.max(0.35, Math.min(1, this.focusZoom));
        this._legs = targets.map((target) => ({
            target,
            travel: this.travelTime,
            hold: this.holdTime,
            zoom: near,
            zoomEnd: Math.max(0.3, near - this.focusPush),
        }));

        this._legs.push({ target: home, travel: this.returnTime, hold: 0, zoom: 1, zoomEnd: 1 });

        if (this.follow) this.follow.enabled = false;
        this._done = done;
        this._leg = 0;
        this._t = 0;
        this._holding = 0;

        if (this.cutToFirst) {

            this.aim(_to, this._legs[0].target, this._legs[0].zoom);
            this.node.setWorldPosition(_to);
            this._legs[0].travel = 0;
        }
        Vec3.copy(this._start, this.node.worldPosition);
    }

    public stop() {
        if (this._leg < 0) return;
        this._leg = -1;
        this._legs.length = 0;
        if (this.follow) this.follow.enabled = true;
        const cb = this._done;
        this._done = null;
        if (cb) cb();
    }

    lateUpdate(dt: number) {
        if (this._leg < 0) return;
        const leg = this._legs[this._leg];
        if (!leg || !leg.target || !leg.target.isValid) {
            this.finish();
            return;
        }

        if (this._holding > 0) {
            this._holding -= dt;

            const k = leg.hold > 0 ? 1 - Math.max(0, this._holding) / leg.hold : 1;
            this.aim(_to, leg.target, leg.zoom + (leg.zoomEnd - leg.zoom) * k);
            this.node.setWorldPosition(_to);
            if (this._holding <= 0) this.nextLeg();
            return;
        }

        this.aim(_to, leg.target, leg.zoom);

        this._t += dt;
        const k = leg.travel > 0 ? Math.min(1, this._t / leg.travel) : 1;

        const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        Vec3.copy(_from, this._start);
        Vec3.lerp(_cur, _from, _to, e);
        this.node.setWorldPosition(_cur);

        if (k < 1) return;
        if (leg.hold > 0) {
            this._holding = leg.hold;
            return;
        }
        this.nextLeg();
    }

    private aim(out: Vec3, target: Node, zoom: number) {
        Vec3.multiplyScalar(out, this._offset, zoom);
        Vec3.add(out, target.worldPosition, out);
    }

    private nextLeg() {
        Vec3.copy(this._start, this.node.worldPosition);
        this._t = 0;
        this._holding = 0;
        this._leg += 1;
        if (this._leg >= this._legs.length) this.finish();
    }

    private finish() {
        this._leg = -1;
        this._legs.length = 0;

        if (this.follow) this.follow.enabled = true;
        const cb = this._done;
        this._done = null;
        if (cb) cb();
    }
}

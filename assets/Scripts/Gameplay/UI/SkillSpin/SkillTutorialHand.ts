import { _decorator, CCFloat, CCInteger, Component, Node, Tween, tween, UIOpacity, UITransform, Vec3 } from 'cc';

const { ccclass, property } = _decorator;

@ccclass('SkillTutorialHand')
export class SkillTutorialHand extends Component {
    @property({ type: Node })
    public hand: Node = null;

    @property({ type: [Node] })
    public targets: Node[] = [];

    @property
    public handOffset: Vec3 = new Vec3(0, 0, 0);

    @property({ type: CCFloat })
    public handScale: number = 1;

    @property({ type: CCFloat })
    public moveTime: number = 0.45;

    @property({ type: CCFloat })
    public pressTime: number = 0.12;

    @property({ type: CCFloat })
    public releaseTime: number = 0.18;

    @property({ type: CCFloat })
    public holdTime: number = 0.25;

    @property({ type: CCFloat })
    public startDelay: number = 0.25;

    @property({ type: CCFloat })
    public fadeTime: number = 0.2;

    @property({ type: CCFloat })
    public handPressScale: number = 0.82;

    @property({ type: CCFloat })
    public cardPressScale: number = 0.93;

    @property({ type: CCFloat })
    public speedScale: number = 2;

    @property({ type: CCInteger })
    public maxLoops: number = 0;

    @property
    public bringToFront: boolean = true;

    private _order: Node[] = [];
    private _baseScales: Vec3[] = [];
    private _handBaseScale: Vec3 = new Vec3(1, 1, 1);

    private _authored: Vec3 = null;
    private _index: number = 0;
    private _loops: number = 0;
    private _playing: boolean = false;

    private _needMove: boolean = false;

    public get isPlaying(): boolean {
        return this._playing;
    }

    private t(seconds: number): number {
        return Math.max(0, seconds) / Math.max(0.01, this.speedScale);
    }

    onLoad() {
        this.resolveHand();

        if (this.hand !== this.node) this.hand.active = false;
    }

    private resolveHand() {
        if (!this.hand) this.hand = this.node;

        if (!this._authored && this.hand && this.hand.isValid) {
            this._authored = this.hand.scale.clone();
        }
    }

    onDisable() {

        this.stop(false);
    }

    onDestroy() {
        this.stop(false);
    }

    public play(targets: Node[] = null) {

        this.resolveHand();
        if (!this.hand.isValid) return;
        this.stop(false);

        const source = targets && targets.length > 0 ? targets : this.targets;
        this._order = [];
        this._baseScales = [];
        for (const n of source) {
            if (!n || !n.isValid) continue;
            this._order.push(n);

            this._baseScales.push(n.scale.clone());
        }
        if (this._order.length === 0) return;

        const k = Math.max(0.01, this.handScale);
        const a = this._authored || this.hand.scale;
        this._handBaseScale = new Vec3(a.x * k, a.y * k, a.z * k);
        this.hand.setScale(this._handBaseScale);
        this._index = 0;
        this._loops = 0;
        this._needMove = false;
        this._playing = true;

        this.hand.active = true;
        if (this.bringToFront && this.hand.parent) {
            this.hand.setSiblingIndex(this.hand.parent.children.length - 1);
        }
        this.hand.setPosition(this.localPosFor(this._order[0]));

        this.fadeHand(255);
        this.scheduleOnce(() => this.step(), this.t(this.startDelay));
    }

    public stop(fade: boolean = true) {
        this._playing = false;
        this.unscheduleAllCallbacks();

        for (let i = 0; i < this._order.length; i++) {
            const node = this._order[i];
            if (!node || !node.isValid) continue;
            Tween.stopAllByTarget(node);

            node.setScale(this._baseScales[i] || Vec3.ONE);
        }
        this._order = [];
        this._baseScales = [];

        if (this.hand && this.hand.isValid) {
            Tween.stopAllByTarget(this.hand);

            this.hand.setScale(this._authored || this._handBaseScale);
            if (fade && this.fadeTime > 0 && this.hand.activeInHierarchy) {
                this.fadeHand(0, () => {
                    if (this.hand && this.hand.isValid) this.hand.active = false;
                });
            } else {
                const op = this.getHandOpacity();
                if (op) {
                    Tween.stopAllByTarget(op);
                    op.opacity = 255;
                }

                this.hand.active = false;
            }
        }
    }

    private step(skipped: number = 0) {
        if (!this._playing) return;
        if (skipped >= this._order.length) {
            this.stop();
            return;
        }

        const target = this._order[this._index];
        if (!target || !target.isValid || !target.activeInHierarchy) {
            this._index = (this._index + 1) % this._order.length;
            this.step(skipped + 1);
            return;
        }

        const dest = this.localPosFor(target);
        const move = this._needMove ? this.t(this.moveTime) : 0;
        this._needMove = true;
        Tween.stopAllByTarget(this.hand);
        tween(this.hand)
            .to(move, { position: dest }, { easing: 'quadInOut' })
            .call(() => this.press(target))
            .start();
    }

    private press(target: Node) {
        if (!this._playing) return;

        this.pressCard(target);

        const hb = this._handBaseScale;
        const handDown = new Vec3(hb.x * this.handPressScale, hb.y * this.handPressScale, hb.z);

        tween(this.hand)
            .to(this.t(this.pressTime), { scale: handDown }, { easing: 'sineOut' })
            .to(this.t(this.releaseTime), { scale: hb.clone() }, { easing: 'backOut' })
            .delay(this.t(this.holdTime))
            .call(() => this.advance())
            .start();
    }

    private pressCard(target: Node) {
        const base = this._baseScales[this._index] || Vec3.ONE;
        const cardDown = new Vec3(base.x * this.cardPressScale, base.y * this.cardPressScale, base.z);
        Tween.stopAllByTarget(target);
        tween(target)
            .to(this.t(this.pressTime), { scale: cardDown }, { easing: 'sineOut' })
            .to(this.t(this.releaseTime), { scale: base.clone() }, { easing: 'backOut' })
            .start();
    }

    private advance() {
        if (!this._playing) return;
        this._index++;
        if (this._index >= this._order.length) {
            this._index = 0;
            this._loops++;
            if (this.maxLoops > 0 && this._loops >= this.maxLoops) {
                this.stop();
                return;
            }
        }
        this.step();
    }

    private localPosFor(target: Node): Vec3 {
        const world = target.getWorldPosition();
        const parent = this.hand.parent;
        const ui = parent ? parent.getComponent(UITransform) : null;
        const local = ui ? ui.convertToNodeSpaceAR(world) : world;
        return local.add(this.handOffset);
    }

    private getHandOpacity(): UIOpacity {
        if (!this.hand || !this.hand.isValid) return null;
        return this.hand.getComponent(UIOpacity) || this.hand.addComponent(UIOpacity);
    }

    private fadeHand(to: number, done: () => void = null) {
        const op = this.getHandOpacity();
        if (!op) {
            if (done) done();
            return;
        }
        Tween.stopAllByTarget(op);
        const time = this.t(this.fadeTime);
        if (time <= 0) {
            op.opacity = to;
            if (done) done();
            return;
        }
        if (to > 0) op.opacity = 0;
        const t = tween(op).to(time, { opacity: to });
        if (done) t.call(done);
        t.start();
    }
}

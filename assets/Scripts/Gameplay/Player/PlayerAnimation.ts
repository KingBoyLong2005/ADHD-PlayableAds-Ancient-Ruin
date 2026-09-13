import { _decorator, Animation, AnimationClip, Component, SkeletalAnimation } from 'cc';
import EventManager from '../../Utility/EventManager';
import { GameplayEvents } from '../Events/GameplayEvents';

const { ccclass, property } = _decorator;

export enum AnimState {
    Idle = 'idle',
    Walk = 'walk',
    Attack = 'attack',
    Die = 'die',
    Win = 'win',
}

@ccclass('PlayerAnimation')
export class PlayerAnimation extends Component {
    @property(SkeletalAnimation)
    public skeletal: SkeletalAnimation = null;

    @property(Animation)
    public animation: Animation = null;

    @property
    public attackLockTime: number = 0.35;

    @property
    public lockForFullAttackClip: boolean = true;

    @property
    public walkSpeedRef: number = 6;

    @property
    public idleClip: string = 'idle';

    @property
    public walkClip: string = 'run';

    @property
    public attackClip: string = 'attack';

    @property
    public dieClip: string = 'die';

    @property
    public winClip: string = '';

    private _current: string = '';
    private _lockTimer: number = 0;
    private _locked: boolean = false;

    private _lockedBy: string = '';

    private _moveSpeed: number = 0;

    private _frozen: boolean = false;

    private _checked: string[] = [];

    onEnable() {
        EventManager.instance.on(GameplayEvents.GamePaused, this.freeze, this);
        EventManager.instance.on(GameplayEvents.GameResumed, this.unfreeze, this);
    }

    onDisable() {
        EventManager.instance.off(GameplayEvents.GamePaused, this.freeze, this);
        EventManager.instance.off(GameplayEvents.GameResumed, this.unfreeze, this);
    }

    update(dt: number) {

        if (this._frozen) return;
        if (this._lockTimer > 0) {
            this._lockTimer -= dt;
            if (this._lockTimer <= 0) {
                this._locked = false;
                this._lockedBy = '';
            }
        }
    }

    public setSource(skeletal: SkeletalAnimation, animation: Animation = null) {
        this.skeletal = skeletal;
        this.animation = animation;
        this._current = '';
        this._locked = false;
        this._lockTimer = 0;
        this._lockedBy = '';

        this._checked.length = 0;

        if (this._frozen) this.freeze();
    }

    private freeze() {
        this._frozen = true;
        this.skeletal?.pause();
        this.animation?.pause();
    }

    private unfreeze() {
        this._frozen = false;
        this.skeletal?.resume();
        this.animation?.resume();
    }

    public play(state: AnimState | string, force: boolean = false) {
        const requested = state as string;
        if (!force && this._locked && requested !== AnimState.Die && requested !== AnimState.Win) {
            return;
        }

        const name = this.clipFor(requested);

        if (!name) return;
        const sameClip = this._current === name;
        if (sameClip && !force) return;
        this._current = name;

        if (requested === AnimState.Attack) {
            this._locked = true;
            this._lockedBy = AnimState.Attack;
            this._lockTimer = this.attackLockDuration(name);
        }
        if (requested === AnimState.Die || requested === AnimState.Win) {
            this._locked = true;
            this._lockedBy = requested;
            this._lockTimer = 999;
        }

        const source = this.skeletal || this.animation;
        if (!source) return;
        this.warnIfMissing(name);

        if (sameClip) {

            source.play(name);
            if (requested === AnimState.Die || requested === AnimState.Win) this.playOnce(name);
            if (this._frozen) this.freeze();
            return;
        }
        source.crossFade(name, 0.1);

        if (requested === AnimState.Walk) this.applyWalkSpeed();
        if (requested === AnimState.Die || requested === AnimState.Win) this.playOnce(name);

        if (this._frozen) this.freeze();
    }

    public cancelAttackLock() {
        if (this._lockedBy !== AnimState.Attack) return;
        this._locked = false;
        this._lockTimer = 0;
        this._lockedBy = '';
    }

    public setMoveSpeed(unitsPerSecond: number) {
        this._moveSpeed = unitsPerSecond;
        if (this._current === this.walkClip) this.applyWalkSpeed();
    }

    private applyWalkSpeed() {
        if (this.walkSpeedRef <= 0 || !this.walkClip) return;
        const state = (this.skeletal || this.animation)?.getState(this.walkClip);
        if (!state) return;
        const ratio = this._moveSpeed / this.walkSpeedRef;
        state.speed = Math.min(2.5, Math.max(0.35, ratio));
    }

    private attackLockDuration(clip: string): number {
        if (!this.lockForFullAttackClip) return this.attackLockTime;
        const state = (this.skeletal || this.animation)?.getState(clip);
        if (!state || !(state.duration > 0)) return this.attackLockTime;
        const speed = state.speed || 1;
        return state.duration / Math.abs(speed);
    }

    private warnIfMissing(name: string) {
        if (this._checked.indexOf(name) >= 0) return;
        this._checked.push(name);
        const src = this.skeletal || this.animation;
        if (src && !src.getState(name)) {
            const have = src.clips.map((c) => (c ? c.name : '?')).join(', ');
            console.warn(
                `[PlayerAnimation] "${this.node.name}" không có clip "${name}". Clip đang có: [${have}]. `
                    + 'Sửa lại idleClip/walkClip/attackClip/dieClip cho khớp.',
            );
        }
    }

    private playOnce(name: string) {
        const source = this.skeletal || this.animation;
        const state = source?.getState(name);
        if (!state) return;
        state.wrapMode = AnimationClip.WrapMode.Normal;
        state.repeatCount = 1;
    }

    private clipFor(state: string): string {
        switch (state) {
            case AnimState.Idle:
                return this.idleClip;
            case AnimState.Walk:
                return this.walkClip;
            case AnimState.Attack:
                return this.attackClip;
            case AnimState.Die:
                return this.dieClip;
            case AnimState.Win:
                return this.winClip;
            default:
                return state;
        }
    }
}

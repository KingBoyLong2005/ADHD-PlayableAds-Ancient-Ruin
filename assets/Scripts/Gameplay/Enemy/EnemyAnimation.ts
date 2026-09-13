import { _decorator, Animation, Component, SkeletalAnimation } from 'cc';
import EventManager from '../../Utility/EventManager';
import { GameplayEvents } from '../Events/GameplayEvents';
import { AnimState } from '../Player/PlayerAnimation';

const { ccclass, property } = _decorator;

@ccclass('EnemyAnimation')
export class EnemyAnimation extends Component {
    @property(SkeletalAnimation)
    public skeletal: SkeletalAnimation = null;

    @property(Animation)
    public animation: Animation = null;

    @property
    public attackLockTime: number = 0.35;

    @property
    public idleClip: string = 'idle';

    @property
    public walkClip: string = 'walk';

    @property
    public attackClip: string = 'attack';

    @property
    public dieClip: string = 'die';

    private _current: string = '';
    private _lockTimer: number = 0;
    private _locked: boolean = false;

    private _frozen: boolean = false;

    onEnable() {

        this._frozen = false;
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
            }
        }
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
        if (this._current === name && !force) return;
        this._current = name;

        if (requested === AnimState.Attack) {
            this._locked = true;
            this._lockTimer = this.attackLockTime;
        }
        if (requested === AnimState.Die || requested === AnimState.Win) {
            this._locked = true;
            this._lockTimer = 999;
        }

        if (this.skeletal) {
            this.skeletal.crossFade(name, 0.1);
            return;
        }
        if (this.animation) {
            this.animation.play(name);
        }
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
            default:
                return state;
        }
    }
}

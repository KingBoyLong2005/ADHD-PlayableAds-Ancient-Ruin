import { _decorator, CCInteger, CharacterController, Component, director, Node, Vec3 } from 'cc';
import { CharacterFacing } from '../Combat/CharacterFacing';
import { CharacterStats } from '../Combat/CharacterStats';
import { EntitySeparation } from '../Combat/EntitySeparation';
import { GameplayLog } from '../Debug/GameplayLog';
import { HeroController } from '../Hero/HeroController';
import { JoystickInput } from '../Input/JoystickInput';
import { GameManager } from '../Managers/GameManager';
import { CharacterCollision } from '../Movement/CharacterCollision';
import { CharacterMover } from '../Movement/CharacterMover';
import { AnimState, PlayerAnimation } from './PlayerAnimation';

const { ccclass, property } = _decorator;

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;

const _camRight = new Vec3();

function wrapPi(a: number): number {
    a = (a + Math.PI) % TAU;
    if (a < 0) a += TAU;
    return a - Math.PI;
}

@ccclass('PlayerController')
export class PlayerController extends Component {
    public static instance: PlayerController;

    @property(JoystickInput)
    public joystick: JoystickInput = null;

    @property(CharacterController)
    public characterController: CharacterController = null;

    @property(CharacterStats)
    public stats: CharacterStats = null;

    @property(PlayerAnimation)
    public anim: PlayerAnimation = null;

    @property(EntitySeparation)
    public separation: EntitySeparation = null;

    @property({ type: CharacterFacing })
    public facing: CharacterFacing = null;

    @property({ type: Node })
    public cameraNode: Node = null;

    @property
    public cameraRelative: boolean = true;

    @property
    public rotateSpeed: number = 12;

    @property
    public analogSpeed: boolean = true;

    @property
    public fullSpeedAt: number = 0.85;

    @property
    public inputSmoothTime: number = 0.09;

    @property
    public releaseSmoothTime: number = 0.05;

    @property
    public turnSmoothTime: number = 0.06;

    @property
    public maxTurnDegPerSec: number = 540;

    @property
    public turnDeadzoneDeg: number = 4;

    @property
    public snapTurnDeg: number = 135;

    @property
    public axisAssistDeg: number = 12;

    @property({ type: CCInteger })
    public axisAssistWays: number = 4;

    @property
    public cornerAssist: boolean = true;

    private _moveDir: Vec3 = new Vec3();
    private _velocity: Vec3 = new Vec3();

    private _heading: number = 0;

    private _hasHeading: boolean = false;

    private _throttle: number = 0;

    private _camRx: number = 1;
    private _camRz: number = 0;
    private _warnedNoCamera: boolean = false;
    private _isMoving: boolean = false;
    private _warnedFall: boolean = false;

    private _prevPos: Vec3 = new Vec3();
    private _mover: CharacterMover = new CharacterMover();
    private _hero: HeroController = null;

    private get hero(): HeroController {
        if (!this._hero || !this._hero.isValid) this._hero = this.getComponent(HeroController);
        return this._hero;
    }

    public get isMoving(): boolean {
        return this._isMoving;
    }

    public get isIdle(): boolean {
        return !this._isMoving;
    }

    public get facingNode(): Node {
        return this.facing ? this.facing.target : this.node;
    }

    onLoad() {
        PlayerController.instance = this;
        if (!this.stats) this.stats = this.getComponent(CharacterStats);
        if (!this.characterController) this.characterController = this.getComponent(CharacterController);
        if (!this.anim) this.anim = this.getComponent(PlayerAnimation);
        if (!this.separation) this.separation = this.getComponent(EntitySeparation);
        if (!this.facing) this.facing = this.getComponent(CharacterFacing);
        if (this.stats) this.stats.isPlayer = true;

        CharacterCollision.applyHero(this.characterController);
        if (!this.cameraNode) this.cameraNode = this.findGameplayCamera();
        Vec3.copy(this._prevPos, this.node.worldPosition);
    }

    private findGameplayCamera(): Node {
        const scene = director.getScene();
        const follow = scene?.getComponentInChildren('CameraFollow') as Component;
        return follow?.node || null;
    }

    update(dt: number) {

        if (this.hero?.autoDrive) return;

        const gm = GameManager.instance;
        if (gm && !gm.canControl) {
            this._isMoving = false;
            this._throttle = 0;
            this._hasHeading = false;
            this.separation?.setIdle(true);
            Vec3.copy(this._prevPos, this.node.worldPosition);

            this.updateAnim(dt);
            return;
        }
        if (this.stats?.isDead) return;

        this.readInput(dt);
        this.applyMove(dt);
        this.updateAnim(dt);
        this.separation?.setIdle(!this._isMoving);
    }

    private readInput(dt: number) {
        let push = 0;
        let rawHeading = 0;
        let hasInput = false;

        const joy = this.joystick;
        if (joy && joy.isActive) {
            this.updateCameraBasis();
            const dir = joy.direction;

            const ix = dir.x * this._camRx + dir.y * this._camRz;
            const iz = dir.x * this._camRz - dir.y * this._camRx;
            const len = Math.sqrt(ix * ix + iz * iz);
            if (len > 0.0001) {
                hasInput = true;

                push = this.analogSpeed ? Math.min(1, len / Math.max(0.05, this.fullSpeedAt)) : 1;
                rawHeading = this.applyAxisAssist(Math.atan2(iz, ix));
            }
        }

        const tau = Math.max(0, hasInput ? this.inputSmoothTime : this.releaseSmoothTime);
        const k = tau > 0.0001 ? 1 - Math.exp(-dt / tau) : 1;
        this._throttle += (push - this._throttle) * k;

        if (hasInput) {
            if (!this._hasHeading) {

                this._heading = rawHeading;
                this._hasHeading = true;
            } else {
                this._heading = this.turnToward(this._heading, rawHeading, dt);
            }
        }

        if (this._throttle < 0.02) {
            this._throttle = 0;
            this._moveDir.set(0, 0, 0);
            this._isMoving = false;
            this._hasHeading = false;
            return;
        }

        this._throttle = Math.min(1, this._throttle);
        this._moveDir.set(Math.cos(this._heading), 0, Math.sin(this._heading));
        this._isMoving = true;
    }

    private updateCameraBasis() {

        if (this.cameraRelative && (!this.cameraNode || !this.cameraNode.isValid)) {
            this.cameraNode = this.findGameplayCamera();
        }
        const cam = this.cameraRelative ? this.cameraNode : null;
        if (!cam || !cam.isValid) {
            if (this.cameraRelative && !this._warnedNoCamera) {
                this._warnedNoCamera = true;
                GameplayLog.log('combat', 'PlayerController: chưa gán cameraNode — joystick đang đi theo trục thế giới');
            }
            this._camRx = 1;
            this._camRz = 0;
            return;
        }
        Vec3.transformQuat(_camRight, Vec3.RIGHT, cam.worldRotation);
        const l = Math.sqrt(_camRight.x * _camRight.x + _camRight.z * _camRight.z);

        if (l < 1e-6) return;
        this._camRx = _camRight.x / l;
        this._camRz = _camRight.z / l;
    }

    private turnToward(from: number, to: number, dt: number): number {
        const diff = wrapPi(to - from);
        const abs = Math.abs(diff);

        const snap = Math.max(0, this.snapTurnDeg) * DEG;
        if (snap > 0 && abs >= snap) return to;

        const dead = Math.max(0, this.turnDeadzoneDeg) * DEG;
        if (abs <= dead) return from;

        const eff = diff - Math.sign(diff) * dead;
        const tau = Math.max(0, this.turnSmoothTime);
        const k = tau > 0.0001 ? 1 - Math.exp(-dt / tau) : 1;
        let step = eff * k;

        const cap = Math.max(0, this.maxTurnDegPerSec) * DEG * dt;
        if (cap > 0 && Math.abs(step) > cap) step = Math.sign(step) * cap;

        return wrapPi(from + step);
    }

    private applyAxisAssist(a: number): number {
        const ways = this.axisAssistWays >= 8 ? 8 : 4;
        const stepA = TAU / ways;

        const win = Math.min(Math.max(0, this.axisAssistDeg) * DEG, stepA * 0.45);
        if (win <= 0) return a;

        const nearest = Math.round(a / stepA) * stepA;
        const d = wrapPi(a - nearest);
        if (Math.abs(d) >= win) return a;
        const u = Math.abs(d) / win;
        return wrapPi(nearest + d * u * u);
    }

    private applyMove(dt: number) {
        const speed = (this.stats ? this.stats.moveSpeed : 5) * this._throttle;
        if (this._isMoving) {
            this._velocity.set(this._moveDir.x * speed, 0, this._moveDir.z * speed);
            CharacterFacing.rotateToward(this.facingNode, this._moveDir, dt, this.rotateSpeed);
        } else {
            this._velocity.set(0, 0, 0);
        }

        this._mover.cornerAssist = this.cornerAssist;
        this._mover.move(this.characterController, this.node, this._velocity.x * dt, this._velocity.z * dt);

        if (this.characterController && !this._warnedFall && this.node.worldPosition.y < -2) {
            this._warnedFall = true;
            GameplayLog.log(
                'combat',
                `HERO ĐANG RƠI: y=${this.node.worldPosition.y.toFixed(1)} — thiếu collider sàn dưới chân`,
            );
        }
    }

    private updateAnim(dt: number) {
        if (!this.anim || this.stats?.isDead) return;
        this.anim.setMoveSpeed(this.measureSpeed(dt));

        if (this._isMoving) this.anim.cancelAttackLock();
        this.anim.play(this._isMoving ? AnimState.Walk : AnimState.Idle);
    }

    private measureSpeed(dt: number): number {
        const p = this.node.worldPosition;
        const dx = p.x - this._prevPos.x;
        const dz = p.z - this._prevPos.z;
        Vec3.copy(this._prevPos, p);
        if (dt <= 0) return 0;
        return Math.sqrt(dx * dx + dz * dz) / dt;
    }

    public playWin() {
        this.anim?.play(AnimState.Win);
    }

    public playDie() {
        this.anim?.play(AnimState.Die);
    }
}

import { _decorator, CharacterController, Component, Enum, Node, Vec3 } from 'cc';
import EventManager from '../../Utility/EventManager';
import { CharacterFacing } from '../Combat/CharacterFacing';
import { CharacterStats } from '../Combat/CharacterStats';
import { EntitySeparation } from '../Combat/EntitySeparation';
import { GameplayEvents } from '../Events/GameplayEvents';
import { GameManager } from '../Managers/GameManager';
import { GameMode } from '../Managers/GameMode';
import { NavGrid } from '../Map/NavGrid';
import { NavPathFollower } from '../Map/NavPathFollower';
import { CharacterCollision } from '../Movement/CharacterCollision';
import { CharacterMover } from '../Movement/CharacterMover';
import { AnimState, PlayerAnimation } from '../Player/PlayerAnimation';
import { SkillApplier } from '../Skills/SkillApplier';
import { HeroVfx } from '../Vfx/HeroVfx';
import { HeroClass } from './HeroClass';
import { HeroProgress } from './HeroProgress';

const { ccclass, property } = _decorator;

const _prevPos = new Vec3();
const _moved = new Vec3();

@ccclass('HeroController')
export class HeroController extends Component {
    @property
    public heroName: string = 'Hero';

    @property({ type: Enum(HeroClass) })
    public heroClass: HeroClass = HeroClass.None;

    @property(CharacterStats)
    public stats: CharacterStats = null;

    @property(CharacterController)
    public characterController: CharacterController = null;

    @property(PlayerAnimation)
    public anim: PlayerAnimation = null;

    @property(EntitySeparation)
    public separation: EntitySeparation = null;

    @property(SkillApplier)
    public skillApplier: SkillApplier = null;

    @property(HeroProgress)
    public progress: HeroProgress = null;

    @property({ type: HeroVfx })
    public vfx: HeroVfx = null;

    @property({ type: CharacterFacing })
    public facing: CharacterFacing = null;

    @property
    public autoCombat: boolean = false;

    @property
    public usePathfinding: boolean = true;

    @property
    public rotateSpeed: number = 12;

    public autoDrive: boolean = false;

    private _nav: NavPathFollower = null;
    private _isMoving: boolean = false;
    private _alive: boolean = true;
    private _mover: CharacterMover = new CharacterMover();

    public get isMoving(): boolean {
        return this._isMoving;
    }

    public get isAlive(): boolean {
        return this._alive && !!this.stats && !this.stats.isDead;
    }

    public get facingNode(): Node {
        return this.facing ? this.facing.target : this.node;
    }

    private get nav(): NavPathFollower {
        if (!this.usePathfinding) return null;
        if (this._nav) return this._nav;
        if (!NavGrid.instance) return null;
        this._nav = this.getComponent(NavPathFollower) || this.addComponent(NavPathFollower);
        return this._nav;
    }

    onLoad() {
        if (!this.stats) this.stats = this.getComponent(CharacterStats);
        if (!this.characterController) this.characterController = this.getComponent(CharacterController);
        if (!this.anim) this.anim = this.getComponent(PlayerAnimation);
        if (!this.separation) this.separation = this.getComponent(EntitySeparation);
        if (!this.skillApplier) this.skillApplier = this.getComponent(SkillApplier);
        if (!this.progress) this.progress = this.getComponent(HeroProgress);
        if (!this.facing) this.facing = this.getComponent(CharacterFacing);
        if (this.progress) this.progress.hero = this;

        this.applyClass(this.heroClass);

        if (this.stats) this.stats.isPlayer = true;

        CharacterCollision.applyHero(this.characterController);

        const gm = GameManager.instance;
        if (gm && gm.gameMode === GameMode.MultiHero) {
            this.autoCombat = true;
        }
    }

    public applyClass(heroClass: HeroClass) {
        this.heroClass = heroClass;
        if (!this.vfx) this.vfx = HeroVfx.of(this.node);
        if (this.vfx) this.vfx.heroClass = heroClass;
    }

    onEnable() {
        this._alive = true;
        EventManager.instance.on(GameplayEvents.HpChanged, this.onHpChanged, this);
    }

    onDisable() {
        EventManager.instance.off(GameplayEvents.HpChanged, this.onHpChanged, this);
    }

    private onHpChanged(stats: CharacterStats) {
        if (stats !== this.stats) return;
        if (stats.isDead && this._alive) {
            this.handleDeath();
        }
    }

    public moveToward(targetPos: Vec3, dt: number) {
        if (!this.stats || !this.isAlive) return;
        const pos = this.node.worldPosition;
        const dir = new Vec3(targetPos.x - pos.x, 0, targetPos.z - pos.z);
        if (dir.lengthSqr() < 0.0001) {
            this.stopMove();
            return;
        }
        dir.normalize();

        const follower = this.nav;
        const steer = follower ? follower.steer(targetPos, dt) : null;
        if (steer) dir.set(steer);
        const speed = this.stats.moveSpeed;

        Vec3.copy(_prevPos, this.node.worldPosition);
        this._mover.move(this.characterController, this.node, dir.x * speed * dt, dir.z * speed * dt);

        const after = this.node.worldPosition;
        _moved.set(after.x - _prevPos.x, 0, after.z - _prevPos.z);
        const want = speed * dt * 0.35;
        CharacterFacing.rotateToward(
            this.facingNode,
            _moved.lengthSqr() > want * want ? _moved : dir,
            dt,
            this.rotateSpeed,
        );

        this._isMoving = true;
        this.separation?.setIdle(false);
        this.anim?.setMoveSpeed(speed);

        this.anim?.cancelAttackLock();
        this.anim?.play(AnimState.Walk);
    }

    public stopMove() {
        this._isMoving = false;
        this.separation?.setIdle(true);
        if (this.isAlive) {
            this.anim?.play(AnimState.Idle);
        }
    }

    public faceToward(worldPos: Vec3) {
        CharacterFacing.lookAtXZ(this.facingNode, worldPos);
    }

    public playWin() {
        this.anim?.play(AnimState.Win);
    }

    public playDie() {
        this.anim?.play(AnimState.Die);
    }

    private handleDeath() {
        if (!this._alive) return;
        this._alive = false;
        this.playDie();
        EventManager.instance.emit(GameplayEvents.HeroDied, this);
    }
}

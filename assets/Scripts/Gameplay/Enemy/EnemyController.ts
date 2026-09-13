import { _decorator, CCFloat, CCInteger, CharacterController, Component, Enum, Vec3 } from 'cc';
import EventManager from '../../Utility/EventManager';
import { AttackType } from '../Combat/AttackType';
import { CharacterFacing } from '../Combat/CharacterFacing';
import { CharacterStats } from '../Combat/CharacterStats';
import { CombatGate } from '../Combat/CombatGate';
import { EntitySeparation } from '../Combat/EntitySeparation';
import { GameplayEvents } from '../Events/GameplayEvents';
import { HeroController } from '../Hero/HeroController';
import { HeroPartyManager } from '../Hero/HeroPartyManager';
import { GameplayPoolService } from '../Managers/GameplayPoolService';
import { NavGrid } from '../Map/NavGrid';
import { NavPathFollower } from '../Map/NavPathFollower';
import { CharacterCollision } from '../Movement/CharacterCollision';
import { CharacterMover } from '../Movement/CharacterMover';
import { PlayerController } from '../Player/PlayerController';
import { AnimState } from '../Player/PlayerAnimation';
import { EnemyAggro } from './EnemyAggro';
import { EnemyAnimation } from './EnemyAnimation';
import { EnemyType } from './EnemyType';

const { ccclass, property } = _decorator;

const _prevPos = new Vec3();
const _moved = new Vec3();

const _travel = new Vec3();
const _lookAt = new Vec3();

const _face = new Vec3();

@ccclass('EnemyController')
export class EnemyController extends Component {
    private static _all: EnemyController[] = [];

    public static get all(): readonly EnemyController[] {
        return EnemyController._all;
    }

    @property({ type: Enum(EnemyType) })
    public enemyType: EnemyType = EnemyType.None;

    @property({ type: Enum(AttackType) })
    public attackType: AttackType = AttackType.Melee;

    @property(CharacterStats)
    public stats: CharacterStats = null;

    @property(CharacterController)
    public characterController: CharacterController = null;

    @property(EnemyAnimation)
    public anim: EnemyAnimation = null;

    @property(EntitySeparation)
    public separation: EntitySeparation = null;

    @property(CCInteger)
    public coinValue: number = 1;

    @property
    public zoneId: string = '';

    @property
    public usePathfinding: boolean = true;

    @property
    public cornerAssist: boolean = true;

    @property
    public rotateSpeed: number = 12;

    @property({ type: CCFloat })
    public steerSmooth: number = 10;

    @property({ type: CCFloat })
    public retargetInterval: number = 0.35;

    @property({ type: CCFloat })
    public retargetMargin: number = 1.5;

    private _nav: NavPathFollower = null;
    private _aggro: EnemyAggro = null;
    private _aggroLooked: boolean = false;
    private _alive: boolean = true;

    private _ceaseFire: boolean = false;
    private _mover: CharacterMover = new CharacterMover();

    private _steerDir: Vec3 = new Vec3();
    private _hasSteer: boolean = false;

    private _target: HeroController = null;
    private _retarget: number = 0;

    public get aggro(): EnemyAggro {
        if (!this._aggroLooked) {
            this._aggro = this.getComponent(EnemyAggro);
            this._aggroLooked = true;
        }
        return this._aggro;
    }

    private get nav(): NavPathFollower {
        if (!this.usePathfinding) return null;
        if (this._nav) return this._nav;
        if (!NavGrid.instance) return null;
        this._nav = this.getComponent(NavPathFollower) || this.addComponent(NavPathFollower);
        return this._nav;
    }

    onEnable() {
        EnemyController._all.push(this);
        if (!this.stats) this.stats = this.getComponent(CharacterStats);
        if (!this.characterController) this.characterController = this.getComponent(CharacterController);
        if (!this.anim) this.anim = this.getComponent(EnemyAnimation);
        if (!this.separation) this.separation = this.getComponent(EntitySeparation);

        CharacterCollision.applyEnemy(this.characterController);

        this._nav?.clear();
        this._aggroLooked = false;
        this._hasSteer = false;
        this._target = null;
        this._retarget = 0;
        if (this.stats) {
            this.stats.isPlayer = false;
            this.stats.healToFull();
        }
        this._alive = true;
        this._ceaseFire = false;
        EventManager.instance.on(GameplayEvents.GameLose, this.ceaseFire, this);
        EventManager.instance.on(GameplayEvents.GameWin, this.ceaseFire, this);
        EventManager.instance.emit(GameplayEvents.EnemySpawned, this);
    }

    onDisable() {
        EventManager.instance.off(GameplayEvents.GameLose, this.ceaseFire, this);
        EventManager.instance.off(GameplayEvents.GameWin, this.ceaseFire, this);
        const idx = EnemyController._all.indexOf(this);
        if (idx >= 0) EnemyController._all.splice(idx, 1);
    }

    public get isAlive(): boolean {
        return this._alive;
    }

    public static get combatEnabled(): boolean {
        return CombatGate.open;
    }

    public static set combatEnabled(v: boolean) {
        CombatGate.open = v;
    }

    public get canAct(): boolean {
        return EnemyController.combatEnabled && this._alive && !this._ceaseFire;
    }

    private ceaseFire() {
        if (this._ceaseFire) return;
        this._ceaseFire = true;
        if (!this._alive) return;
        this.stopMove();
    }

    update(dt: number) {
        if (this._retarget > 0) this._retarget -= dt;
        if (!this._alive || !this.stats || this.stats.isDead) {
            if (this.stats?.isDead && this._alive) {
                this.handleDeath();
            }
            return;
        }

        if (!EnemyController.combatEnabled && !this._ceaseFire) this.trackTarget(dt);
    }

    private trackTarget(dt: number) {
        const target = this.getTargetHero();
        if (!target?.node?.isValid) return;
        const p = this.node.worldPosition;
        const t = target.node.worldPosition;
        _face.set(t.x - p.x, 0, t.z - p.z);
        if (_face.lengthSqr() < 0.0001) return;
        CharacterFacing.rotateToward(this.node, _face, dt, this.rotateSpeed);
    }

    public moveToward(targetPos: Vec3, dt: number) {
        if (!this.stats) return;
        const pos = this.node.worldPosition;
        const dir = new Vec3(targetPos.x - pos.x, 0, targetPos.z - pos.z);
        if (dir.lengthSqr() < 0.0001) {
            this.anim?.play(AnimState.Idle);
            this.separation?.setIdle(true);
            this._hasSteer = false;
            return;
        }
        dir.normalize();

        const follower = this.nav;
        const steer = follower ? follower.steer(targetPos, dt) : null;
        if (steer) dir.set(steer);
        this.smoothSteer(dir, dt);
        const speed = this.stats.moveSpeed;

        this._mover.cornerAssist = this.cornerAssist;

        Vec3.copy(_prevPos, this.node.worldPosition);
        this._mover.move(this.characterController, this.node, dir.x * speed * dt, dir.z * speed * dt);

        const after = this.node.worldPosition;
        _moved.set(after.x - _prevPos.x, 0, after.z - _prevPos.z);
        const want = speed * dt * 0.35;
        CharacterFacing.rotateToward(
            this.node,
            _moved.lengthSqr() > want * want ? _moved : dir,
            dt,
            this.rotateSpeed,
        );
        this.anim?.play(AnimState.Walk);
        this.separation?.setIdle(false);
    }

    private smoothSteer(dir: Vec3, dt: number) {
        if (this.steerSmooth <= 0 || !this._hasSteer) {
            this._steerDir.set(dir.x, 0, dir.z);
            this._hasSteer = true;
            return;
        }
        const t = 1 - Math.exp(-this.steerSmooth * dt);
        this._steerDir.x += (dir.x - this._steerDir.x) * t;
        this._steerDir.z += (dir.z - this._steerDir.z) * t;
        this._steerDir.y = 0;

        if (this._steerDir.lengthSqr() < 1e-6) {
            this._steerDir.set(dir.x, 0, dir.z);
            return;
        }
        this._steerDir.normalize();
        dir.set(this._steerDir);
    }

    public stopMove() {
        this.anim?.play(AnimState.Idle);
        this.separation?.setIdle(true);

        this._hasSteer = false;
    }

    public getTargetHero(): HeroController {
        const cur = this._target;
        const curOk = !!cur && cur.isValid && !!cur.node && cur.node.activeInHierarchy && cur.isAlive;
        if (curOk && this._retarget > 0) return cur;

        this._retarget = this.retargetInterval;
        const next = this.pickTargetHero();
        if (!next) {
            this._target = curOk ? cur : null;
            return this._target;
        }

        const pri = HeroPartyManager.instance?.priorityHero;
        if (curOk && next !== cur && next !== pri) {
            const p = this.node.worldPosition;
            const a = cur.node.worldPosition;
            const b = next.node.worldPosition;
            const dCur = Math.sqrt((a.x - p.x) * (a.x - p.x) + (a.z - p.z) * (a.z - p.z));
            const dNext = Math.sqrt((b.x - p.x) * (b.x - p.x) + (b.z - p.z) * (b.z - p.z));
            if (dNext > dCur - this.retargetMargin) return cur;
        }
        this._target = next;
        return next;
    }

    private pickTargetHero(): HeroController {
        const party = HeroPartyManager.instance;
        if (party) {
            const hero = party.getNearestAliveHero(this.node.worldPosition, true);
            if (hero) return hero;
        }
        const pc = PlayerController.instance;
        return pc ? pc.getComponent(HeroController) : null;
    }

    public hasSightTo(worldPos: Vec3): boolean {
        return NavGrid.canShoot(this.node.worldPosition, worldPos);
    }

    public distanceToTarget(hero: HeroController = null): number {
        const target = hero || this.getTargetHero();
        if (!target) return Number.MAX_VALUE;
        const a = this.node.worldPosition;
        const b = target.node.worldPosition;
        const dx = a.x - b.x;
        const dz = a.z - b.z;
        return Math.sqrt(dx * dx + dz * dz);
    }

    public faceTarget(hero: HeroController = null) {
        const target = hero || this.getTargetHero();
        if (!target) return;

        CharacterFacing.lookAtXZ(this.node, target.node.worldPosition);
    }

    public faceTravelDirection(): boolean {
        const hero = this.getTargetHero();
        if (!hero || !hero.node) return false;
        const pos = this.node.worldPosition;
        const grid = NavGrid.instance;
        if (grid && grid.travelDirection(pos, hero.node.worldPosition, _travel)) {
            _lookAt.set(pos.x + _travel.x, pos.y, pos.z + _travel.z);
        } else {
            _lookAt.set(hero.node.worldPosition);
        }
        CharacterFacing.lookAtXZ(this.node, _lookAt);
        return true;
    }

    public notifyDamaged() {

        this.aggro?.wake();
        if (this.stats?.isDead && this._alive) {
            this.handleDeath();
        }
    }

    private handleDeath() {
        if (!this._alive) return;
        this._alive = false;
        this.anim?.play(AnimState.Die);

        const pool = GameplayPoolService.instance;
        if (pool) {
            const coin = pool.spawnCoin(this.node.worldPosition, this.coinValue);
            const hero = this.getTargetHero();
            if (coin && hero) {
                coin.setPlayer(hero.node);
            }
            pool.spawnVfx(this.node.worldPosition);
        }

        EventManager.instance.emit(GameplayEvents.EnemyDied, this);

        this.scheduleOnce(() => {
            if (this.node && this.node.isValid) {
                this.node.destroy();
            }
        }, 0.6);
    }
}

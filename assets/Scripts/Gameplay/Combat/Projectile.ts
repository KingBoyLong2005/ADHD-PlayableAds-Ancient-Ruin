import { _decorator, CCFloat, Component, Node, ParticleSystem, Quat, Vec3 } from 'cc';
import EventManager from '../../Utility/EventManager';
import PoolManager, { TypeNodePool, VfxId } from '../../Utility/Pool/PoolManager';
import { EnemyController } from '../Enemy/EnemyController';
import { GameplayEvents } from '../Events/GameplayEvents';
import { HeroClass } from '../Hero/HeroClass';
import { GameManager } from '../Managers/GameManager';
import { NavGrid } from '../Map/NavGrid';
import { SkillApplier } from '../Skills/SkillApplier';
import { HeroVfx } from '../Vfx/HeroVfx';
import { VfxService } from '../Vfx/VfxService';
import { CharacterStats } from './CharacterStats';
import { DamageDealer } from './DamageDealer';
import { ProjectileFlightMode } from './ProjectileFlightMode';

const { ccclass, property } = _decorator;

const _aim = new Vec3();
const _rot = new Quat();

const _from = new Vec3();

const _wallHit = new Vec3();

const ALIGN_LOCAL = 1;
const ALIGN_WORLD = 0;

const ARROW_AIM_YAW = -90;

@ccclass('Projectile')
export class Projectile extends Component {
    @property(CCFloat)
    public speed: number = 12;

    @property(CCFloat)
    public lifetime: number = 3;

    @property(CCFloat)
    public hitRadius: number = 0.6;

    @property(CCFloat)
    public minArcDuration: number = 0.25;

    @property(CCFloat)
    public maxArcDuration: number = 2.5;

    private _damage: number = 0;
    private _owner: CharacterStats = null;
    private _target: CharacterStats = null;
    private _dir: Vec3 = new Vec3(0, 0, 1);
    private _aliveTime: number = 0;
    private _active: boolean = false;
    private _pierceLeft: number = 0;
    private _homing: boolean = false;
    private _mode: ProjectileFlightMode = ProjectileFlightMode.Straight;
    private _arcHeight: number = 3;
    private _startPos: Vec3 = new Vec3();
    private _endPos: Vec3 = new Vec3();
    private _flightDuration: number = 1;
    private _arcT: number = 0;
    private _hitApplied: boolean = false;

    private _alreadyHit: CharacterStats[] = [];

    private _trailVfx: Node = null;

    private _impactVfx: VfxId = VfxId.None;
    private _shooterClass: HeroClass = HeroClass.None;

    public launch(
        owner: CharacterStats,
        target: CharacterStats,
        damage: number,
        _hostileToPlayer: boolean,
        worldPos: Vec3,
        parent: Node = null,
        mode: ProjectileFlightMode = ProjectileFlightMode.Straight,
        arcHeight: number = 3,
    ) {
        this._owner = owner;
        this._target = target;
        this._damage = damage;
        this._aliveTime = 0;
        this._active = true;
        this._hitApplied = false;
        this._mode = mode;
        this._arcHeight = arcHeight;
        this._arcT = 0;
        this._alreadyHit.length = 0;
        this.node.active = true;

        const shooter = this.owner;
        const skills = shooter ? shooter.getComponent(SkillApplier) || SkillApplier.instance : SkillApplier.instance;
        this._pierceLeft = owner?.isPlayer ? (skills?.pierceCount || 0) : 0;
        this._homing = !!(owner?.isPlayer && skills?.homingEnabled && mode === ProjectileFlightMode.Straight);

        if (parent) {
            this.node.setParent(parent);
        }
        this.node.setWorldPosition(worldPos);
        this._startPos.set(worldPos);

        if (target && target.node) {
            this._endPos.set(target.node.worldPosition);
        } else {
            this._endPos.set(worldPos.x, worldPos.y, worldPos.z + 1);
        }

        if (this._mode === ProjectileFlightMode.Arc) {
            const dx = this._endPos.x - this._startPos.x;
            const dz = this._endPos.z - this._startPos.z;
            const distXZ = Math.sqrt(dx * dx + dz * dz);
            const duration = this.speed > 0.001 ? distXZ / this.speed : this.minArcDuration;
            this._flightDuration = Math.max(this.minArcDuration, Math.min(this.maxArcDuration, duration));
            this.faceArc(0);
        } else {
            this.refreshDirection3D(worldPos);
            this.faceDirection(this._dir);
        }

        this.applyShooterVfx();
    }

    private get owner(): CharacterStats {
        const o = this._owner;
        return o && o.isValid && o.node ? o : null;
    }

    private applyShooterVfx() {

        this.clearTrailVfx();

        const owner = this.owner;
        const vfx = owner ? owner.node.getComponent(HeroVfx) : null;
        if (!vfx) {
            this._impactVfx = VfxId.None;
            this._shooterClass = HeroClass.None;
            return;
        }

        this._shooterClass = vfx.heroClass;
        this._impactVfx = vfx.impactVfx;

        const trailId = vfx.projectileVfx(this._mode === ProjectileFlightMode.Arc);
        if (trailId === VfxId.None) return;

        this._trailVfx = VfxService.attachTo(trailId, this.node, this._shooterClass, null, this.lifetime);
        Projectile.alignVfxToNode(this._trailVfx, trailId);
    }

    private clearTrailVfx() {
        if (this._trailVfx && this._trailVfx.isValid) {
            this._trailVfx.destroy();
        }
        this._trailVfx = null;
    }

    private refreshDirection3D(from: Vec3) {
        if (!this._target || !this._target.node) {
            this._dir.set(0, 0, 1);
            return;
        }
        Vec3.subtract(this._dir, this._target.node.worldPosition, from);
        if (this._dir.lengthSqr() < 0.0001) {
            this._dir.set(0, 0, 1);
        } else {
            this._dir.normalize();
        }
    }

    private static alignVfxToNode(root: Node, id: VfxId) {
        if (!root || !root.isValid) return;
        root.setRotationFromEuler(0, id === VfxId.FX_Arrow_Bullet ? ARROW_AIM_YAW : 0, 0);

        const systems = root.getComponentsInChildren(ParticleSystem);
        for (let i = 0; i < systems.length; i++) {
            const ps = systems[i];

            if (!ps.processor || !ps.renderer) continue;
            if (ps.renderer.alignSpace === ALIGN_LOCAL) {
                ps.renderer.alignSpace = ALIGN_WORLD;
            }
        }
    }

    private faceDirection(dir: Vec3) {
        _aim.set(dir.x, dir.y, dir.z);
        if (_aim.lengthSqr() < 0.000001) return;
        _aim.normalize();

        const up = Math.abs(_aim.y) > 0.999 ? Vec3.FORWARD : Vec3.UP;
        Quat.fromViewUp(_rot, _aim, up);
        this.node.setWorldRotation(_rot);
    }

    private faceArc(t: number) {
        const dy = (this._endPos.y - this._startPos.y) + this._arcHeight * 4 * (1 - 2 * t);
        _aim.set(this._endPos.x - this._startPos.x, dy, this._endPos.z - this._startPos.z);
        this.faceDirection(_aim);
    }

    update(dt: number) {
        if (!this._active) return;
        const gm = GameManager.instance;
        if (gm && gm.isPaused) return;

        this._aliveTime += dt;
        if (this._aliveTime >= this.lifetime) {
            this.recycle();
            return;
        }

        if (this._mode === ProjectileFlightMode.Arc) {
            this.updateArc(dt);
        } else {
            this.updateStraight(dt);
        }
    }

    private updateStraight(dt: number) {

        if (this._homing && this._target && !this._target.isDead) {
            this.refreshDirection3D(this.node.worldPosition);
            this.faceDirection(this._dir);
        }

        const pos = this.node.worldPosition;

        _from.set(pos);
        this.node.setWorldPosition(
            pos.x + this._dir.x * this.speed * dt,
            pos.y + this._dir.y * this.speed * dt,
            pos.z + this._dir.z * this.speed * dt,
        );

        this.tryHitStraight();
        this.stopIfHitWall();
    }

    private updateArc(dt: number) {
        _from.set(this.node.worldPosition);
        this._arcT += dt / this._flightDuration;
        const t = Math.min(1, this._arcT);

        const x = this._startPos.x + (this._endPos.x - this._startPos.x) * t;
        const z = this._startPos.z + (this._endPos.z - this._startPos.z) * t;
        const baseY = this._startPos.y + (this._endPos.y - this._startPos.y) * t;
        const y = baseY + this._arcHeight * 4 * t * (1 - t);
        this.node.setWorldPosition(x, y, z);
        this.faceArc(t);

        if (t >= 1) {
            this.applyHit(this._target, this._endPos);
            return;
        }

        const dx = x - this._endPos.x;
        const dy = y - this._endPos.y;
        const dz = z - this._endPos.z;
        if (dx * dx + dy * dy + dz * dz <= this.hitRadius * this.hitRadius) {
            this.applyHit(this._target, this._endPos);
            return;
        }

        this.stopIfHitWall();
    }

    private stopIfHitWall() {
        if (!this._active) return;
        if (!NavGrid.hitWall(_from, this.node.worldPosition, _wallHit)) return;
        this.node.setWorldPosition(_wallHit);
        this.applyHit(null, _wallHit, true);
    }

    private tryHitStraight() {
        const victim = this.findVictimInRange();
        if (victim) {
            this.applyHit(victim, victim.node.worldPosition);
            return;
        }

        if (this._pierceLeft <= 0 && (!this._target || this._target.isDead || !this._target.node)) {
            this.recycle();
        }
    }

    private findVictimInRange(): CharacterStats {
        const pos = this.node.worldPosition;
        const radiusSq = this.hitRadius * this.hitRadius;

        if (!this._owner?.isPlayer) {
            const t = this._target;
            if (!t || t.isDead || !t.node || this._alreadyHit.indexOf(t) >= 0) return null;
            return this.distanceSq(pos, t.node.worldPosition) <= radiusSq ? t : null;
        }

        const enemies = EnemyController.all;
        let best: CharacterStats = null;
        let bestDistSq = radiusSq;
        for (let i = 0; i < enemies.length; i++) {
            const e = enemies[i];
            const stats = e?.stats;
            if (!stats || stats.isDead || !e.node.active) continue;
            if (this._alreadyHit.indexOf(stats) >= 0) continue;

            const d = this.distanceSq(pos, e.node.worldPosition);
            if (d <= bestDistSq) {
                bestDistSq = d;
                best = stats;
            }
        }
        return best;
    }

    private distanceSq(a: Vec3, b: Vec3): number {
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dz = a.z - b.z;
        return dx * dx + dy * dy + dz * dz;
    }

    private applyHit(victim: CharacterStats, hitPos: Vec3, stopHere: boolean = false) {
        if (this._hitApplied && this._pierceLeft <= 0) return;

        const fxPos = new Vec3(hitPos.x, hitPos.y, hitPos.z);
        EventManager.instance.emit(GameplayEvents.SpawnHitVfx, fxPos);

        if (this._impactVfx !== VfxId.None) {
            VfxService.spawnAt(this._impactVfx, fxPos, this._shooterClass);
        }

        const owner = this.owner;
        if (victim && !victim.isDead) {
            this._alreadyHit.push(victim);
            DamageDealer.apply(victim, this._damage, owner);
        }

        const skills = owner
            ? owner.getComponent(SkillApplier) || SkillApplier.instance
            : SkillApplier.instance;
        if (owner?.isPlayer && skills?.explosionEnabled) {
            this.applyExplosion(fxPos, victim, owner);
        }

        this._hitApplied = true;

        if (this._mode === ProjectileFlightMode.Straight && this._pierceLeft > 0 && !stopHere) {
            this._pierceLeft -= 1;
            this._hitApplied = false;
            return;
        }

        this.recycle();
    }

    private applyExplosion(center: Vec3, victim: CharacterStats, owner: CharacterStats) {
        const enemies = EnemyController.all;
        const radius = 2.5;
        for (let i = 0; i < enemies.length; i++) {
            const e = enemies[i];
            if (!e || e.stats?.isDead) continue;
            if (e.stats === victim) continue;
            const dx = e.node.worldPosition.x - center.x;
            const dz = e.node.worldPosition.z - center.z;
            if (dx * dx + dz * dz <= radius * radius) {
                DamageDealer.apply(e.stats, this._damage * 0.5, owner);
            }
        }
    }

    public recycle() {
        this._active = false;
        this._owner = null;
        this._target = null;
        this._hitApplied = false;
        this._alreadyHit.length = 0;
        this.clearTrailVfx();
        this._impactVfx = VfxId.None;
        this._shooterClass = HeroClass.None;

        const pooled = PoolManager.instance
            ? PoolManager.instance.PutNodeToPool(TypeNodePool.projectile, this.node)
            : false;
        if (!pooled) {
            this.node.destroy();
        }
    }
}

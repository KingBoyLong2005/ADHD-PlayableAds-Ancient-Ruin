import { _decorator, CCFloat, CCInteger, Component, Enum, instantiate, Node, Prefab, Vec3 } from 'cc';
import { AttackType } from '../Combat/AttackType';
import { CharacterStats } from '../Combat/CharacterStats';
import { StatsProfile } from '../Data/StatsProfile';
import { GameplayLog } from '../Debug/GameplayLog';
import { EnemyAggro } from '../Enemy/EnemyAggro';
import { EnemyController } from '../Enemy/EnemyController';
import { EnemyMeleeAI } from '../Enemy/EnemyMeleeAI';
import { EnemyRangedAI } from '../Enemy/EnemyRangedAI';
import { EnemyType } from '../Enemy/EnemyType';
import { HeroPartyManager } from '../Hero/HeroPartyManager';
import { NavGrid } from '../Map/NavGrid';
import { PlayerController } from '../Player/PlayerController';
import { GameManager } from './GameManager';

const { ccclass, property } = _decorator;

const _pos = new Vec3();
const _hero = new Vec3();

export enum SpawnTrigger {

    OnStart = 0,

    WhenHeroNear = 1,

    Manual = 2,
}

@ccclass('EnemySpawnPoint')
export class EnemySpawnPoint extends Component {
    private static _all: EnemySpawnPoint[] = [];

    public static get all(): readonly EnemySpawnPoint[] {
        return EnemySpawnPoint._all;
    }

    public static pendingTotal(): number {
        let total = 0;
        for (const p of EnemySpawnPoint._all) {
            if (p && p.isValid && p.prefab) total += Math.max(0, p.count);
        }
        return total;
    }

    private static _pool: Map<string, Node[]> = new Map();

    private static _warm: { prefab: Prefab, left: number }[] = [];

    private static poolKey(prefab: Prefab): string {
        if (!prefab) return '';
        return prefab.uuid || prefab.name || '';
    }

    public static reserve(prefab: Prefab, count: number) {
        if (!prefab || count <= 0) return;
        const key = EnemySpawnPoint.poolKey(prefab);
        const bin = EnemySpawnPoint._pool.get(key);
        const order = EnemySpawnPoint._warm.find((w) => EnemySpawnPoint.poolKey(w.prefab) === key);
        const have = (bin ? bin.length : 0) + (order ? order.left : 0);
        const need = count - have;
        if (need <= 0) return;

        if (order) order.left += need;
        else EnemySpawnPoint._warm.push({ prefab, left: need });
    }

    public static get warmLeft(): number {
        let n = 0;
        for (const w of EnemySpawnPoint._warm) n += w.left;
        return n;
    }

    public static warmStep(budget: number): number {
        let made = 0;
        while (made < budget && EnemySpawnPoint._warm.length > 0) {
            const w = EnemySpawnPoint._warm[0];
            if (!w.prefab || !w.prefab.isValid || w.left <= 0) {
                EnemySpawnPoint._warm.shift();
                continue;
            }
            const key = EnemySpawnPoint.poolKey(w.prefab);
            let bin = EnemySpawnPoint._pool.get(key);
            if (!bin) {
                bin = [];
                EnemySpawnPoint._pool.set(key, bin);
            }

            bin.push(instantiate(w.prefab));
            w.left -= 1;
            made += 1;
            if (w.left <= 0) EnemySpawnPoint._warm.shift();
        }
        return made;
    }

    private static takeFromPool(prefab: Prefab): Node {
        const bin = EnemySpawnPoint._pool.get(EnemySpawnPoint.poolKey(prefab));
        while (bin && bin.length > 0) {
            const n = bin.pop();
            if (n && n.isValid) return n;
        }
        return null;
    }

    public static clearPool() {
        EnemySpawnPoint._pool.forEach((bin) => {
            for (const n of bin) if (n && n.isValid) n.destroy();
        });
        EnemySpawnPoint._pool.clear();
        EnemySpawnPoint._warm.length = 0;
    }

    public static remainingTotal(): number {
        let total = 0;
        for (const p of EnemySpawnPoint._all) {
            if (!p || !p.isValid || !p.prefab) continue;
            total += p._remaining < 0 ? Math.max(0, p.count) : p._remaining;
        }
        return total;
    }

    public static resetAll() {
        for (const p of EnemySpawnPoint._all) {
            if (p && p.isValid) p.resetPoint();
        }
    }

    @property({ type: Prefab })
    public prefab: Prefab = null;

    @property({ type: Enum(EnemyType) })
    public enemyType: EnemyType = EnemyType.None;

    @property({ type: Enum(AttackType) })
    public attackType: AttackType = AttackType.Melee;

    @property({ type: CCInteger })
    public count: number = 3;

    @property({ type: CCFloat })
    public spawnInterval: number = 0.5;

    @property({ type: CCFloat })
    public startDelay: number = 0;

    @property({ type: Node })
    public enemyParent: Node = null;

    @property({ type: CCFloat })
    public scatterRadius: number = 1.5;

    @property({ type: CCFloat })
    public spawnClearance: number = 0.3;

    @property({ type: CCFloat })
    public spawnSpacing: number = 1;

    @property({ type: Enum(SpawnTrigger) })
    public trigger: SpawnTrigger = SpawnTrigger.OnStart;

    @property({ type: CCFloat })
    public activationRadius: number = 20;

    @property
    public addAggro: boolean = true;

    @property({ type: CCFloat })
    public aggroRadius: number = 12;

    @property({ type: CCFloat })
    public leashRadius: number = 0;

    @property({ type: CCFloat })
    public giveUpDistance: number = 4;

    @property
    public requireLineOfSight: boolean = true;

    @property
    public alertGroup: boolean = true;

    @property({ type: CCFloat })
    public alertRadius: number = 0;

    @property
    public zoneId: string = '';

    @property
    public overrideStats: boolean = false;

    @property({ type: StatsProfile })
    public stats: StatsProfile = new StatsProfile();

    private _remaining: number = -1;
    private _timer: number = 0;
    private _delay: number = 0;
    private _activated: boolean = false;

    private _placed: Vec3[] = [];

    public get remaining(): number {
        return Math.max(0, this._remaining);
    }

    public get finished(): boolean {
        return this._remaining === 0;
    }

    onEnable() {
        EnemySpawnPoint._all.push(this);
        this._remaining = -1;
    }

    onDisable() {
        const i = EnemySpawnPoint._all.indexOf(this);
        if (i >= 0) EnemySpawnPoint._all.splice(i, 1);
    }

    public resetPoint() {
        this._remaining = -1;
    }

    public beginSpawning() {
        if (this._remaining < 0) this.arm();
        this._activated = true;
    }

    public spawnAllNow(): number {
        return this.spawnStep(Number.MAX_SAFE_INTEGER);
    }

    public spawnStep(budget: number): number {
        if (this._remaining < 0) this.arm();
        this._activated = true;
        this._delay = 0;
        this._timer = 0;

        let n = 0;
        while (this._remaining > 0 && n < budget) {
            this.spawnOne();
            this._remaining -= 1;
            n += 1;
        }
        if (n > 0) {
            GameplayLog.log('spawn', `${this.node.name}: đẻ thẳng ${n} con`
                + (this._remaining > 0 ? ` (còn ${this._remaining})` : ''));
        }
        return n;
    }

    private arm() {
        this._remaining = this.prefab ? Math.max(0, this.count) : 0;
        this._timer = 0;
        this._delay = this.startDelay;

        this._placed.length = 0;
        this._activated = this.trigger === SpawnTrigger.OnStart;
        const p = this.node.worldPosition;
        GameplayLog.log(
            'spawn',
            `${this.node.name}: nạp ${this._remaining} con tại ${GameplayLog.pos(p.x, p.z)}, `
                + `trigger=${SpawnTrigger[this.trigger]}`
                + (this.trigger === SpawnTrigger.WhenHeroNear ? ` (r=${this.activationRadius})` : '')
                + (this.prefab ? '' : ' — CHƯA GẮN PREFAB'),
        );
    }

    update(dt: number) {
        const gm = GameManager.instance;
        if (gm && gm.isPaused) return;

        if (this._remaining < 0) {
            if (gm && !gm.isPlaying) return;
            this.arm();
        }
        if (this._remaining <= 0) return;

        if (!this._activated) {
            if (this.trigger !== SpawnTrigger.WhenHeroNear) return;
            if (!this.heroPos(_hero)) return;
            const dx = _hero.x - this.node.worldPosition.x;
            const dz = _hero.z - this.node.worldPosition.z;
            if (dx * dx + dz * dz > this.activationRadius * this.activationRadius) return;
            this._activated = true;
            GameplayLog.log(
                'spawn',
                `${this.node.name}: hero vào cách ${Math.sqrt(dx * dx + dz * dz).toFixed(1)}m `
                    + `(tầm ${this.activationRadius}) -> bắt đầu đẻ`,
            );
        }

        if (this._delay > 0) {
            this._delay -= dt;
            return;
        }
        this._timer -= dt;
        if (this._timer > 0) return;

        this.spawnOne();
        this._remaining -= 1;
        this._timer = this.spawnInterval;
        if (this._remaining === 0) {
            GameplayLog.log('spawn', `${this.node.name}: đẻ xong ${this.count} con`);
        }
    }

    private spawnOne() {
        if (!this.prefab) return;

        const node = EnemySpawnPoint.takeFromPool(this.prefab) || instantiate(this.prefab);
        node.setParent(this.enemyParent || this.node.parent || this.node);

        const how = this.pickSpawnPos(_pos);
        node.setWorldPosition(_pos);
        node.active = true;
        this._placed.push(_pos.clone());

        GameplayLog.log(
            'spawn',
            `${this.node.name}: con ${this.count - this._remaining + 1}/${this.count} `
                + `tại ${GameplayLog.pos(_pos.x, _pos.z)} [${how}]`,
        );

        let enemy = node.getComponent(EnemyController);
        if (!enemy) enemy = node.addComponent(EnemyController);
        enemy.attackType = this.attackType;
        if (this.enemyType !== EnemyType.None) enemy.enemyType = this.enemyType;
        if (this.zoneId) enemy.zoneId = this.zoneId;

        if (this.overrideStats && this.stats) {
            const stats = enemy.stats || node.getComponent(CharacterStats);
            if (stats) this.stats.applyTo(stats);
            else console.warn('[EnemySpawnPoint] overrideStats bật nhưng prefab không có CharacterStats:', node.name);
        }

        if (this.attackType === AttackType.Melee) {
            if (!node.getComponent(EnemyMeleeAI)) node.addComponent(EnemyMeleeAI);
        } else {
            if (!node.getComponent(EnemyRangedAI)) node.addComponent(EnemyRangedAI);
        }

        if (this.addAggro) {
            const aggro = node.getComponent(EnemyAggro) || node.addComponent(EnemyAggro);
            aggro.aggroRadius = this.aggroRadius;
            aggro.leashRadius = this.leashRadius;
            aggro.giveUpDistance = this.giveUpDistance;
            aggro.requireLineOfSight = this.requireLineOfSight;

            aggro.groupId = this.alertGroup ? this.node.uuid : '';

            aggro.zoneId = this.zoneId;
            aggro.alertGroup = this.alertGroup;
            aggro.alertRadius = this.alertRadius;

            aggro.setHome(_pos);
        }

        enemy.faceTarget();
    }

    private pickSpawnPos(out: Vec3): string {
        const base = this.node.worldPosition;
        const grid = NavGrid.instance;
        const usable = grid && grid.baked;

        if (this.scatterRadius > 0 && usable) {

            const passes = [
                { clear: true, space: true, tries: 12, why: 'tán' },
                { clear: false, space: true, tries: 8, why: 'tán (bỏ khoảng trống quanh thân)' },
                { clear: false, space: false, tries: 8, why: 'tán (bỏ cả giãn cách)' },
            ];
            for (const p of passes) {
                for (let i = 0; i < p.tries; i++) {

                    const r = this.scatterRadius * Math.sqrt(Math.random());
                    const a = Math.random() * Math.PI * 2;
                    const x = base.x + Math.cos(a) * r;
                    const z = base.z + Math.sin(a) * r;
                    if (p.clear ? !this.roomFor(grid, x, z) : !grid.isWalkableAt(x, z)) continue;
                    if (p.space && !this.farFromSiblings(x, z)) continue;
                    out.set(x, base.y, z);
                    return p.why;
                }
            }
        } else if (this.scatterRadius > 0) {
            out.set(base.x, base.y, base.z);
            return 'chưa bake lưới';
        }

        if (usable && grid.samplePosition(base.x, base.z, out)) {
            out.y = base.y;
            return 'BÁM VỀ Ô GẦN NHẤT — điểm đặt hơi lệch';
        }
        out.set(base);
        return usable ? 'KHÔNG TÌM ĐƯỢC Ô ĐI ĐƯỢC — điểm đặt nằm ngoài map' : 'chưa bake lưới';
    }

    private roomFor(grid: NavGrid, x: number, z: number): boolean {
        if (!grid.isWalkableAt(x, z)) return false;
        const r = this.spawnClearance;
        if (r <= 0) return true;
        return grid.isWalkableAt(x + r, z) && grid.isWalkableAt(x - r, z)
            && grid.isWalkableAt(x, z + r) && grid.isWalkableAt(x, z - r);
    }

    private farFromSiblings(x: number, z: number): boolean {
        const d = this.spawnSpacing;
        if (d <= 0) return true;
        for (let i = 0; i < this._placed.length; i++) {
            const p = this._placed[i];
            const dx = p.x - x;
            const dz = p.z - z;
            if (dx * dx + dz * dz < d * d) return false;
        }
        return true;
    }

    private heroPos(out: Vec3): boolean {
        const party = HeroPartyManager.instance;
        const hero = party ? party.getNearestAliveHero(this.node.worldPosition) : null;
        if (hero && hero.node) {
            out.set(hero.node.worldPosition);
            return true;
        }
        const pc = PlayerController.instance;
        if (pc && pc.node) {
            out.set(pc.node.worldPosition);
            return true;
        }
        return false;
    }
}

import { _decorator, Component, instantiate, Node, Vec3 } from 'cc';
import EventManager from '../../Utility/EventManager';
import { AttackType } from '../Combat/AttackType';
import { CharacterStats } from '../Combat/CharacterStats';
import { EnemySpawnConfig, EnemySpawnEntry } from '../Data/EnemySpawnConfig';
import { EnemyController } from '../Enemy/EnemyController';
import { EnemyMeleeAI } from '../Enemy/EnemyMeleeAI';
import { EnemyRangedAI } from '../Enemy/EnemyRangedAI';
import { EnemyType } from '../Enemy/EnemyType';
import { GameplayLog } from '../Debug/GameplayLog';
import { GameplayEvents } from '../Events/GameplayEvents';
import { EnemySpawnPoint } from './EnemySpawnPoint';
import { GameManager } from './GameManager';

const { ccclass, property } = _decorator;

@ccclass('SpawnManager')
export class SpawnManager extends Component {
    public static instance: SpawnManager;

    @property(EnemySpawnConfig)
    public config: EnemySpawnConfig = null;

    @property(Node)
    public enemyParent: Node = null;

    public totalToSpawn: number = 0;
    public totalSpawned: number = 0;
    public alive: number = 0;
    public killed: number = 0;

    private _queue: { entry: EnemySpawnEntry; remaining: number; timer: number }[] = [];
    private _started: boolean = false;
    private _cleared: boolean = false;
    private _startTimer: number = 0;

    onLoad() {
        SpawnManager.instance = this;
        if (!this.config) this.config = this.getComponent(EnemySpawnConfig);
    }

    onEnable() {
        EventManager.instance.on(GameplayEvents.EnemyDied, this.onEnemyDied, this);
        EventManager.instance.on(GameplayEvents.EnemySpawned, this.onEnemySpawned, this);
    }

    onDisable() {
        EventManager.instance.off(GameplayEvents.EnemyDied, this.onEnemyDied, this);
        EventManager.instance.off(GameplayEvents.EnemySpawned, this.onEnemySpawned, this);
    }

    start() {

        const gm = GameManager.instance;
        if (!gm || gm.isPlaying) this.resetAndStart();
    }

    public resetAndStart() {

        EnemySpawnPoint.resetAll();
        const fromConfig = this.config ? this.config.totalToSpawn : 0;
        const fromPoints = EnemySpawnPoint.pendingTotal();
        this.totalToSpawn = fromConfig + fromPoints;
        GameplayLog.log(
            'spawn',
            `chỉ tiêu ${this.totalToSpawn} con = config ${fromConfig} + ${EnemySpawnPoint.all.length} tổ ${fromPoints}`,
        );
        this.totalSpawned = 0;
        this.alive = 0;
        this.killed = 0;
        this._queue.length = 0;
        this._started = false;
        this._cleared = false;
        this._startTimer = this.config ? this.config.startDelay : 0;

        if (!this.config) return;
        for (let i = 0; i < this.config.entries.length; i++) {
            const entry = this.config.entries[i];
            if (!entry.prefab || entry.count <= 0) continue;
            this._queue.push({
                entry,
                remaining: entry.count,
                timer: 0,
            });
        }
        this._started = true;
    }

    update(dt: number) {
        const gm = GameManager.instance;
        if (gm && gm.isPaused) return;

        if (!this._started) {
            if (gm && gm.isPlaying) this.resetAndStart();
            else return;
        }

        if (this._startTimer > 0) {
            this._startTimer -= dt;
            return;
        }

        for (let i = 0; i < this._queue.length; i++) {
            const item = this._queue[i];
            if (item.remaining <= 0) continue;
            item.timer -= dt;
            if (item.timer > 0) continue;
            this.spawnOne(item.entry);
            item.remaining -= 1;
            item.timer = item.entry.spawnInterval;
        }

        this.checkCleared();
    }

    private spawnOne(entry: EnemySpawnEntry) {
        if (!entry.prefab) return;
        const node = instantiate(entry.prefab);
        const parent = this.enemyParent || this.node;
        node.setParent(parent);

        const pos = entry.spawnPoint
            ? entry.spawnPoint.worldPosition.clone()
            : this.node.worldPosition.clone();
        pos.add(entry.spawnOffset || new Vec3());
        node.setWorldPosition(pos);
        node.active = true;

        let enemy = node.getComponent(EnemyController);
        if (!enemy) enemy = node.addComponent(EnemyController);
        enemy.attackType = entry.attackType;

        if (entry.enemyType !== EnemyType.None) enemy.enemyType = entry.enemyType;

        if (entry.overrideStats && entry.stats) {
            const stats = enemy.stats || node.getComponent(CharacterStats);
            if (stats) entry.stats.applyTo(stats);
            else console.warn('[SpawnManager] overrideStats set but prefab has no CharacterStats:', node.name);
        }

        if (entry.attackType === AttackType.Melee) {
            if (!node.getComponent(EnemyMeleeAI)) node.addComponent(EnemyMeleeAI);
        } else {
            if (!node.getComponent(EnemyRangedAI)) node.addComponent(EnemyRangedAI);
        }

        enemy.faceTravelDirection();
    }

    private onEnemySpawned() {
        this.totalSpawned += 1;
        this.alive += 1;
    }

    private onEnemyDied() {
        this.alive = Math.max(0, this.alive - 1);
        this.killed += 1;
        GameplayLog.log(
            'spawn',
            `giết ${this.killed}/${this.totalToSpawn}, đã đẻ ${this.totalSpawned}, còn sống ${this.alive}`,
        );

        if (this.totalToSpawn > 0 && this.killed >= this.totalToSpawn && this.alive <= 0) {
            this.announceCleared('giết đủ chỉ tiêu');
        }
    }

    private get queuedRemaining(): number {
        let n = 0;
        for (let i = 0; i < this._queue.length; i++) {
            n += Math.max(0, this._queue[i].remaining);
        }
        return n;
    }

    private checkCleared() {
        if (this._cleared) return;

        if (this.totalSpawned <= 0) return;
        if (this.queuedRemaining > 0) return;
        if (EnemySpawnPoint.remainingTotal() > 0) return;

        const enemies = EnemyController.all;
        for (let i = 0; i < enemies.length; i++) {
            if (enemies[i]?.isAlive) return;
        }
        this.announceCleared('map sạch bóng quái');
    }

    private announceCleared(why: string) {
        if (this._cleared) return;
        this._cleared = true;
        GameplayLog.log('spawn', `sạch quái (${why}) -> AllEnemiesCleared`);
        EventManager.instance.emit(GameplayEvents.AllEnemiesCleared);
    }
}

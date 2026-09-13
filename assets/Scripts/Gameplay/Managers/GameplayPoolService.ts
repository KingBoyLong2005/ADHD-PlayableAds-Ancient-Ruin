import { _decorator, Component, instantiate, Node, Prefab, Vec3 } from 'cc';
import PoolManager, { TypeNodePool } from '../../Utility/Pool/PoolManager';
import { AutoDestruction } from '../../Utility/AutoDestruction';
import { DestroyVFX } from '../../Utility/DestroyVFX';
import EventManager from '../../Utility/EventManager';
import { CharacterStats } from '../Combat/CharacterStats';
import { DamageDealer } from '../Combat/DamageDealer';
import { GameplayLog } from '../Debug/GameplayLog';
import { Projectile } from '../Combat/Projectile';
import { ProjectileFlightMode } from '../Combat/ProjectileFlightMode';
import { CoinPickup } from '../Economy/CoinPickup';
import { GameplayEvents } from '../Events/GameplayEvents';

const { ccclass, property } = _decorator;

@ccclass('GameplayPoolService')
export class GameplayPoolService extends Component {
    public static instance: GameplayPoolService;

    @property(Node)
    public spawnParent: Node = null;

    @property
    public vfxRecycleDelay: number = 1;

    @property({ type: Prefab })
    public projectilePrefab: Prefab = null;

    private _warnedNoProjectile: boolean = false;

    onLoad() {
        GameplayPoolService.instance = this;
    }

    onEnable() {
        EventManager.instance.on(GameplayEvents.SpawnHitVfx, this.onSpawnHitVfx, this);
    }

    onDisable() {
        EventManager.instance.off(GameplayEvents.SpawnHitVfx, this.onSpawnHitVfx, this);
    }

    private onSpawnHitVfx(worldPos: Vec3) {
        this.spawnVfx(worldPos);
    }

    public spawnProjectile(
        owner: CharacterStats,
        target: CharacterStats,
        damage: number,
        hostileToPlayer: boolean,
        worldPos: Vec3,
        mode: ProjectileFlightMode = ProjectileFlightMode.Straight,
        arcHeight: number = 3,
    ): Projectile {
        let node = PoolManager.instance?.GetNodeOfPool(TypeNodePool.projectile) || null;

        if (!node && this.projectilePrefab) {
            node = instantiate(this.projectilePrefab);
        }
        if (!node) {
            if (!this._warnedNoProjectile) {
                this._warnedNoProjectile = true;
                console.warn(
                    '[GameplayPoolService] không có đạn: PoolManager.poolArrays chưa có mục "projectile" '
                        + 'và projectilePrefab bỏ trống. Đòn bắn sẽ trừ máu thẳng, không có hình đạn bay.',
                );
            }
            GameplayLog.log('damage', 'đạn không tạo được -> trừ máu thẳng');
            DamageDealer.apply(target, damage, owner);
            return null;
        }

        const parent = this.spawnParent || this.node;
        node.setParent(parent);
        node.active = true;

        let projectile = node.getComponent(Projectile);
        if (!projectile) {
            projectile = node.addComponent(Projectile);
        }
        projectile.launch(owner, target, damage, hostileToPlayer, worldPos, parent, mode, arcHeight);
        return projectile;
    }

    public spawnCoin(worldPos: Vec3, value: number = 1): CoinPickup {
        const pool = PoolManager.instance;
        if (!pool) return null;

        const node = pool.GetNodeOfPool(TypeNodePool.coin);
        if (!node) return null;

        const parent = this.spawnParent || this.node;
        node.setParent(parent);
        node.active = true;
        node.setWorldPosition(worldPos);

        let coin = node.getComponent(CoinPickup);
        if (!coin) {
            coin = node.addComponent(CoinPickup);
        }
        coin.setup(value);
        return coin;
    }

    public spawnVfx(worldPos: Vec3): Node {
        const pool = PoolManager.instance;
        if (!pool) return null;

        const node = pool.GetNodeOfPool(TypeNodePool.vfxGameplay);
        if (!node) return null;

        const parent = this.spawnParent || this.node;
        node.setParent(parent);
        node.active = true;
        node.setWorldPosition(worldPos);

        const hasAuto =
            !!node.getComponent(AutoDestruction)?.isArmed ||
            !!node.getComponent(DestroyVFX)?.isArmed;
        if (!hasAuto) {
            this.scheduleOnce(() => {
                if (node && node.isValid) {
                    this.recycle(TypeNodePool.vfxGameplay, node);
                }
            }, this.vfxRecycleDelay);
        }

        return node;
    }

    public recycle(type: TypeNodePool, node: Node) {
        if (PoolManager.instance) {
            PoolManager.instance.PutNodeToPool(type, node);
        } else if (node) {
            node.active = false;
        }
    }
}

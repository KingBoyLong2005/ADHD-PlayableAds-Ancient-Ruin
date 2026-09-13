import { _decorator, CCFloat, CCInteger, Component, Enum, Node, Prefab, Vec3 } from 'cc';
import { AttackType } from '../Combat/AttackType';
import { EnemyType } from '../Enemy/EnemyType';
import { StatsProfile } from './StatsProfile';

const { ccclass, property } = _decorator;

@ccclass('EnemySpawnEntry')
export class EnemySpawnEntry {
    @property(Prefab)
    public prefab: Prefab = null;

    @property({ type: Enum(EnemyType) })
    public enemyType: EnemyType = EnemyType.None;

    @property({ type: Enum(AttackType) })
    public attackType: AttackType = AttackType.Melee;

    @property(CCInteger)
    public count: number = 1;

    @property(CCFloat)
    public spawnInterval: number = 1;

    @property(Node)
    public spawnPoint: Node = null;

    @property(Vec3)
    public spawnOffset: Vec3 = new Vec3();

    @property
    public overrideStats: boolean = false;

    @property({ type: StatsProfile })
    public stats: StatsProfile = new StatsProfile();
}

@ccclass('EnemySpawnConfig')
export class EnemySpawnConfig extends Component {
    @property([EnemySpawnEntry])
    public entries: EnemySpawnEntry[] = [];

    @property(CCFloat)
    public startDelay: number = 0.5;

    public get totalToSpawn(): number {
        let total = 0;
        for (let i = 0; i < this.entries.length; i++) {
            total += Math.max(0, this.entries[i].count);
        }
        return total;
    }
}

import { _decorator, CCFloat, Component, Enum } from 'cc';
import PoolManager, { TypeNodePool } from './Pool/PoolManager';

const { ccclass, property } = _decorator;

export enum AutoDestructionMode {

    Deactivate = 0,

    PutPool = 1,

    Destroy = 2,
}

@ccclass('AutoDestruction')
export class AutoDestruction extends Component {
    @property(CCFloat)
    timeDeactive: number = 0;

    @property({ type: Enum(AutoDestructionMode) })
    public mode: AutoDestructionMode = AutoDestructionMode.Deactivate;

    @property({ type: Enum(TypeNodePool), visible(this: AutoDestruction) { return this.mode === AutoDestructionMode.PutPool; } })
    public poolType: TypeNodePool = TypeNodePool.vfxGameplay;

    public get isArmed(): boolean {
        return this.timeDeactive > 0;
    }

    protected onEnable(): void {
        if (!this.isArmed) return;
        this.scheduleOnce(this.release, this.timeDeactive);
    }

    protected onDisable(): void {
        this.unschedule(this.release);
    }

    private release = () => {
        if (!this.node || !this.node.isValid) return;

        switch (this.mode) {
            case AutoDestructionMode.PutPool:
                if (PoolManager.instance) {
                    PoolManager.instance.PutNodeToPool(this.poolType, this.node);
                } else {
                    this.node.active = false;
                }
                break;
            case AutoDestructionMode.Destroy:
                this.node.destroy();
                break;
            default:
                this.node.active = false;
                break;
        }
    };
}

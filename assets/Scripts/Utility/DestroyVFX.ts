import { _decorator } from "cc";
import { Component } from "cc";
import { CCFloat } from "cc";
import { Enum } from "cc";
import PoolManager, { TypeNodePool } from "./Pool/PoolManager";

const { ccclass, property } = _decorator;
export enum TypeDestroy {
    Destroy = 0,
    PutPool = 1,
}
@ccclass('DestroyVFX')
export class DestroyVFX extends Component {
    @property({ type: Enum(TypeDestroy) })
    public typeDestroy: TypeDestroy = TypeDestroy.Destroy;

    @property({ type: Enum(TypeNodePool), visible(this: DestroyVFX) { return this.typeDestroy === TypeDestroy.PutPool; } })
    public poolType: TypeNodePool = TypeNodePool.vfxGameplay;

    @property(CCFloat)
    timming: number = 1;

    public get isArmed(): boolean {
        return this.timming > 0;
    }

    protected onEnable(): void {
        if (!this.isArmed) return;
        this.scheduleOnce(this.release, this.timming);
    }

    protected onDisable(): void {
        this.unschedule(this.release);
    }

    private release = () => {
        if (!this.node || !this.node.isValid) return;

        if (this.typeDestroy === TypeDestroy.PutPool) {
            if (PoolManager.instance) {
                PoolManager.instance.PutNodeToPool(this.poolType, this.node);
            } else {
                this.node.active = false;
            }
            return;
        }
        this.node.destroy();
    };
}

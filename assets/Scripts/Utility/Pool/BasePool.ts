import { _decorator, CCInteger, instantiate, Node, NodePool, Prefab } from "cc";

const { ccclass, property } = _decorator;

@ccclass("BasePool")
export default class BasePool {
    private pool: NodePool;
    @property(Prefab)
    private Prefab: Prefab = null;
    @property
    public reuse: boolean = true;
    @property(CCInteger)
    public Size: number = 0;

    constructor() {
        this.pool = new NodePool();

    }
    GetObject(): Node {
        if (this.reuse) {
            let obj: Node = null;
            if (this.pool.size() > 0) {
                obj = this.pool.get();
                obj.active = true;
            } else {
                obj = instantiate(this.Prefab);
            }
            return obj;
        } else {
            let obj: Node = instantiate(this.Prefab);
            return obj;
        }
    }
    PutObject(obj: Node) {
        if (this.reuse) {
            obj.active = false;
            this.pool.put(obj);
        } else {
            obj.destroy();
        }
    }
    ClearPool() {
        this.pool.clear();
    }

}

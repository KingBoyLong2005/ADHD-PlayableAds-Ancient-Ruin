import { _decorator, Component, Node } from 'cc';

const { ccclass, property } = _decorator;

@ccclass('RoomDecor')
export class RoomDecor extends Component {
    @property
    public displayName: string = '';

    @property({ type: Node })
    public art: Node = null;

    @property({ type: Node })
    public obstacles: Node = null;

    public get visual(): Node {
        return this.art || this.node;
    }

    public setActive(on: boolean) {
        if (this.node.isValid) this.node.active = on;
    }
}

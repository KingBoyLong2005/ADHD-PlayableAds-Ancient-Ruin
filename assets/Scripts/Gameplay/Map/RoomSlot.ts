import { _decorator, Component, Node } from 'cc';
import { RoomDecor } from './RoomDecor';

const { ccclass, property } = _decorator;

@ccclass('RoomSlot')
export class RoomSlot extends Component {
    @property({ type: Node })
    public floor: Node = null;

    @property({ type: Node })
    public walls: Node = null;

    @property({ type: [RoomDecor] })
    public decors: RoomDecor[] = [];

    @property({ type: Node })
    public heroStart: Node = null;

    @property({ type: Node })
    public cameraAnchor: Node = null;

    public activateDecor(index: number): RoomDecor {
        let picked: RoomDecor = null;
        for (let i = 0; i < this.decors.length; i++) {
            const dec = this.decors[i];
            if (!dec) continue;
            const on = i === index;
            dec.setActive(on);
            if (on) picked = dec;
        }
        return picked;
    }
}

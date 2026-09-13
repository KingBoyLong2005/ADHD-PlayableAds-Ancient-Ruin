

import Global from "./Global";

import { _decorator, Component, Input, } from 'cc';
const { ccclass, property } = _decorator;

@ccclass
export default class CanvasTouch extends Component {

    protected start(): void {
        this.node.on(Input.EventType.TOUCH_START, this.TouchStart, this);
        this.node.on(Input.EventType.TOUCH_MOVE, this.TouchMove, this);
        this.node.on(Input.EventType.TOUCH_END, this.TouchEnd, this);
        this.node.on(Input.EventType.TOUCH_CANCEL, this.TouchEnd, this);
    }
    TouchStart(event:TouchEvent) {}
    TouchMove(event) {}
    TouchEnd(event) {}
}

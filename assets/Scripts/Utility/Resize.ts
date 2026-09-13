import { _decorator, Camera, CCFloat, Component, log, macro, Node, screen, Size, view } from 'cc';
import Global from './Global';
const { ccclass, property } = _decorator;

@ccclass('Resize')
export class Resize extends Component {

    @property(Node)
    landScapeNode: Node = null;
    @property(Node)
    portraitNode: Node = null;
    onLoad() {

        screen.on('window-resize', this.onWindowResize, this);
        screen.on('orientation-change', this.onOrientationChange, this);
        screen.on('fullscreen-change', this.onFullScreenChange, this);

        const { width, height } = screen.windowSize;
        this.resize(new Size(width / 2, height / 2));
        if (Global.video) {
            this.node.active = false;
        }
    }

    onDestroy() {

        screen.off('window-resize', this.onWindowResize, this);
        screen.off('orientation-change', this.onOrientationChange, this);
        screen.off('fullscreen-change', this.onFullScreenChange, this);
    }
    onWindowResize(width: number, height: number) {
        this.resize(new Size(width / 2, height / 2));
    }

    onOrientationChange(orientation: number) {
        if (orientation === macro.ORIENTATION_LANDSCAPE_LEFT || orientation === macro.ORIENTATION_LANDSCAPE_RIGHT) {

        } else {

        }
    }

    onFullScreenChange(width: number, height: number) {

        this.resize(new Size(width / 2, height / 2));
    }
    resize(size: Size) {

        if (size.width / size.height > 1.5) {
            this.landScapeNode.active = true;
            this.portraitNode.active = false;
        }
        else {
            this.landScapeNode.active = false;
            this.portraitNode.active = true;
        }

    }
}

import { _decorator, Camera, Component, Game, game, Node, Vec3, view } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('PerspectiveCamera')
export class PerspectiveCamera extends Component {

    @property(Camera)
    camera: Camera = null;

    @property(Node)
    levelPlay: Node = null;

    start() {
        this.adjustFOV();
        window.addEventListener('resize', this.adjustFOV);
    }

    onDestroy() {
        window.removeEventListener('resize', this.adjustFOV);
    }

    adjustFOV = () => {
        const size = view.getVisibleSize();
        const aspect = size.width / size.height;

        const isLandscape = aspect > 1.0;
        const targetFOV = isLandscape ? 90 : 85;

        if (this.camera?.camera) {
            this.camera.fov = targetFOV;
        }
    }
}


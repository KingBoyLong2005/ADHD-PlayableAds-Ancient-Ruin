import {
    _decorator, BlockInputEvents, Canvas, CCFloat, CCInteger, Color, Component, Font,
    Graphics, Label, Node, Tween, tween, UIOpacity, UITransform, Vec3,
} from 'cc';
import EventManager from '../../Utility/EventManager';
import { GameplayLog } from '../Debug/GameplayLog';
import { GameplayEvents } from '../Events/GameplayEvents';
import { GameManager } from '../Managers/GameManager';

const { ccclass, property } = _decorator;

@ccclass('MapIntroUI')
export class MapIntroUI extends Component {
    public static instance: MapIntroUI = null;

    @property
    public mapName: string = 'Ancient Ruin';

    @property
    public overline: string = '';

    @property({ type: Node })
    public introNode: Node = null;

    @property({ type: Label })
    public nameLabel: Label = null;

    @property({ type: CCFloat })
    public fadeInTime: number = 0.35;

    @property({ type: CCFloat })
    public holdTime: number = 1;

    @property({ type: CCFloat })
    public fadeOutTime: number = 0.45;

    @property({ type: CCInteger, range: [0, 255, 1] })
    public backgroundOpacity: number = 255;

    @property
    public backgroundColor: Color = new Color(6, 8, 14, 255);

    @property
    public textColor: Color = new Color(236, 226, 200, 255);

    @property({ type: Font })
    public font: Font = null;

    @property({ type: CCInteger })
    public fontSize: number = 120;

    @property({ type: CCFloat })
    public startScale: number = 1.12;

    @property
    public showRules: boolean = true;

    @property
    public pauseGameWhileShown: boolean = true;

    private _root: Node = null;
    private _rootOpacity: UIOpacity = null;
    private _titleNode: Node = null;
    private _titleOpacity: UIOpacity = null;

    private _ownsNode: boolean = false;
    private _playing: boolean = false;
    private _done: boolean = false;

    public get isDone(): boolean {
        return this._done;
    }

    onLoad() {
        MapIntroUI.instance = this;

        const root = this.resolveIntro();
        if (root) root.active = true;

        if (this.pauseGameWhileShown) {
            EventManager.instance.on(GameplayEvents.GameResumed, this.holdGame, this);
        }
    }

    start() {
        this.play();
    }

    onDestroy() {
        this.stopTweens();
        EventManager.instance.off(GameplayEvents.GameResumed, this.holdGame, this);
        if (MapIntroUI.instance === this) MapIntroUI.instance = null;
    }

    public play() {
        if (this._playing || this._done) return;

        const root = this.resolveIntro();
        if (!root) {
            GameplayLog.log('intro', 'không dựng được màn giới thiệu — bỏ qua');
            this.finish();
            return;
        }

        this._playing = true;
        root.active = true;
        if (this._rootOpacity) this._rootOpacity.opacity = 255;
        this.holdGame();

        const fadeIn = Math.max(this.fadeInTime, 0);
        if (this._titleOpacity) {
            this._titleOpacity.opacity = 0;
            tween(this._titleOpacity).to(fadeIn, { opacity: 255 }).start();
        }
        if (this._titleNode) {
            const from = this.startScale > 0 ? this.startScale : 1;
            this._titleNode.setScale(from, from, 1);
            tween(this._titleNode)
                .to(fadeIn + 0.3, { scale: new Vec3(1, 1, 1) }, { easing: 'cubicOut' })
                .start();
        }

        GameplayLog.log('intro', `giới thiệu map "${this.mapName}"`);
        this.scheduleOnce(this.fadeOut, fadeIn + Math.max(this.holdTime, 0));
    }

    private fadeOut() {
        if (!this._rootOpacity || this.fadeOutTime <= 0) {
            this.finish();
            return;
        }
        tween(this._rootOpacity).to(this.fadeOutTime, { opacity: 0 }).call(() => this.finish()).start();
    }

    private finish() {
        if (this._done) return;
        this._done = true;
        this._playing = false;

        this.stopTweens();
        if (this._root && this._root.isValid) {

            if (this._ownsNode) {
                this._root.destroy();
            } else {
                this._root.active = false;
            }
        }
        this._root = null;
        this._rootOpacity = null;
        this._titleNode = null;
        this._titleOpacity = null;

        EventManager.instance.off(GameplayEvents.GameResumed, this.holdGame, this);
        if (this.pauseGameWhileShown) GameManager.instance?.resumeGame();

        EventManager.instance.emit(GameplayEvents.MapIntroFinished, this.mapName);
        GameplayLog.log('intro', 'giới thiệu xong — trả màn hình lại cho màn chọn hero');
    }

    private holdGame() {
        if (this._done || !this.pauseGameWhileShown) return;
        GameManager.instance?.pauseGame();
    }

    private stopTweens() {
        if (this._rootOpacity) Tween.stopAllByTarget(this._rootOpacity);
        if (this._titleOpacity) Tween.stopAllByTarget(this._titleOpacity);
        if (this._titleNode && this._titleNode.isValid) Tween.stopAllByTarget(this._titleNode);
    }

    private clampOpacity(value: number): number {
        return Math.min(Math.max(Math.round(value), 0), 255);
    }

    private resolveIntro(): Node {
        if (this._root && this._root.isValid) return this._root;

        if (this.introNode && this.introNode.isValid) {
            this._root = this.introNode;
            this._ownsNode = false;
            this.prepareSceneNode(this._root);
            return this._root;
        }

        this._root = this.build();
        this._ownsNode = !!this._root;
        return this._root;
    }

    private prepareSceneNode(root: Node) {
        const label = this.nameLabel || root.getComponentInChildren(Label);
        if (label) {
            label.string = this.mapName;
            this.nameLabel = label;
            this._titleNode = label.node;
            this._titleOpacity = label.node.getComponent(UIOpacity) || label.node.addComponent(UIOpacity);
            this._titleOpacity.opacity = 0;
        }
        this._rootOpacity = root.getComponent(UIOpacity) || root.addComponent(UIOpacity);
        if (!root.getComponent(BlockInputEvents)) root.addComponent(BlockInputEvents);
    }

    private build(): Node {
        const canvas = this.resolveCanvas();
        if (!canvas) {
            GameplayLog.log('intro', 'không thấy Canvas — không dựng được màn giới thiệu');
            return null;
        }
        const canvasTransform = canvas.getComponent(UITransform);
        const width = canvasTransform?.width || 1080;
        const height = canvasTransform?.height || 1920;

        const root = new Node('MapIntro');
        root.layer = canvas.layer;
        root.active = false;

        root.setParent(canvas);
        root.setPosition(0, 0, 0);
        root.addComponent(UITransform).setContentSize(width, height);
        this._rootOpacity = root.addComponent(UIOpacity);
        root.addComponent(BlockInputEvents);

        this.buildBackdrop(root, width, height);
        this._titleNode = this.buildTitle(root, width);
        return root;
    }

    private buildBackdrop(root: Node, width: number, height: number) {
        const node = new Node('Backdrop');
        node.layer = root.layer;
        node.setParent(root);
        node.setPosition(0, 0, 0);
        node.addComponent(UITransform).setContentSize(width, height);

        node.addComponent(UIOpacity).opacity = this.clampOpacity(this.backgroundOpacity);

        const g = node.addComponent(Graphics);
        g.fillColor = new Color(this.backgroundColor.r, this.backgroundColor.g, this.backgroundColor.b, 255);

        g.rect(-width, -height, width * 2, height * 2);
        g.fill();
    }

    private buildTitle(root: Node, width: number): Node {
        const title = new Node('Title');
        title.layer = root.layer;
        title.setParent(root);
        title.setPosition(0, 0, 0);
        title.addComponent(UITransform).setContentSize(width, this.fontSize * 3);
        this._titleOpacity = title.addComponent(UIOpacity);

        this._titleOpacity.opacity = 0;
        const from = this.startScale > 0 ? this.startScale : 1;
        title.setScale(from, from, 1);

        const lineHeight = Math.round(this.fontSize * 1.15);
        if (this.showRules) this.buildRules(title, width, lineHeight);

        if (this.overline) {
            const over = this.makeLabel(title, this.overline, Math.max(Math.round(this.fontSize * 0.3), 12));
            over.node.setPosition(0, lineHeight, 0);
            over.color = new Color(this.textColor.r, this.textColor.g, this.textColor.b, 170);
            over.spacingX = Math.round(this.fontSize * 0.08);
        }

        this.nameLabel = this.makeLabel(title, this.mapName, this.fontSize);
        return title;
    }

    private buildRules(title: Node, width: number, lineHeight: number) {
        const node = new Node('Rules');
        node.layer = title.layer;
        node.setParent(title);
        node.setPosition(0, 0, 0);
        node.addComponent(UITransform).setContentSize(width, lineHeight * 2);

        const half = Math.round(width * 0.33);
        const y = Math.round(lineHeight * 0.62);
        const g = node.addComponent(Graphics);
        g.lineWidth = 4;
        g.strokeColor = new Color(this.textColor.r, this.textColor.g, this.textColor.b, 140);
        g.moveTo(-half, y);
        g.lineTo(half, y);
        g.moveTo(-half, -y);
        g.lineTo(half, -y);
        g.stroke();
    }

    private makeLabel(parent: Node, text: string, fontSize: number): Label {
        const node = new Node('Label');
        node.layer = parent.layer;
        node.setParent(parent);
        node.setPosition(0, 0, 0);

        const width = parent.getComponent(UITransform)?.width || 1080;
        node.addComponent(UITransform).setContentSize(width, Math.round(fontSize * 1.4));

        const label = node.addComponent(Label);
        label.string = text;
        if (this.font) {
            label.font = this.font;
            label.useSystemFont = false;
        }
        label.fontSize = fontSize;
        label.lineHeight = Math.round(fontSize * 1.2);
        label.isBold = true;
        label.overflow = Label.Overflow.NONE;
        label.enableWrapText = false;
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        label.color = this.textColor;

        label.enableOutline = true;
        label.outlineColor = new Color(0, 0, 0, 255);
        label.outlineWidth = Math.max(3, Math.round(fontSize * 0.05));
        return label;
    }

    private resolveCanvas(): Node {
        let node: Node = this.node;
        while (node) {
            if (node.getComponent(Canvas)) return node;
            node = node.parent;
        }
        return this.node;
    }
}

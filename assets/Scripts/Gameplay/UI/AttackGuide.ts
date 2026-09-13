import { _decorator, Animation, CCFloat, Color, Component, director, find, Label, Node, UIOpacity, UITransform, Vec3 } from 'cc';
import EventManager from '../../Utility/EventManager';
import { GameplayLog } from '../Debug/GameplayLog';
import { GameplayEvents } from '../Events/GameplayEvents';
import { GameManager, GameState } from '../Managers/GameManager';
import { PlayerCombat } from '../Player/PlayerCombat';
import { PlayerController } from '../Player/PlayerController';

const { ccclass, property } = _decorator;

@ccclass('AttackGuide')
export class AttackGuide extends Component {
    @property({ type: Node })
    public guideNode: Node = null;

    @property({ type: PlayerCombat })
    public combat: PlayerCombat = null;

    @property({ type: CCFloat })
    public holdDelay: number = 0.7;

    @property({ type: CCFloat })
    public minShowTime: number = 1.2;

    @property({ type: CCFloat })
    public maxShows: number = 3;

    @property
    public message: string = 'Release to attack!';

    @property({ type: CCFloat })
    public fallbackY: number = -560;

    private _hold: number = 0;

    private _linger: number = 0;
    private _shown: boolean = false;
    private _shows: number = 0;

    private _stopped: boolean = false;

    private _ownsNode: boolean = false;
    private _pulse: number = 0;
    private _warnedNoCombat: boolean = false;

    onLoad() {

        EventManager.instance.on(GameplayEvents.GameWin, this.stop, this);
        EventManager.instance.on(GameplayEvents.GameLose, this.stop, this);
        EventManager.instance.on(GameplayEvents.PlayerDied, this.stop, this);
        EventManager.instance.on(GameplayEvents.AllHeroesDied, this.stop, this);
    }

    start() {
        this.resolveGuide();
        this.hideGuide();
    }

    onDestroy() {
        EventManager.instance.off(GameplayEvents.GameWin, this.stop, this);
        EventManager.instance.off(GameplayEvents.GameLose, this.stop, this);
        EventManager.instance.off(GameplayEvents.PlayerDied, this.stop, this);
        EventManager.instance.off(GameplayEvents.AllHeroesDied, this.stop, this);
    }

    update(dt: number) {

        if (this.isGameOver()) {
            this.stop();
            return;
        }
        if (this._stopped) return;

        if (GameManager.instance?.isPaused || GameManager.instance?.inputLocked) {
            this.hideGuide();
            return;
        }

        if (this._shown) this.pulse(dt);

        if (this.resolveCombat()?.holdingBackAttack) {
            this._hold += dt;
            if (!this._shown && this.canShow() && this._hold >= this.holdDelay) this.showGuide();
            return;
        }

        this._hold = 0;
        if (!this._shown) return;
        this._linger -= dt;
        if (this._linger <= 0) this.hideGuide();
    }

    public showGuide() {
        if (this._stopped) return;
        const node = this.resolveGuide();
        if (!node) return;

        this._shown = true;
        this._shows += 1;
        this._linger = this.minShowTime;
        this._pulse = 0;
        node.active = true;

        const anim = node.getComponent(Animation);
        if (anim && anim.defaultClip) anim.play();
        GameplayLog.log('guide', `nhắc thả tay để đánh (lần ${this._shows})`);
    }

    public hideGuide() {
        this._shown = false;
        this._linger = 0;
        const node = this.guideNode;
        if (!node || !node.isValid) return;
        if (node.active) node.active = false;
    }

    public stop() {
        this._stopped = true;
        this.hideGuide();
    }

    private canShow(): boolean {
        return this.maxShows <= 0 || this._shows < this.maxShows;
    }

    private isGameOver(): boolean {
        const gm = GameManager.instance;
        return !!gm && (gm.state === GameState.Lose || gm.state === GameState.Win);
    }

    private pulse(dt: number) {
        if (!this._ownsNode) return;
        const op = this.guideNode?.getComponent(UIOpacity);
        if (!op) return;
        this._pulse += dt * 4;
        op.opacity = 190 + Math.round(Math.sin(this._pulse) * 65);
    }

    private resolveCombat(): PlayerCombat {
        if (this.combat && this.combat.isValid) return this.combat;
        const pc = PlayerController.instance;
        this.combat = pc && pc.isValid ? pc.getComponent(PlayerCombat) : null;
        if (!this.combat && !this._warnedNoCombat) {
            this._warnedNoCombat = true;
            GameplayLog.log('guide', 'chưa thấy PlayerCombat — chưa nhắc được chuyện thả tay để đánh');
        }
        return this.combat;
    }

    private resolveGuide(): Node {
        if (this.guideNode && this.guideNode.isValid) return this.guideNode;

        this.guideNode = find('Canvas/GuideAttack') || this.findByName(director.getScene(), 'GuideAttack');
        if (this.guideNode) return this.guideNode;
        this.guideNode = this.buildFallback();
        this._ownsNode = !!this.guideNode;
        return this.guideNode;
    }

    private buildFallback(): Node {
        const canvas = find('Canvas');
        if (!canvas) {
            GameplayLog.log('guide', 'không thấy Canvas — không dựng được dòng nhắc thả tay');
            return null;
        }

        const node = new Node('GuideAttack');
        node.layer = canvas.layer;
        node.setParent(canvas);
        node.setPosition(new Vec3(0, this.fallbackY, 0));

        const tr = node.addComponent(UITransform);
        tr.setContentSize(canvas.getComponent(UITransform)?.width || 1080, 80);

        const label = node.addComponent(Label);
        label.string = this.message;
        label.fontSize = 46;
        label.lineHeight = 56;
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        label.color = Color.WHITE;

        label.enableOutline = true;
        label.outlineColor = new Color(0, 0, 0, 255);
        label.outlineWidth = 4;

        node.addComponent(UIOpacity);
        node.active = false;
        return node;
    }

    private findByName(root: Node, name: string): Node {
        if (!root) return null;
        const children = root.children;
        for (let i = 0; i < children.length; i++) {
            const child = children[i];
            if (child.name === name) return child;
            const found = this.findByName(child, name);
            if (found) return found;
        }
        return null;
    }
}

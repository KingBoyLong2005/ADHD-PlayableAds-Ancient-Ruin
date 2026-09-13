import { _decorator, Button, CCFloat, Component, Label, Node, SpriteFrame, Tween, tween, UIOpacity, Vec3 } from 'cc';
import { SkillDefinition } from '../../Skills/SkillDefinition';
import { SkillReelView } from './SkillReelView';

const { ccclass, property } = _decorator;

@ccclass('SkillCardView')
export class SkillCardView extends Component {
    @property(SkillReelView)
    public reel: SkillReelView = null;

    @property({ type: Node })
    public iconRoot: Node = null;

    @property({ type: Node })
    public iconGlow: Node = null;

    @property({ type: Node })
    public star: Node = null;

    @property({ type: Node })
    public panel: Node = null;

    @property({ type: Label })
    public nameLabel: Label = null;

    @property({ type: Label })
    public panelNameLabel: Label = null;

    @property({ type: Label })
    public panelDescLabel: Label = null;

    @property({ type: Node })
    public levelRoot: Node = null;

    @property({ type: Label })
    public levelLabel: Label = null;

    @property({ type: [Node] })
    public panelGlows: Node[] = [];

    @property(Button)
    public button: Button = null;

    @property
    public showPanelOnReveal: boolean = false;

    @property
    public showLevelOnReveal: boolean = true;

    @property({ type: CCFloat })
    public revealPunch: number = 1.18;

    @property({ type: [Node] })
    public tintTargets: Node[] = [];

    public level: number = 1;

    private _skill: SkillDefinition = null;
    private _settled: boolean = false;

    private _selectable: boolean = false;
    private _onSelect: (skill: SkillDefinition, card: SkillCardView) => void = null;

    public get skill(): SkillDefinition {
        return this._skill;
    }

    public get isSettled(): boolean {
        return this._settled;
    }

    onLoad() {
        if (!this.button) this.button = this.getComponent(Button);
        if (this.button) this.button.node.on(Button.EventType.CLICK, this.onClick, this);
        if (this.reel) this.reel.onStopped = () => this.onReelStopped();
    }

    onDestroy() {
        if (this.button) this.button.node.off(Button.EventType.CLICK, this.onClick, this);

        if (this.reel) this.reel.onStopped = null;
        this._onSelect = null;
    }

    public setSelectHandler(cb: (skill: SkillDefinition, card: SkillCardView) => void) {
        this._onSelect = cb;
    }

    public setSelectable(value: boolean, dimButton: boolean = false) {
        this._selectable = value;
        if (dimButton && this.button) this.button.interactable = value;
    }

    public setSpinPool(icons: SpriteFrame[]) {
        if (this.reel) this.reel.setPool(icons);
    }

    public beginSpin() {
        this._settled = false;
        this._selectable = false;
        this._skill = null;

        if (this.iconRoot) Tween.stopAllByTarget(this.iconRoot);
        if (this.star) Tween.stopAllByTarget(this.star);
        const glow = this.getGlowOpacity();
        if (glow) Tween.stopAllByTarget(glow);
        for (const n of this.panelGlows) {
            const op = n && n.getComponent(UIOpacity);
            if (!op) continue;
            Tween.stopAllByTarget(op);
            op.opacity = 0;
        }
        if (this.nameLabel) this.nameLabel.node.active = false;
        if (this.panel) this.panel.active = false;
        if (this.levelRoot) this.levelRoot.active = false;
        if (this.iconRoot) this.iconRoot.setScale(Vec3.ONE);
        this.setGlowOpacity(0);
        if (this.reel) this.reel.startSpin();
    }

    public settle(skill: SkillDefinition, icon: SpriteFrame, duration: number) {
        this._skill = skill;
        if (!this.reel) {
            this.onReelStopped();
            return;
        }
        this.reel.stopAt(icon, duration);
    }

    public snap(skill: SkillDefinition, icon: SpriteFrame) {
        this._skill = skill;
        if (this.reel) this.reel.snapTo(icon);
        this.onReelStopped();
    }

    private onReelStopped() {
        this._settled = true;
        const skill = this._skill;

        if (this.nameLabel) {
            this.nameLabel.string = skill ? skill.displayName || skill.id : '';

            this.nameLabel.node.active = !!skill && !this.showPanelOnReveal;
        }
        if (this.panelNameLabel) this.panelNameLabel.string = skill ? skill.displayName || skill.id : '';
        if (this.panelDescLabel) this.panelDescLabel.string = skill ? skill.description || '' : '';
        if (this.panel && this.showPanelOnReveal) this.panel.active = !!skill;
        if (this.levelRoot) this.levelRoot.active = !!skill && this.showLevelOnReveal;
        if (this.levelLabel) this.levelLabel.string = String(this.level);

        this.playRevealFx();
    }

    private playRevealFx() {
        if (this.iconRoot) {
            const s = this.revealPunch;
            tween(this.iconRoot)
                .to(0.08, { scale: new Vec3(s, s, 1) })
                .to(0.16, { scale: Vec3.ONE }, { easing: 'backOut' })
                .start();
        }

        const opacity = this.getGlowOpacity();
        if (opacity) {
            tween(opacity).to(0.08, { opacity: 255 }).to(0.35, { opacity: 90 }).start();
        }

        if (this.star) {
            this.star.setScale(0.2, 0.2, 1);
            tween(this.star).to(0.3, { scale: new Vec3(0.5, 0.5, 1) }, { easing: 'backOut' }).start();
        }

        for (const node of this.panelGlows) {
            const op = node && node.getComponent(UIOpacity);
            if (!op) continue;
            op.opacity = 0;
            tween(op).to(0.12, { opacity: 170 }).to(0.4, { opacity: 0 }).start();
        }
    }

    private getGlowOpacity(): UIOpacity {
        if (!this.iconGlow) return null;
        return this.iconGlow.getComponent(UIOpacity) || this.iconGlow.addComponent(UIOpacity);
    }

    private setGlowOpacity(value: number) {
        const op = this.getGlowOpacity();
        if (op) op.opacity = value;
    }

    private onClick() {
        if (!this._settled || !this._selectable || !this._skill) return;
        if (this._onSelect) this._onSelect(this._skill, this);
    }
}

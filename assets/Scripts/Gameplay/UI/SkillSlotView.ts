import { _decorator, Button, Component, Label, Node } from 'cc';
import { SkillDefinition } from '../Skills/SkillDefinition';
import { getSkillEffectCategory, SkillType } from '../Skills/SkillType';

const { ccclass, property } = _decorator;

@ccclass('SkillSlotView')
export class SkillSlotView extends Component {
    @property(Label)
    public titleLabel: Label = null;

    @property(Label)
    public descLabel: Label = null;

    @property(Label)
    public typeLabel: Label = null;

    @property(Button)
    public button: Button = null;

    @property(Node)
    public contentRoot: Node = null;

    private _skill: SkillDefinition = null;
    private _onSelect: (skill: SkillDefinition) => void = null;

    onLoad() {
        if (!this.button) this.button = this.getComponent(Button);
        if (this.button) {
            this.button.node.on(Button.EventType.CLICK, this.onClick, this);
        }
    }

    onDestroy() {
        if (this.button) {
            this.button.node.off(Button.EventType.CLICK, this.onClick, this);
        }
    }

    public bind(skill: SkillDefinition, onSelect: (skill: SkillDefinition) => void) {
        this._skill = skill;
        this._onSelect = onSelect;
        this.node.active = !!skill;

        if (!skill) return;

        if (this.contentRoot) this.contentRoot.active = true;
        if (this.titleLabel) this.titleLabel.string = skill.displayName || skill.id;
        if (this.descLabel) this.descLabel.string = skill.description || '';
        if (this.typeLabel) {
            if (skill.effectKind) {
                this.typeLabel.string = getSkillEffectCategory(skill.effectKind);
            } else {
                this.typeLabel.string = skill.skillType === SkillType.StatBuff ? 'BUFF' : 'ATTACK';
            }
        }
    }

    public clear() {
        this._skill = null;
        this._onSelect = null;
        if (this.titleLabel) this.titleLabel.string = '';
        if (this.descLabel) this.descLabel.string = '';
        if (this.typeLabel) this.typeLabel.string = '';
        this.node.active = false;
    }

    private onClick() {
        if (this._skill && this._onSelect) {
            this._onSelect(this._skill);
        }
    }
}

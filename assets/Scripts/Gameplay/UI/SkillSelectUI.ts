import { _decorator, Button, Component, instantiate, Label, Node, Prefab } from 'cc';
import { SoundManager } from '../../Utility/SoundManager';
import { GameplayLog } from '../Debug/GameplayLog';
import { SkillDefinition } from '../Skills/SkillDefinition';
import { SkillSlotView } from './SkillSlotView';

const { ccclass, property } = _decorator;

@ccclass('SkillSelectUI')
export class SkillSelectUI extends Component {
    @property(Node)
    public panel: Node = null;

    @property([SkillSlotView])
    public slots: SkillSlotView[] = [];

    @property(Prefab)
    public skillSlotPrefab: Prefab = null;

    @property(Node)
    public slotContainer: Node = null;

    @property(Button)
    public rerollButton: Button = null;

    @property(Label)
    public rerollCostLabel: Label = null;

    @property
    public rerollCostText: string = 'x1';

    @property(Label)
    public heroNameLabel: Label = null;

    private _onChosen: (skill: SkillDefinition) => void = null;
    private _onReroll: () => void = null;
    private _currentSkills: SkillDefinition[] = [];

    onLoad() {
        if (this.rerollCostLabel) {
            this.rerollCostLabel.string = this.rerollCostText;
        }
        this.hide();
    }

    onEnable() {
        if (this.rerollButton) {
            this.rerollButton.node.on(Button.EventType.CLICK, this.onRerollClick, this);
        }
    }

    onDisable() {
        if (this.rerollButton) {
            this.rerollButton.node.off(Button.EventType.CLICK, this.onRerollClick, this);
        }
    }

    public get canDisplay(): boolean {
        if (this.slots && this.slots.length > 0) return true;
        return !!(this.skillSlotPrefab && this.slotContainer);
    }

    public showChoices(
        skills: SkillDefinition[],
        onChosen: (skill: SkillDefinition) => void,
        onReroll: () => void = null,
        heroName: string = '',
    ) {
        this._onChosen = onChosen;
        this._onReroll = onReroll;
        GameplayLog.log(
            'skillui',
            `BẬT panel skill: ${skills ? skills.length : 0} lựa chọn, hero=${heroName || '?'}, `
                + `dựng được ô=${this.canDisplay}`,
        );
        if (this.panel) this.panel.active = true;
        this.node.active = true;
        if (this.rerollButton) this.rerollButton.node.active = true;
        if (this.rerollCostLabel) this.rerollCostLabel.string = this.rerollCostText;
        if (this.heroNameLabel) {
            this.heroNameLabel.string = heroName || '';
            this.heroNameLabel.node.active = !!heroName;
        }
        this.refreshChoices(skills);
    }

    public refreshChoices(skills: SkillDefinition[]) {
        this._currentSkills = skills ? skills.slice() : [];
        this.ensureSlots(this._currentSkills.length);
        for (let i = 0; i < this.slots.length; i++) {
            const slot = this.slots[i];
            if (!slot) continue;
            if (i < this._currentSkills.length) {
                slot.bind(this._currentSkills[i], (skill) => this.choose(skill));
            } else {
                slot.clear();
            }
        }
    }

    public getCurrentSkillIds(): string[] {
        return this._currentSkills.map((s) => s.id).filter((id) => !!id);
    }

    public hide() {
        if (this.panel) this.panel.active = false;
        this.node.active = false;
        this._onChosen = null;
        this._onReroll = null;
        this._currentSkills = [];
    }

    private choose(skill: SkillDefinition) {
        const cb = this._onChosen;
        if (cb) cb(skill);
    }

    private onRerollClick() {
        if (this._onReroll) {
            SoundManager.instance?.playButtonClick();
            this._onReroll();
        }
    }

    private ensureSlots(count: number) {
        if (this.slots.length >= count) return;
        if (!this.skillSlotPrefab || !this.slotContainer) return;

        while (this.slots.length < count) {
            const node = instantiate(this.skillSlotPrefab);
            node.setParent(this.slotContainer);
            let view = node.getComponent(SkillSlotView);
            if (!view) view = node.addComponent(SkillSlotView);
            this.slots.push(view);
        }
    }

}

import { _decorator, Component } from 'cc';
import { HeroClass } from '../Hero/HeroClass';
import { SkillDefinition } from './SkillDefinition';
import { describeStatEffect, SkillEffectKind, SkillType } from './SkillType';

const { ccclass, property } = _decorator;

@ccclass('SkillCatalog')
export class SkillCatalog extends Component {
    @property([SkillDefinition])
    public skills: SkillDefinition[] = [];

    onLoad() {
        if (!this.skills || this.skills.length === 0) {
            this.skills = SkillCatalog.createDefaultSkills();
        }
    }

    public getAll(): SkillDefinition[] {
        return this.skills || [];
    }

    public static createDefaultSkills(): SkillDefinition[] {
        const make = (
            id: string,
            name: string,
            effectKind: SkillEffectKind,
            value: number,
            allowedClasses: HeroClass = HeroClass.All,
            skillType: SkillType = SkillType.StatBuff,
        ) => {
            const s = new SkillDefinition();
            s.id = id;
            s.displayName = name;
            s.description = describeStatEffect(effectKind, value);
            s.effectKind = effectKind;
            s.skillType = skillType;
            s.value = value;
            s.value2 = 0;
            s.allowedClasses = allowedClasses;
            return s;
        };

        return [

            make('healing_potion', 'Healing Potion', SkillEffectKind.InstantHealPct, 0.15, HeroClass.All, SkillType.Instant),

            make('arhmage', 'Archmage', SkillEffectKind.StatPctDamage, 0.12, HeroClass.Mage),
            make('blizzard', 'Blizzard', SkillEffectKind.StatPctAttackSpeed, 0.1, HeroClass.Mage),
            make('chain_lightning', 'Chain Lightning', SkillEffectKind.StatCritChance, 0.1, HeroClass.Mage),
            make('fireball', 'Fireball', SkillEffectKind.StatCritDamage, 0.25, HeroClass.Mage),
            make('fire_bolt', 'Fire Bolt', SkillEffectKind.StatPctAttackRange, 0.15, HeroClass.Mage),

            make('beastslayer', 'Beast Slayer', SkillEffectKind.StatPctDamage, 0.1, HeroClass.Ranger),
            make('camouflage', 'Camouflage', SkillEffectKind.StatPctMoveSpeed, 0.2, HeroClass.Ranger),
            make('catgrace', 'Cat Grace', SkillEffectKind.StatPctAttackSpeed, 0.12, HeroClass.Ranger),
            make('deathblow', 'Death Blow', SkillEffectKind.StatCritDamage, 0.3, HeroClass.Ranger),
            make('dex_lv1', 'Dex Lv1', SkillEffectKind.StatCritChance, 0.08, HeroClass.Ranger),

            make('adrenaline', 'Adrenaline', SkillEffectKind.StatLifesteal, 0.08, HeroClass.Warrior),
            make('battlemaster', 'Battle Master', SkillEffectKind.StatPctDamage, 0.1, HeroClass.Warrior),
            make('berserker', 'Berserker', SkillEffectKind.StatPctAttackSpeed, 0.15, HeroClass.Warrior),
            make('blunt_mastery', 'Blunt Mastery', SkillEffectKind.StatCritChance, 0.1, HeroClass.Warrior),
            make('braveheart', 'Brave Heart', SkillEffectKind.StatPctMaxHp, 0.1, HeroClass.Warrior),
        ];
    }
}

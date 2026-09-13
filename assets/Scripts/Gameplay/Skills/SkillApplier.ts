import { _decorator, Component } from 'cc';
import EventManager from '../../Utility/EventManager';
import { CharacterStats } from '../Combat/CharacterStats';
import { GameplayEvents } from '../Events/GameplayEvents';
import { PlayerController } from '../Player/PlayerController';
import { SkillDefinition } from './SkillDefinition';
import { AttackSkillKind, SkillEffectKind, SkillType, StatBuffKind } from './SkillType';

const { ccclass } = _decorator;

export interface ActiveSkillData {
    unlocked: boolean;
    damage: number;
    count: number;
    stunDuration: number;
}

@ccclass('SkillApplier')
export class SkillApplier extends Component {
    public static instance: SkillApplier;

    public ownedAttackSkills: AttackSkillKind[] = [];
    public multiShotBonus: number = 0;
    public pierceCount: number = 0;
    public explosionEnabled: boolean = false;
    public homingEnabled: boolean = false;

    public damageReflectPct: number = 0;
    public adrenalineEnabled: boolean = false;
    public stunBonusDmgPct: number = 0;
    public stunDurationMul: number = 1;
    public parryChance: number = 0;
    public targetWeakest: boolean = false;

    public iceBolt: ActiveSkillData = { unlocked: false, damage: 0, count: 1, stunDuration: 0 };
    public fireBolt: ActiveSkillData = { unlocked: false, damage: 0, count: 0, stunDuration: 0 };
    public fireball: ActiveSkillData = { unlocked: false, damage: 0, count: 0, stunDuration: 0 };
    public lightningBolt: ActiveSkillData = { unlocked: false, damage: 0, count: 1, stunDuration: 0 };
    public chainLightning: ActiveSkillData = { unlocked: false, damage: 0, count: 1, stunDuration: 0 };

    public ownedSkillIds: string[] = [];

    onLoad() {
        SkillApplier.instance = this;
    }

    public apply(skill: SkillDefinition, targetStats: CharacterStats = null) {
        if (!skill) return;
        const stats = targetStats || PlayerController.instance?.stats;
        if (!stats) return;

        if (skill.id && this.ownedSkillIds.indexOf(skill.id) < 0) {
            this.ownedSkillIds.push(skill.id);
        }

        if (skill.effectKind) {
            this.applyEffect(skill, stats);
        } else if (skill.skillType === SkillType.StatBuff) {
            this.applyLegacyStatBuff(skill, stats);
        } else {
            this.applyLegacyAttackSkill(skill);
        }

        EventManager.instance.emit(GameplayEvents.SkillSelected, skill);
    }

    private applyEffect(skill: SkillDefinition, stats: CharacterStats) {
        switch (skill.effectKind) {
            case SkillEffectKind.StatPctDamage:
                stats.addDamagePercent(skill.value);
                break;
            case SkillEffectKind.StatPctMaxHp:
                stats.addMaxHpPercent(skill.value, true);
                break;
            case SkillEffectKind.StatPctMoveSpeed:
                stats.addMoveSpeedPercent(skill.value);
                break;
            case SkillEffectKind.StatPctAttackSpeed:
                stats.addAttackSpeedPercent(skill.value);
                break;
            case SkillEffectKind.StatCritChance:
                stats.addCritChance(skill.value);
                break;
            case SkillEffectKind.StatCritDamage:
                stats.addCritDamage(skill.value);
                break;
            case SkillEffectKind.StatLifesteal:
                stats.addLifesteal(skill.value);
                break;
            case SkillEffectKind.StatPctAttackRange:
                stats.addAttackRangePercent(skill.value);
                break;
            case SkillEffectKind.InstantHealPct:
                stats.healPercentOfMax(skill.value);
                break;
            case SkillEffectKind.DamageReflect:
                this.damageReflectPct += skill.value;
                break;
            case SkillEffectKind.Adrenaline:
                this.adrenalineEnabled = true;
                break;
            case SkillEffectKind.StunBonusDamage:
                this.stunBonusDmgPct += skill.value;
                break;
            case SkillEffectKind.StunDuration:
                this.stunDurationMul += skill.value;
                break;
            case SkillEffectKind.Parry:
                this.parryChance = Math.min(1, this.parryChance + skill.value);
                break;
            case SkillEffectKind.TargetWeakest:
                this.targetWeakest = true;
                break;
            case SkillEffectKind.ActiveIceBolt:
                this.unlockActive(this.iceBolt, skill.value, 1, 0);
                break;
            case SkillEffectKind.ActiveFireBolt:
                this.unlockActive(this.fireBolt, skill.value, skill.value2 || 3, 0);
                break;
            case SkillEffectKind.ActiveFireball:
                this.unlockActive(this.fireball, skill.value, skill.value2 || 3, 0);
                break;
            case SkillEffectKind.ActiveLightningBolt:
                this.unlockActive(this.lightningBolt, skill.value, 1, 0);
                break;
            case SkillEffectKind.ActiveChainLightning:
                this.unlockActive(this.chainLightning, skill.value, 1, skill.value2 || 1);
                break;
            case SkillEffectKind.LegacyStatBuff:
                this.applyLegacyStatBuff(skill, stats);
                break;
            case SkillEffectKind.LegacyAttackSkill:
                this.applyLegacyAttackSkill(skill);
                break;
        }
    }

    private unlockActive(data: ActiveSkillData, damage: number, count: number, stunDuration: number) {
        data.unlocked = true;
        data.damage = Math.max(data.damage, damage);
        data.count = Math.max(data.count, count);
        data.stunDuration = Math.max(data.stunDuration, stunDuration);
    }

    private applyLegacyStatBuff(skill: SkillDefinition, stats: CharacterStats) {
        switch (skill.statBuffKind) {
            case StatBuffKind.MaxHp:
                stats.addMaxHp(skill.value, true);
                break;
            case StatBuffKind.MoveSpeed:
                stats.addMoveSpeed(skill.value);
                break;
            case StatBuffKind.Damage:
                stats.addDamage(skill.value);
                break;
            case StatBuffKind.MeleeRange:
                stats.addMeleeRange(skill.value);
                break;
            case StatBuffKind.RangedRange:
                stats.addRangedRange(skill.value);
                break;
            case StatBuffKind.AttackCooldownReduce:
                stats.attackCooldown = Math.max(0.15, stats.attackCooldown - skill.value);
                break;
        }
    }

    private applyLegacyAttackSkill(skill: SkillDefinition) {
        if (this.ownedAttackSkills.indexOf(skill.attackSkillKind) < 0) {
            this.ownedAttackSkills.push(skill.attackSkillKind);
        }
        switch (skill.attackSkillKind) {
            case AttackSkillKind.MultiShot:
                this.multiShotBonus += Math.max(1, Math.floor(skill.value));
                break;
            case AttackSkillKind.Pierce:
                this.pierceCount += Math.max(1, Math.floor(skill.value));
                break;
            case AttackSkillKind.Explosion:
                this.explosionEnabled = true;
                break;
            case AttackSkillKind.Homing:
                this.homingEnabled = true;
                break;
        }
    }
}

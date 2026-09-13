import { _decorator, CCFloat, Component, Node, Vec3 } from 'cc';
import EventManager from '../../Utility/EventManager';
import { VfxId } from '../../Utility/Pool/PoolManager';
import { CharacterStats } from '../Combat/CharacterStats';
import { EnemyController } from '../Enemy/EnemyController';
import { EnemyType } from '../Enemy/EnemyType';
import { GameplayEvents } from '../Events/GameplayEvents';
import { HeroPartyManager } from '../Hero/HeroPartyManager';
import { PlayerController } from '../Player/PlayerController';
import { HeroVfx } from './HeroVfx';
import { VfxService } from './VfxService';

const { ccclass, property } = _decorator;

@ccclass('CombatVfx')
export class CombatVfx extends Component {
    public static instance: CombatVfx;

    @property({ type: Node })
    public vfxRoot: Node = null;

    @property({ type: Node })
    public heroFallback: Node = null;

    @property({ type: CCFloat })
    public hitHeight: number = 1;

    @property
    public hitVfxEnabled: boolean = true;

    @property
    public deathVfxEnabled: boolean = true;

    onLoad() {
        CombatVfx.instance = this;
        if (this.vfxRoot) VfxService.setRoot(this.vfxRoot);
    }

    onEnable() {
        const ev = EventManager.instance;
        ev.on(GameplayEvents.DamageDealt, this.onDamageDealt, this);
        ev.on(GameplayEvents.EnemyDied, this.onEnemyDied, this);
        ev.on(GameplayEvents.HeroDied, this.onHeroDied, this);
        ev.on(GameplayEvents.HeroLevelUp, this.onHeroLevelUp, this);
        ev.on(GameplayEvents.Healed, this.onHealed, this);
        ev.on(GameplayEvents.CoinClaimed, this.onCoinClaimed, this);
        ev.on(GameplayEvents.SkillSelected, this.onSkillSelected, this);
    }

    onDisable() {
        const ev = EventManager.instance;
        ev.off(GameplayEvents.DamageDealt, this.onDamageDealt, this);
        ev.off(GameplayEvents.EnemyDied, this.onEnemyDied, this);
        ev.off(GameplayEvents.HeroDied, this.onHeroDied, this);
        ev.off(GameplayEvents.HeroLevelUp, this.onHeroLevelUp, this);
        ev.off(GameplayEvents.Healed, this.onHealed, this);
        ev.off(GameplayEvents.CoinClaimed, this.onCoinClaimed, this);
        ev.off(GameplayEvents.SkillSelected, this.onSkillSelected, this);
    }

    private onDamageDealt(target: CharacterStats, _dealt: number, _attacker: CharacterStats, _killed: boolean) {
        if (!this.hitVfxEnabled || !target || !target.node || !target.node.isValid) return;
        const p = target.node.worldPosition;
        VfxService.spawnAt(this.hitVfxFor(target), new Vec3(p.x, p.y + this.hitHeight, p.z));
    }

    private hitVfxFor(target: CharacterStats): VfxId {
        if (target.isPlayer) return VfxId.FX_common_impact_blood;
        const type = target.getComponent(EnemyController)?.enemyType;
        const bony = type === EnemyType.SkeletonMelee || type === EnemyType.SkeletonMage;
        return bony ? VfxId.FX_common_impact_bone : VfxId.FX_common_impact_blood;
    }

    private onEnemyDied(enemy: EnemyController) {
        if (!this.deathVfxEnabled || !enemy || !enemy.node || !enemy.node.isValid) return;
        VfxService.spawnAt(VfxId.FX_Smoke_Die, enemy.node.worldPosition);
    }

    private onHeroDied(hero: Component) {
        HeroVfx.of(hero?.node)?.playDie();
    }

    private onHeroLevelUp(hero: Component) {
        HeroVfx.of(hero?.node)?.playLevelUp();
    }

    private onHealed(target: CharacterStats, amount: number, fromLifesteal: boolean) {
        if (fromLifesteal || amount <= 0) return;
        if (!target || !target.isPlayer || !target.node || !target.node.isValid) return;
        HeroVfx.of(target.node)?.playHeal();
    }

    private onCoinClaimed() {
        const hero = this.referenceHero();
        if (!hero) return;
        VfxService.spawnAt(VfxId.FX_Claim_Gold, hero.worldPosition);
    }

    private onSkillSelected() {
        HeroVfx.of(this.referenceHero())?.playSkillGained();
    }

    private referenceHero(): Node {
        const main = HeroPartyManager.instance?.mainHero;
        if (main && main.node?.isValid) return main.node;
        const pc = PlayerController.instance;
        if (pc && pc.node?.isValid) return pc.node;
        return this.heroFallback && this.heroFallback.isValid ? this.heroFallback : null;
    }
}

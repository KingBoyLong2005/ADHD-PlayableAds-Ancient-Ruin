import EventManager from '../../Utility/EventManager';
import { GameplayLog } from '../Debug/GameplayLog';
import { EnemyController } from '../Enemy/EnemyController';
import { GameplayEvents } from '../Events/GameplayEvents';
import { CharacterStats } from './CharacterStats';

export class DamageDealer {

    public static apply(
        target: CharacterStats,
        damage: number,
        attacker: CharacterStats = null,
        forceCrit: boolean = false,
    ): boolean {
        if (!target || target.isDead || damage <= 0) return false;

        let isCrit = forceCrit;
        if (!isCrit && attacker && attacker.critChance > 0) {
            isCrit = Math.random() < attacker.critChance;
        }
        const dealt = isCrit ? damage * Math.max(1, attacker?.critMultiplier ?? 2) : damage;

        const killed = target.applyDamage(dealt);

        GameplayLog.log(
            'damage',
            `${attacker ? (attacker.isPlayer ? 'HERO' : 'quái') : '?'} -> `
                + `${target.isPlayer ? 'HERO' : 'quái'} ${target.node.name}: -${dealt.toFixed(0)}`
                + `${isCrit ? ' (CRIT)' : ''} | còn ${target.hp.toFixed(0)}/${target.hpMax}`
                + `${killed ? ' | CHẾT' : ''}`,
        );

        EventManager.instance.emit(GameplayEvents.DamageDealt, target, dealt, attacker, killed, isCrit);

        if (attacker && !attacker.isDead && attacker.lifestealPercent > 0) {
            attacker.heal(dealt * attacker.lifestealPercent, true);
        }
        if (killed && !target.isPlayer) {
            const enemy = target.getComponent(EnemyController);
            enemy?.notifyDamaged();
        }
        return killed;
    }
}

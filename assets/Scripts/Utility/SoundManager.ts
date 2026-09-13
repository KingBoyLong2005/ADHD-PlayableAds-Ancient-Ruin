import { _decorator, Component, AudioSource, AudioClip, CCFloat, Enum, sys } from 'cc';
import EventManager from './EventManager';
import { GameplayEvents } from '../Gameplay/Events/GameplayEvents';
const { ccclass, property } = _decorator;

export enum SoundType {
    Music = 'Music',
    Effect = 'Effect',
    Tap = 'Tap',
    EFFECT2 = 'EFFECT2',

    HeroAttackMelee = 'HeroAttackMelee',
    HeroAttackRanged = 'HeroAttackRanged',
    EnemyAttack = 'EnemyAttack',
    EnemyHit = 'EnemyHit',
    HeroHit = 'HeroHit',
    Crit = 'Crit',
    EnemyDie = 'EnemyDie',
    HeroDie = 'HeroDie',

    CoinClaim = 'CoinClaim',
    Heal = 'Heal',
    LevelUp = 'LevelUp',
    SkillSelect = 'SkillSelect',

    SpinStart = 'SpinStart',
    SpinStop = 'SpinStop',
    HeroSelect = 'HeroSelect',
    ButtonClick = 'ButtonClick',

    GateOpen = 'GateOpen',
    ZoneClear = 'ZoneClear',
    Win = 'Win',
    Lose = 'Lose',
}

@ccclass('Sound')
export class Sound {
    @property({ type: Enum(SoundType) })
    public name: SoundType = SoundType.Effect;

    @property({ type: AudioClip })
    public clip: AudioClip | null = null;

    @property
    public playOnAwake: boolean = false;

    @property
    public loop: boolean = false;

    @property
    public volume: number = 1;

    public source: AudioSource | null = null;
}

@ccclass('SoundManager')
export class SoundManager extends Component {

    public static instance: SoundManager = null;

    @property([Sound])
    private listSounds: Sound[] = [];

    @property({ type: CCFloat })
    public minEffectInterval: number = 0.05;

    private _pendingMusicPlay = false;
    private _boundUnlockGesture: ((e: Event) => void) | null = null;

    private _clock = 0;
    private _lastPlayed: Map<SoundType, number> = new Map();

    protected onLoad() {
        SoundManager.instance = this;
        this.initializeSounds();
    }

    protected onEnable(): void {
        this.bindMusicUnlockGesture();
        this.bindGameplayEvents(true);
    }

    protected onDestroy(): void {
        if (SoundManager.instance === this) SoundManager.instance = null;
        this.unbindMusicUnlockGesture();
    }

    protected onDisable(): void {
        this.bindGameplayEvents(false);
        this.unbindMusicUnlockGesture();
    }

    protected update(dt: number): void {
        this._clock += dt;
    }

    private bindGameplayEvents(on: boolean): void {
        const ev = EventManager.instance;
        const bind = on ? ev.on.bind(ev) : ev.off.bind(ev);
        bind(GameplayEvents.DamageDealt, this.onDamageDealt, this);
        bind(GameplayEvents.EnemyDied, this.onEnemyDied, this);

        bind(GameplayEvents.HeroDied, this.onHeroDied, this);
        bind(GameplayEvents.PlayerDied, this.onHeroDied, this);
        bind(GameplayEvents.CoinClaimed, this.onCoinClaimed, this);
        bind(GameplayEvents.Healed, this.onHealed, this);
        bind(GameplayEvents.HeroLevelUp, this.onHeroLevelUp, this);
        bind(GameplayEvents.SkillSelected, this.onSkillSelected, this);
        bind(GameplayEvents.HeroSelected, this.onHeroSelected, this);
        bind(GameplayEvents.GateOpened, this.onGateOpened, this);
        bind(GameplayEvents.ZoneCleared, this.onZoneCleared, this);
        bind(GameplayEvents.GameWin, this.onGameWin, this);
        bind(GameplayEvents.GameLose, this.onGameLose, this);
    }

    private bindMusicUnlockGesture(): void {
        if (!sys.isBrowser || this._boundUnlockGesture) return;
        this._boundUnlockGesture = () => {
            if (!this._pendingMusicPlay) return;
            const music = this.listSounds.find((s) => s.name === SoundType.Music);
            if (!music?.source?.clip) return;
            this._pendingMusicPlay = false;
            try {
                music.source.play();
            } catch {

            }
        };
        try {
            globalThis.addEventListener('pointerdown', this._boundUnlockGesture as EventListener, { passive: true });
            globalThis.addEventListener('touchstart', this._boundUnlockGesture as EventListener, { passive: true });
        } catch {

        }
    }

    private unbindMusicUnlockGesture(): void {
        if (!this._boundUnlockGesture) return;
        try {
            globalThis.removeEventListener('pointerdown', this._boundUnlockGesture as EventListener);
            globalThis.removeEventListener('touchstart', this._boundUnlockGesture as EventListener);
        } catch {

        }
        this._boundUnlockGesture = null;
    }

    private initializeSounds() {
        this.listSounds.forEach(sound => {
            sound.source = this.node.addComponent(AudioSource);
            sound.source.playOnAwake = false;
            sound.source.loop = sound.loop;
            if (sound.clip) {
                sound.source.clip = sound.clip;
            }
            if (sound.name === SoundType.Music) {
                sound.source.volume = sound.volume;
                if (sound.playOnAwake && sound.source.clip) {

                    try {
                        sound.source.play();
                    } catch {
                        this._pendingMusicPlay = true;
                    }
                }
            } else {
                sound.source.volume = 0;
            }
        });
    }

    public static play(name: SoundType) {
        SoundManager.instance?.playSound(name);
    }

    public playSound(name: SoundType): boolean {
        const sound = this.listSounds.find(s => s.name === name);
        if (!sound?.source?.clip) return false;

        if (name !== SoundType.Music && this.minEffectInterval > 0) {
            const last = this._lastPlayed.get(name);
            if (last !== undefined && this._clock - last < this.minEffectInterval) return false;
            this._lastPlayed.set(name, this._clock);
        }

        sound.source.volume = sound.volume;
        sound.source.playOneShot(sound.source.clip, sound.volume);
        return true;
    }

    public playFirst(...names: SoundType[]): boolean {
        for (const name of names) {
            if (this.playSound(name)) return true;
        }
        return false;
    }

    public stop(name: SoundType) {
        const sound = this.listSounds.find(s => s.name === name);
        if (sound && sound.source) {
            sound.source.stop();
        }
    }

    public stopAllTheme() {
        this.stop(SoundType.Music);
    }

    public changeVolume(volume: number) {
        this.listSounds.forEach(sound => {
            if (sound.source) {
                sound.source.volume = volume;
                if (volume === 0) {
                    sound.source.enabled = false;
                } else {
                    sound.source.enabled = true;
                }
            }
        });
    }

    playSoundTap() {
        this.playSound(SoundType.Tap);
    }

    playSoundEffect() {
        this.playSound(SoundType.Effect);
    }

    playSoundConnect() {
        this.playSound(SoundType.EFFECT2);
    }

    public playHeroAttack(isMelee: boolean) {
        this.playFirst(isMelee ? SoundType.HeroAttackMelee : SoundType.HeroAttackRanged, SoundType.Effect);
    }

    public playEnemyAttack() {
        this.playFirst(SoundType.EnemyAttack, SoundType.Effect);
    }

    public playButtonClick() {
        this.playFirst(SoundType.ButtonClick, SoundType.Tap);
    }

    public playSpinStart() {
        this.playFirst(SoundType.SpinStart, SoundType.EFFECT2);
    }

    public playSpinStop() {
        this.playFirst(SoundType.SpinStop, SoundType.Tap);
    }

    private onDamageDealt(target: any, _dealt: number, _attacker: any, _killed: boolean, isCrit: boolean) {
        if (!target) return;
        if (isCrit && this.playSound(SoundType.Crit)) return;
        this.playSound(target.isPlayer ? SoundType.HeroHit : SoundType.EnemyHit);
    }

    private onEnemyDied() {
        this.playSound(SoundType.EnemyDie);
    }

    private onHeroDied() {
        this.playSound(SoundType.HeroDie);
    }

    private onCoinClaimed() {
        this.playSound(SoundType.CoinClaim);
    }

    private onHealed(target: any, amount: number, fromLifesteal: boolean) {
        if (fromLifesteal || amount <= 0 || !target?.isPlayer) return;
        this.playSound(SoundType.Heal);
    }

    private onHeroLevelUp() {
        this.playSound(SoundType.LevelUp);
    }

    private onSkillSelected(skill: any) {

        if (!skill) return;
        this.playSound(SoundType.SkillSelect);
    }

    private onHeroSelected() {
        this.playSound(SoundType.HeroSelect);
    }

    private onGateOpened() {
        this.playSound(SoundType.GateOpen);
    }

    private onZoneCleared() {
        this.playSound(SoundType.ZoneClear);
    }

    private onGameWin() {
        this.stopAllTheme();
        this.playSound(SoundType.Win);
    }

    private onGameLose() {
        this.stopAllTheme();
        this.playSound(SoundType.Lose);
    }
}

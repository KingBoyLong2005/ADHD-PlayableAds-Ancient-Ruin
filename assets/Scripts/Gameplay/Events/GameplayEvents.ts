export const GameplayEvents = {
    PlayerDied: 'gameplay.player_died',
    EnemyDied: 'gameplay.enemy_died',
    AllEnemiesCleared: 'gameplay.all_enemies_cleared',
    EnemySpawned: 'gameplay.enemy_spawned',
    CoinClaimed: 'gameplay.coin_claimed',
    CoinChanged: 'gameplay.coin_changed',
    LevelUpReady: 'gameplay.level_up_ready',
    SkillSelected: 'gameplay.skill_selected',
    GamePaused: 'gameplay.game_paused',
    GameResumed: 'gameplay.game_resumed',
    GameWin: 'gameplay.game_win',
    GameLose: 'gameplay.game_lose',
    ZoneCleared: 'gameplay.zone_cleared',
    GateOpened: 'gameplay.gate_opened',
    HpChanged: 'gameplay.hp_changed',
    DamageDealt: 'gameplay.damage_dealt',

    Healed: 'gameplay.healed',
    SpawnHitVfx: 'gameplay.spawn_hit_vfx',
    HeroSelected: 'gameplay.hero_selected',
    HeroLevelUp: 'gameplay.hero_level_up',
    HeroDied: 'gameplay.hero_died',
    AllHeroesDied: 'gameplay.all_heroes_died',

    StageStarted: 'gameplay.stage_started',

    StageCleared: 'gameplay.stage_cleared',

    AllyRescued: 'gameplay.ally_rescued',

    RoomSelectOpened: 'gameplay.room_select_opened',

    RoomSelected: 'gameplay.room_selected',

    ReviveOffered: 'gameplay.revive_offered',

    ReviveAnswered: 'gameplay.revive_answered',

    MapIntroFinished: 'gameplay.map_intro_finished',
} as const;

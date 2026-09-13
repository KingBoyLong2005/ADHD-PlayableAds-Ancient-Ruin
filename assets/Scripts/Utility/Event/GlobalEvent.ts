import { _decorator } from 'cc';
import BaseEvent from './BaseEvent';
const { ccclass, property } = _decorator;

@ccclass('GlobalEvent')
export class GlobalEvent extends BaseEvent {
    private static event: GlobalEvent | null = null;
    private constructor() {
        super();
    }

    public static instance(): GlobalEvent {
        if (!GlobalEvent.event) {
            GlobalEvent.event = new GlobalEvent();
        }
        return GlobalEvent.event;
    }

    static readonly START_GAME = "GlobalEvent.START_GAME";
    static readonly SHOW_LOSE = "GlobalEvent.SHOW_LOSE";
    static readonly SHOW_WIN = "GlobalEvent.SHOW_WIN";
    static readonly OPEN_STORE = "GlobalEvent.OPEN_STORE";
    static readonly ACTIVE_AUTO_OPEN_STORE = "GlobalEvent.ACTIVE_AUTO_OPEN_STORE";
    static readonly CHECK_PLAYABLE = "GlobalEvent.CHECK_PLAYABLE";
    static readonly SHOW_TUTORIAL = "GlobalEvent.SHOW_TUTORIAL";
    static readonly CLEAR_TUTORIAL = "GlobalEvent.CLEAR_TUTORIAL";
    static readonly END_GAME = "GlobalEvent.END_GAME";

    static readonly CHECK_END_GAME = "GlobalEvent.CHECK_END_GAME";

    static readonly CLEAR_TUTORIAL_INTRO = "GlobalEvent.CLEAR_TUTORIAL_INTRO";
    static readonly GAME_RESIZE = "GlobalEvent.GAME_RESIZE";
    static readonly CHECK_HAS_BLOCK_STANDING_ON = "GlobalEvent.CHECK_HAS_BLOCK_STANDING_ON";
    static readonly RESET_BLOCK_MAP = "GlobalEvent.RESET_BLOCK_MAP";
    static readonly CLICK_OPEN_STORE = "GlobalEvent.CLICK_OPEN_STORE";
    static readonly AUTO_RELEASE = "GlobalEvent.AUTO_RELEASE";

    static readonly MOVE_CLAMP_POS = "GlobalEvent.MOVE_CLAMP_POS";
    static readonly REMOVE_NUTS = "GlobalEvent.REMOVE_NUTS";
    static readonly CHECK_COMPLETE_LAYER = "GlobalEvent.CHECK_COMPLETE_LAYER";
    static readonly ACTIVE_NEXT_LAYER = "GlobalEvent.ACTIVE_NEXT_LAYER";
    static readonly TOUCHABLE_NUTS = "GlobalEvent.TOUCHABLE_NUTS";
    static readonly Active_Layer = "GlobalEvent.Active_Layer";
    static readonly DESTROY_ROPE = "GlobalEvent.DESTROY_ROPE";
    static readonly ACTIVE_FIRST_PIECE = "GlobalEvent.ACTIVE_FIRST_PIECE";
    static readonly WARNING = "GlobalEvent.WARNING";
    static readonly UPDATE_IQ_BAR = "GlobalEvent.UPDATE_IQ_BAR";
    static readonly SHOW_SHAKE_GOLD = "GlobalEvent.SHOW_SHAKE_GOLD";
    static readonly HIDE_SHAKE_GOLD = "GlobalEvent.HIDE_SHAKE_GOLD";
    static readonly SHOW_SCORE = "GlobalEvent.SHOW_SCORE";
    static readonly SHOW_EFFECT_COIN = "GlobalEvent.SHOW_EFFECT_COIN";
    static readonly RECORD_SCORE = "GlobalEvent.RECORD_SCORE";

    static PICK_UNIT: string = "GlobalEvent.PICK_UNIT";

}

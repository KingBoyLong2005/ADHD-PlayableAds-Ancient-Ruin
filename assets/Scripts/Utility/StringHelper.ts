import { _decorator, Component, Node } from "cc";
const { ccclass, property } = _decorator;

@ccclass("StringHelper")
export class StringHelper extends Component {}
export enum Direction {
    ONLY_X,
    ONLY_Z,
    FREE,
}

export enum TypeColor {
    NONE,
    Beige = 1,
    Black = 2,
    Blue = 3,
    Brown = 4,
    Cyan = 5,
    DarkGreen = 6,
    DarkRed = 7,
    Green = 8,
    Gray = 9,
    LightBrown = 10,
    LightPink = 11,
    LightViolet = 12,
    Orange = 13,
    Pink = 14,
    Red = 15,
    Violet = 16,
    White = 17,
    Yellow = 18,
    DarkCyan = 19,
    ShrimpPaste = 20,
    Rainbow = 21,
}

export enum BoosterType {
    NONE = 0,
    AddHole = 1,
    RainbowWool = 2,
    VacuumCleaner = 3,
    ClearWaitingHoles = 4,
    AddBoxSlot = 5,
}

interface KeyEvent {
    FirstInteraction: string;
    TryGuestGoToCar: string;
    UpdatePos: string;
    CheckGuestCanMoveToCar: string;
}
let KeyEvent: KeyEvent = {
    FirstInteraction: "FirstInteraction",
    TryGuestGoToCar: "TryGuestGoToCar",
    UpdatePos: "UpdatePos",
    CheckGuestCanMoveToCar: "CheckGuestCanMoveToCar",
};
export default KeyEvent;

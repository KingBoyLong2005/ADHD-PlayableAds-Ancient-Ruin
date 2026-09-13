
export interface RunFlowHook {

    canWin(): boolean;

    ownsEnding(): boolean;
}

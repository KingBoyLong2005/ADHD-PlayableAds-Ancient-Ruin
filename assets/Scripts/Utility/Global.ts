import { Vec2, Vec3 } from "cc";

interface Global {
    endGame: boolean,
    video: boolean,
    endTut: boolean,
    debug: boolean,
    layerName: number[],
    horizontalSpacing: number,
    verticalSpacing: number,

    timeActiveBoths: number,
    timeMoveBoxOfNut: number,
    timeMoveRope: number,
}
let Global: Global = {
    video: false,
    endGame: false,
    endTut: false,
    debug: false,
    layerName: [2, 1],
    horizontalSpacing: 17.5,
    verticalSpacing: 15.5,
    timeActiveBoths: 1,
    timeMoveBoxOfNut: 0.3,
    timeMoveRope: 0.25,

};
export default Global;

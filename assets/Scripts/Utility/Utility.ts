import { Quat, Vec2 } from "cc";
import { _decorator, Component, Node } from 'cc';
import { Canvas } from "cc";
import { Camera } from "cc";
import { SkeletalAnimation } from "cc";
import { Vec3 } from "cc";
import { director } from "cc";
import { UITransform } from "cc";

const { ccclass, property } = _decorator;

@ccclass('Utility')
export default class Utility extends Component {
    static VectorsSum(a: Vec2, b: Vec2): Vec2 {
        return new Vec2(a.x + b.x, a.y + b.y);
    }
    static VectorsSubs(a: Vec2, b: Vec2): Vec2 {
        return new Vec2(a.x - b.x, a.y - b.y);
    }
    static VectorsMult(a: Vec2, b: Vec2): Vec2 {
        return new Vec2(a.x * b.x, a.y * b.y);
    }
    static VectorsDiv(a: Vec2, b: Vec2): Vec2 {
        if (b.x == 0 || b.y == 0) return null;
        else return new Vec2(a.x / b.x, a.y / b.y);
    }
    static VectorTimes(a: Vec2, x: number) {
        return new Vec2(a.x * x, a.y * x);
    }
    static RandomRangeFloat(lower: number, upper: number) {
        return Math.random() * (upper - lower) + lower;

    }
    static RandomRangeInteger(lower: number, upper: number) {
        return Math.round(Math.random() * (upper - lower) + lower);
    }
    static DistanceV2(vec1: Vec3, vec2: Vec3) {
        let Distance = Math.sqrt(Math.pow(vec1.x - vec2.x, 2) +
            Math.pow(vec1.y - vec2.y, 2));
        return Distance;
    }
    static DistanceV3(vec1: Vec3, vec2: Vec3) {
        let Distance = Math.sqrt(Math.pow(vec1.x - vec2.x, 2) +
            Math.pow(vec1.y - vec2.y, 2) + Math.pow(vec1.z - vec2.z, 2));
        return Distance;
    }
    static CaculatorDurationV2(vec1: Vec3, vec2: Vec3, speed: number) {
        let distance = this.DistanceV2(vec1, vec2);
        let duration = distance / speed;
        return duration;
    }
    static CaculatorDurationV3(vec1: Vec3, vec2: Vec3, speed: number) {
        let distance = this.DistanceV3(vec1, vec2);
        let duration = distance / speed;
        return duration;
    }
    static BetweenDegree(comVec: Vec2, dirVec: Vec2 = new Vec2(0, 0)) {
        let angleDegree: number = 0;
        if (dirVec == new Vec2(0, 0)) angleDegree = Math.atan2(comVec.y, comVec.x) * 180 / Math.PI;
        else angleDegree = Math.atan2(dirVec.y - comVec.y, dirVec.x - comVec.x) * 180 / Math.PI;
        return angleDegree;
    }
    static CaculatorDegree(Target: Vec2) {
        var r = Math.atan2(Target.y, Target.x);
        var degree = r * 180 / (Math.PI);
        degree = 360 - degree + 90;
        return degree;
    }
    static RotateIn3D(vecA: Vec3, vecB: Vec3): Quat {

        let pointA = vecA
        let pointB = vecB

        let direction = new Vec3();
        Vec3.subtract(direction, pointB, pointA);

        direction.normalize();

        let up = new Vec3(0, 1, 0);
        let rotation = new Quat();
        Quat.fromViewUp(rotation, direction, up);
        return rotation;
    }

    static randomInt(low: number, high: number): number {
        return Math.floor(Math.random() * (1 + high - low) + low);
    }

    static ConvertPosEventTouch(vector: Vec3) {
        var pos = director.getScene().getChildByName("Canvas").getComponent(UITransform).convertToNodeSpaceAR(vector);
        return pos;
    }
    static ConvertPosToWorldSpace(node: Node, localPos: Vec3) {
        var worldPosition = node.getWorldPosition();
        var pos = worldPosition.add(localPos);
        return pos;
    }
    static ConvertPosToCanvasByNode(objectParent: Node, objectChildren: Node) {
        var pos = director.getScene().getChildByName("Canvas").getComponent(UITransform).convertToNodeSpaceAR(objectParent.getComponent(UITransform).convertToWorldSpaceAR(objectChildren.getPosition()));
        return pos;
    }
    static ConvertPosToCanvasByVector(objectParent: Node, vector: Vec3) {
        var pos = director.getScene().getChildByName("Canvas").getComponent(UITransform).convertToNodeSpaceAR(objectParent.getComponent(UITransform).convertToWorldSpaceAR(vector));
        return pos;
    }
    static ConvertPosToParentByNode(objectParent: Node, objectChildren: Node) {
        var pos = objectParent.getComponent(UITransform).convertToNodeSpaceAR(director.getScene().getChildByName("Canvas").getComponent(UITransform).convertToWorldSpaceAR(objectChildren.getPosition()));
        return pos;
    }
    static ConvertPosToParentByVector(objectParent: Node, vector: Vec3) {
        var pos = objectParent.getComponent(UITransform).convertToNodeSpaceAR(director.getScene().getChildByName("Canvas").getComponent(UITransform).convertToWorldSpaceAR(vector));
        return pos;
    }
    static ConvertPosToHigherParentByNode(objectParentHigher: Node, objectParent: Node, objectChildren: Node) {
        var pos = objectParentHigher.getComponent(UITransform).convertToNodeSpaceAR(objectParent.getComponent(UITransform).convertToWorldSpaceAR(objectChildren.getPosition()));
        return pos;
    }
    static ConvertPosToHigherParentByVector(objectParentHigher: Node, objectParent: Node, vector: Vec3) {
        var pos = objectParentHigher.getComponent(UITransform).convertToNodeSpaceAR(objectParent.getComponent(UITransform).convertToWorldSpaceAR(vector));
        return pos;
    }

    static ShakeCam(camera: Camera, magnitude: number) {

    }

    static convertUIWorldTo3DWorld(
        cameraUI: Camera,
        camera3D: Camera,
        worldPosUI: Vec3,
        distanceFromCamera: number = 1
    ): Vec3 {
        const screenPos = new Vec3();
        cameraUI.worldToScreen(worldPosUI, screenPos);

        const worldPos3D = new Vec3();
        camera3D.screenToWorld(screenPos, worldPos3D);

        return worldPos3D;
    }
}

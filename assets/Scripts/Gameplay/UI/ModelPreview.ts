import { _decorator, Animation, Camera, CCFloat, CCInteger, Color, Component, instantiate, Light, math, MeshRenderer, Node, Prefab, Renderer, RenderTexture, Sprite, SpriteFrame, Vec3 } from 'cc';

const { ccclass, property } = _decorator;

@ccclass('ModelPreview')
export class ModelPreview extends Component {
    @property({ type: Camera })
    public previewCamera: Camera = null;

    @property({ type: Sprite })
    public targetSprite: Sprite = null;

    @property({ type: Node })
    public stage: Node = null;

    @property({ type: CCInteger })
    public textureWidth: number = 512;

    @property({ type: CCInteger })
    public textureHeight: number = 512;

    @property
    public transparentBackground: boolean = true;

    @property({ type: CCFloat })
    public spinSpeed: number = 0;

    @property
    public flipY: boolean = false;

    @property
    public disableScripts: boolean = true;

    @property
    public autoFit: boolean = true;

    @property({ type: CCFloat })
    public fitPadding: number = 1.12;

    @property
    public cacheModels: boolean = true;

    @property({ type: Prefab })
    public defaultModel: Prefab = null;

    private _renderTexture: RenderTexture = null;
    private _spriteFrame: SpriteFrame = null;
    private _model: Node = null;
    private _angle: number = 0;
    private _fitFramesLeft: number = 0;
    private _fitAttemptsLeft: number = 0;
    private _cache: Map<string, Node> = new Map();
    private _fits: Map<Node, { pos: Vec3; near: number; far: number }> = new Map();
    private _preloadQueue: Prefab[] = [];

    public get model(): Node {
        return this._model;
    }

    onLoad() {
        this.build();
    }

    start() {
        if (this.defaultModel) this.show(this.defaultModel);
    }

    update(dt: number) {

        if (this._preloadQueue.length > 0) {
            const warmed = this.build3d(this._preloadQueue.shift());

            if (warmed && !warmed.active) {
                warmed.active = true;
                warmed.active = false;
            }
        }

        if (this._fitFramesLeft > 0 && this._fitAttemptsLeft > 0) {
            this._fitAttemptsLeft--;
            if (this.fitCamera()) this._fitFramesLeft--;
        }

        if (!this._model || this.spinSpeed === 0) return;
        this._angle = (this._angle + this.spinSpeed * dt) % 360;
        this._model.setRotationFromEuler(0, this._angle, 0);
    }

    onDestroy() {
        if (this.targetSprite) this.targetSprite.spriteFrame = null;
        if (this.previewCamera) this.previewCamera.targetTexture = null;
        this._spriteFrame?.destroy();
        this._renderTexture?.destroy();
        this._spriteFrame = null;
        this._renderTexture = null;

        this._cache.forEach((node) => {
            if (node && node.isValid) node.destroy();
        });
        this._cache.clear();
        this._fits.clear();
        this._preloadQueue.length = 0;
    }

    public show(prefab: Prefab): Node {
        if (!prefab) {
            this.clear();
            return null;
        }
        return this.display(this.build3d(prefab));
    }

    public attach(node: Node): Node {
        if (!node) {
            this.clear();
            return null;
        }
        return this.display(this.prepare(node));
    }

    public clear() {
        this.park(this._model);
        this._model = null;
        this._angle = 0;
        this._fitFramesLeft = 0;
        this._fitAttemptsLeft = 0;
    }

    private keyOf(prefab: Prefab): string {
        return prefab.uuid || prefab.name;
    }

    private build3d(prefab: Prefab): Node {
        if (!prefab) return null;

        const key = this.keyOf(prefab);
        if (this.cacheModels) {
            const cached = this._cache.get(key);
            if (cached && cached.isValid) return cached;
        }

        const node = this.prepare(instantiate(prefab));
        if (this.cacheModels) this._cache.set(key, node);
        return node;
    }

    private prepare(node: Node): Node {
        const parent = this.stage || this.node;

        node.active = false;
        node.setParent(parent);
        node.setPosition(Vec3.ZERO);
        node.setRotationFromEuler(0, 0, 0);

        this.applyLayer(node, parent.layer);
        if (this.disableScripts) this.stripBehaviours(node);
        return node;
    }

    private display(node: Node): Node {
        if (!node) return null;
        if (node === this._model) return node;

        this.park(this._model);
        node.setRotationFromEuler(0, 0, 0);
        node.active = true;
        this._model = node;
        this._angle = 0;

        if (!this.autoFit) return node;

        const known = this._fits.get(node);
        if (known) {
            this.previewCamera.node.setWorldPosition(known.pos);
            this.previewCamera.node.lookAt(new Vec3(known.pos.x, known.pos.y, known.pos.z - 1));
            this.previewCamera.near = known.near;
            this.previewCamera.far = known.far;
            this._fitFramesLeft = 0;
        } else {
            this._fitFramesLeft = 4;
            this._fitAttemptsLeft = 60;
            this.fitCamera();
        }
        return node;
    }

    private park(node: Node) {
        if (!node || !node.isValid) return;
        let owned = false;
        this._cache.forEach((cached) => {
            if (cached === node) owned = true;
        });
        if (owned) {
            node.active = false;
        } else {
            this._fits.delete(node);
            node.destroy();
        }
    }

    public fitCamera(): boolean {
        if (!this._model || !this.previewCamera) return false;

        const renderers = this._model.getComponentsInChildren(MeshRenderer);
        const min = new Vec3(Infinity, Infinity, Infinity);
        const max = new Vec3(-Infinity, -Infinity, -Infinity);
        const corner = new Vec3();
        let found = false;

        for (let i = 0; i < renderers.length; i++) {

            if (!renderers[i].enabledInHierarchy) continue;
            const bounds = renderers[i].model?.worldBounds;
            if (!bounds) continue;
            Vec3.subtract(corner, bounds.center, bounds.halfExtents);
            Vec3.min(min, min, corner);
            Vec3.add(corner, bounds.center, bounds.halfExtents);
            Vec3.max(max, max, corner);
            found = true;
        }
        if (!found) return false;

        const center = new Vec3();
        Vec3.add(center, min, max);
        Vec3.multiplyScalar(center, center, 0.5);

        const padding = Math.max(1, this.fitPadding);
        const halfHeight = (max.y - min.y) * 0.5 * padding || 0.5;
        const halfWidth = (max.x - min.x) * 0.5 * padding || 0.5;
        const halfDepth = (max.z - min.z) * 0.5;

        const halfVertical = math.toRadian(this.previewCamera.fov * 0.5);
        const aspect = Math.max(1, this.textureWidth) / Math.max(1, this.textureHeight);
        const halfHorizontal = Math.atan(Math.tan(halfVertical) * aspect);
        const distance =
            Math.max(halfHeight / Math.tan(halfVertical), halfWidth / Math.tan(halfHorizontal)) + halfDepth;

        const camNode = this.previewCamera.node;
        camNode.setWorldPosition(center.x, center.y, center.z + distance);
        camNode.lookAt(center);
        this.previewCamera.near = Math.max(0.01, distance - halfDepth * 2 - halfHeight);
        this.previewCamera.far = distance + halfDepth * 2 + halfHeight * 4;

        this._fits.set(this._model, {
            pos: camNode.worldPosition.clone(),
            near: this.previewCamera.near,
            far: this.previewCamera.far,
        });
        return true;
    }

    private build() {
        if (!this.previewCamera || !this.targetSprite) {
            console.warn('[ModelPreview] previewCamera and targetSprite are both required');
            return;
        }

        const rt = new RenderTexture();
        rt.reset({
            width: Math.max(1, Math.floor(this.textureWidth)),
            height: Math.max(1, Math.floor(this.textureHeight)),
        });

        this.previewCamera.targetTexture = rt;
        if (this.stage) this.previewCamera.visibility = this.stage.layer;
        if (this.transparentBackground) {
            this.previewCamera.clearFlags = Camera.ClearFlag.SOLID_COLOR;
            this.previewCamera.clearColor = new Color(0, 0, 0, 0);
        }

        const sf = new SpriteFrame();
        sf.texture = rt;
        sf.flipUVY = this.flipY;
        this.targetSprite.spriteFrame = sf;

        this._renderTexture = rt;
        this._spriteFrame = sf;
    }

    private stripBehaviours(node: Node) {
        const comps = node.getComponentsInChildren(Component);
        for (let i = 0; i < comps.length; i++) {
            const c = comps[i];
            if (c instanceof Renderer || c instanceof Animation || c instanceof Light) continue;
            c.enabled = false;
        }
    }

    private applyLayer(node: Node, layer: number) {
        node.layer = layer;
        const children = node.children;
        for (let i = 0; i < children.length; i++) {
            this.applyLayer(children[i], layer);
        }
    }
}

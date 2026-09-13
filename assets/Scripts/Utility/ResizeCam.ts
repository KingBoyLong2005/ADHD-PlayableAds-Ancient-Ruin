import { _decorator, Camera, Component, Label, screen, view, sys } from 'cc';
const { ccclass, property } = _decorator;

type DeviceProfile = {
  name: string;
  aspectLandscape: number;
  aspectPortrait: number;
  kLandscape: number;
  kPortrait: number;
  epsilon?: number;
};

@ccclass('ResizeCam')
export class ResizeCam extends Component {
  @property(Camera) camera: Camera | null = null;
  @property(Label) label: Label | null = null;

  @property
  epsilonDefault: number = 0.02;

  @property
  logDetectedProfile: boolean = true;

  private readonly refPortraitAspect = 1080 / 1920;
  private readonly refLandscapeAspect = 1920 / 1080;

  private _lastAspect = -1;

  private readonly DEVICE_PROFILES: DeviceProfile[] = [

    { name: 'iPad 9th/10th (4:3)', aspectLandscape: 4 / 3, aspectPortrait: 3 / 4, kLandscape: 10.0, kPortrait: 17.5 },
    { name: 'iPad Pro 12.9 (2732×2048)', aspectLandscape: 4 / 3, aspectPortrait: 3 / 4, kLandscape: 15.0, kPortrait: 17.0, epsilon: 0.015 },
    { name: 'iPad Air/Pro 11 (2360×1640)', aspectLandscape: 2360 / 1640, aspectPortrait: 1640 / 2360, kLandscape: 15.2, kPortrait: 17.2 },
    { name: 'iPad Pro 11 (2388×1668)', aspectLandscape: 2388 / 1668, aspectPortrait: 1668 / 2388, kLandscape: 15.2, kPortrait: 17.2 },
    { name: 'iPad mini 6 (2266×1488)', aspectLandscape: 2266 / 1488, aspectPortrait: 1488 / 2266, kLandscape: 15.4, kPortrait: 17.4 },

    { name: 'Galaxy Tab S9/S9+/Ultra', aspectLandscape: 2560 / 1600, aspectPortrait: 1600 / 2560, kLandscape: 12.3, kPortrait: 15.3 },
    { name: 'Galaxy Tab A (16:10)', aspectLandscape: 1920 / 1200, aspectPortrait: 1200 / 1920, kLandscape: 15.2, kPortrait: 15.2 },
    { name: 'Xiaomi Pad 6/7 (2880×1800)', aspectLandscape: 2880 / 1800, aspectPortrait: 1800 / 2880, kLandscape: 15.3, kPortrait: 15.3 },
    { name: 'Lenovo Tab P11 (2000×1200)', aspectLandscape: 2000 / 1200, aspectPortrait: 1200 / 2000, kLandscape: 13.3, kPortrait: 13.5 },

    { name: 'Surface Pro (3:2)', aspectLandscape: 3 / 2, aspectPortrait: 2 / 3, kLandscape: 15.0, kPortrait: 16.0 },
    { name: 'Lenovo Tab (5:3)', aspectLandscape: 5 / 3, aspectPortrait: 3 / 5, kLandscape: 15.2, kPortrait: 15.2 },

    { name: 'iPhone X / XS / 11 Pro', aspectLandscape: 2436 / 1125, aspectPortrait: 1125 / 2436, kLandscape: 16.0, kPortrait: 12.0 },
    { name: 'iPhone 11 / XR', aspectLandscape: 1792 / 828, aspectPortrait: 828 / 1792, kLandscape: 16.1, kPortrait: 12 },
    { name: 'iPhone 12/13/14', aspectLandscape: 2532 / 1170, aspectPortrait: 1170 / 2532, kLandscape: 16.2, kPortrait: 12 },
    { name: 'iPhone 12/13/14 Pro', aspectLandscape: 2556 / 1179, aspectPortrait: 1179 / 2556, kLandscape: 16.2, kPortrait: 13.2 },
    { name: 'iPhone 12/13/14 Pro Max', aspectLandscape: 2778 / 1284, aspectPortrait: 1284 / 2778, kLandscape: 16.3, kPortrait: 12.3 },
    { name: 'iPhone 15 / 15 Plus', aspectLandscape: 2796 / 1290, aspectPortrait: 1290 / 2796, kLandscape: 16.3, kPortrait: 12.8 },
    { name: 'iPhone 15 Pro / Pro Max', aspectLandscape: 2796 / 1290, aspectPortrait: 1290 / 2796, kLandscape: 14.3, kPortrait: 14.3 },

    { name: 'iPhone 6/7/8 / SE2/SE3', aspectLandscape: 1334 / 750, aspectPortrait: 750 / 1334, kLandscape: 13, kPortrait: 14.5 },
    { name: 'iPhone 6/7/8 Plus', aspectLandscape: 2208 / 1242, aspectPortrait: 1242 / 2208, kLandscape: 15.5, kPortrait: 13 },

    { name: 'Android 20:9 (2400×1080)', aspectLandscape: 2400 / 1080, aspectPortrait: 1080 / 2400, kLandscape: 16.2, kPortrait: 12.6 },
    { name: 'Android 20:9 (2340×1080)', aspectLandscape: 2340 / 1080, aspectPortrait: 1080 / 2340, kLandscape: 16.2, kPortrait: 12.6 },
    { name: 'Android 19.5:9 (2688×1242)', aspectLandscape: 2688 / 1242, aspectPortrait: 1242 / 2688, kLandscape: 14.2, kPortrait: 14.2 },
    { name: 'Android 19:9 (2280×1080)', aspectLandscape: 2280 / 1080, aspectPortrait: 1080 / 2280, kLandscape: 16.5, kPortrait: 12.3 },
    { name: 'Android 18:9 (2160×1080)', aspectLandscape: 2160 / 1080, aspectPortrait: 1080 / 2160, kLandscape: 15, kPortrait: 12.4 },

    { name: 'Galaxy Z Fold Cover (~21:9)', aspectLandscape: 2316 / 904, aspectPortrait: 904 / 2316, kLandscape: 19, kPortrait: 16.1 },
    { name: 'Galaxy Z Fold Inner (~1.2:1)', aspectLandscape: 2176 / 1812, aspectPortrait: 1812 / 2176, kLandscape: 9, kPortrait: 23 },
  ];

  onEnable() {
    this.applyResize();
    if (sys.isBrowser && typeof window !== 'undefined') {
      window.addEventListener('resize', this.applyResize, false);
      window.addEventListener('orientationchange', this.applyResize, false);
    }
    view.on('canvas-resize', this.applyResize, this);
  }

  onDisable() {
    if (sys.isBrowser && typeof window !== 'undefined') {
      window.removeEventListener('resize', this.applyResize, false);
      window.removeEventListener('orientationchange', this.applyResize, false);
    }
    view.off('canvas-resize', this.applyResize, this);
  }

  private applyResize = () => {
    const { width, height } = screen.windowSize;
    if (!height) return;

    const aspect = width / height;
    if (Math.abs(aspect - this._lastAspect) < 0.0005) return;

    this._lastAspect = aspect;

    const isLandscape = width >= height;
    const refAspect = isLandscape ? this.refLandscapeAspect : this.refPortraitAspect;

    const picked = this.pickProfile(aspect, isLandscape);
    const k = isLandscape ? picked.kLandscape : picked.kPortrait;

    const newOrthoHeight = k * (refAspect / aspect);

    if (this.camera) this.camera.orthoHeight = newOrthoHeight;
    if (this.label) {
      this.label.string = `${aspect.toFixed(4)} ${isLandscape ? 'L' : 'P'} | ${picked.name}`;
    }

    if (this.logDetectedProfile) {

    }
  };

  private pickProfile(aspect: number, isLandscape: boolean): DeviceProfile {
    let bestInEps: { p: DeviceProfile; diff: number } | null = null;
    let bestGlobal: { p: DeviceProfile; diff: number } | null = null;

    for (const p of this.DEVICE_PROFILES) {
      const target = isLandscape ? p.aspectLandscape : p.aspectPortrait;
      const diff = Math.abs(aspect - target);
      const eps = p.epsilon ?? this.epsilonDefault;

      if (!bestGlobal || diff < bestGlobal.diff) bestGlobal = { p, diff };
      if (diff <= eps) {
        if (!bestInEps || diff < bestInEps.diff) bestInEps = { p, diff };
      }
    }
    return (bestInEps ?? bestGlobal)!.p;
  }
}

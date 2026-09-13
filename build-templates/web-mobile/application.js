// ---------------------------------------------------------------------------
// application.js — bản ghi đè của project (build-templates/web-mobile/)
//
// Cocos sinh ra file này lúc build; thư mục build-templates/<platform>/ được
// chép đè lên output *sau* bước sinh, nên file này mới là file thật sự chạy.
// Nội dung giữ đúng bản Cocos sinh ra, chỉ thêm phần SPLASH_TEXT bên dưới.
//
// SPLASH_TEXT: vẽ một dòng chữ ngay dưới icon ở màn splash (màn hiện trước khi
// scene đầu tiên nạp xong). Không có scene nào chạy lúc đó — splash do engine
// vẽ thẳng bằng WebGL — nên chữ phải chen vào chính bộ máy đó, không đặt được
// bằng Label trong scene.
//
// Engine vốn đã có sẵn một lớp chữ dưới logo: dòng "Created with Cocos", nhưng
// nó chỉ dựng và vẽ khi `logo.type === 'default'`. Project đang để logo tuỳ
// chỉnh ('custom') nên nhánh đó nằm im. Nên ở đây: bật cờ đó lên (ảnh logo vẫn
// lấy từ settings, không đổi) rồi thay hẳn hàm dựng chữ bằng của mình.
//
// Áp cho MỌI channel — mọi file .html trong build/super-html/* đều đóng gói lại
// từ build/web-mobile/, tức từ chính file này.
// ---------------------------------------------------------------------------

// ==== chỉnh chữ ở đây ======================================================
var SPLASH_TEXT = {
  text: '',   // '' hoặc null là tắt hẳn; '\n' để xuống dòng
  fontSize: 56,        // px, đo trên màn 1080x1920 — màn khác thì co giãn theo
  gapY: 40,            // mép dưới icon -> mép trên chữ, px @1920 (âm = đẩy lên, đè lên icon)
  offsetX: 0,          // dịch ngang so với tâm màn, px @1080 (dương = sang phải)
  color: '#FFFFFF',
  fontFamily: 'Arial, Helvetica, sans-serif',
  fontWeight: 'bold',  // 'normal' | 'bold' | '900' ...
  lineGap: 8,          // giãn dòng, px @1920 (chỉ có nghĩa khi text nhiều dòng)
  strokeColor: '',     // viền chữ, '' = không viền
  strokeWidth: 0,      // bề dày viền, px @1920
  maxWidth: 0.9        // rộng quá bấy nhiêu phần bề ngang màn thì tự thu cỡ chữ
};
// ===========================================================================

System.register([], function (_export, _context) {
  "use strict";

  var cc, Application;

  // Hai cột mốc quy chiếu: mọi số px trong SPLASH_TEXT đo trên màn 1080x1920.
  var REF_W = 1080;
  var REF_H = 1920;

  function drawTextCanvas(screenH, screenW) {
    var k = screenH / REF_H;
    var lines = String(SPLASH_TEXT.text).split('\n');
    var fontPx = Math.max(1, Math.round(SPLASH_TEXT.fontSize * k));
    var stroke = Math.max(0, (SPLASH_TEXT.strokeWidth || 0) * k);
    var pad = Math.ceil(stroke) + 4;

    var cvs = document.createElement('canvas');
    var ctx = cvs.getContext('2d');
    var i, w;

    function measure() {
      ctx.font = SPLASH_TEXT.fontWeight + ' ' + fontPx + 'px ' + SPLASH_TEXT.fontFamily;
      w = 0;
      for (i = 0; i < lines.length; i++) {
        w = Math.max(w, ctx.measureText(lines[i]).width);
      }
      return w + pad * 2;
    }

    // Dòng dài hơn khung thì thu cỡ chữ lại, không để chữ tràn ra ngoài màn.
    var need = measure();
    var limit = screenW * (SPLASH_TEXT.maxWidth || 1);
    if (need > limit && need > 0) {
      fontPx = Math.max(1, Math.floor(fontPx * limit / need));
      need = measure();
    }

    var lineH = Math.round(fontPx + (SPLASH_TEXT.lineGap || 0) * k);
    cvs.width = Math.max(2, Math.ceil(need));
    cvs.height = Math.max(2, lineH * lines.length + pad * 2);

    // Gán width/height là reset sạch context -> mọi thiết lập phải khai lại sau.
    ctx = cvs.getContext('2d');
    ctx.font = SPLASH_TEXT.fontWeight + ' ' + fontPx + 'px ' + SPLASH_TEXT.fontFamily;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.lineJoin = 'round';
    for (i = 0; i < lines.length; i++) {
      var x = cvs.width / 2;
      var y = pad + i * lineH;
      if (stroke > 0 && SPLASH_TEXT.strokeColor) {
        ctx.lineWidth = stroke * 2;
        ctx.strokeStyle = SPLASH_TEXT.strokeColor;
        ctx.strokeText(lines[i], x, y);
      }
      ctx.fillStyle = SPLASH_TEXT.color;
      ctx.fillText(lines[i], x, y);
    }
    return cvs;
  }

  // Lớp SplashScreen nằm ở đâu thì phải DÒ, không lấy thẳng `cc.internal` được.
  // Bản build web-mobile: `cocos-js/cc.js` chỉ re-export một danh sách tên cố
  // định (Material, gfx, cclegacy...) và **`internal` không nằm trong danh sách
  // đó** — nên `engine.internal` là undefined và patch thoát ra không kêu tiếng
  // nào. Engine chỉ gắn lớp này vào đối tượng legacy:
  //   var y = { _global: window }; y.internal = {}; window.cc = y;
  //   ...
  //   y.internal.SplashScreen = vD;
  // tức `cc.cclegacy.internal` (cũng chính là `window.cc.internal`). Lúc Preview
  // thì `cc.internal` lại có thật, nên dò cả ba chỗ.
  function findSplashScreen(engine) {
    var roots = [
      engine,
      engine && engine.cclegacy,
      typeof window !== 'undefined' ? window.cc : null
    ];
    for (var i = 0; i < roots.length; i++) {
      var r = roots[i];
      var S = r && r.internal && r.internal.SplashScreen;
      if (S && S.prototype && S.prototype.initWaterMark) return S;
    }
    return null;
  }

  function installSplashText(engine) {
    if (!SPLASH_TEXT || !SPLASH_TEXT.text) return;
    var SplashScreen = findSplashScreen(engine);
    if (!SplashScreen) {
      // Kêu thành tiếng: mất chỗ này là chữ biến mất mà không có dấu vết nào.
      console.warn('[splash-text] khong tim thay internal.SplashScreen -> bo qua');
      return;
    }

    var proto = SplashScreen.prototype;
    if (proto.__splashTextPatched) return;
    proto.__splashTextPatched = true;

    var baseInitLayout = proto.initLayout;
    var baseUpdate = proto.update;

    // initLayout chạy trong init(), ngay trước chỗ engine hỏi logo.type để quyết
    // định có dựng lớp chữ hay không. Ảnh logo vẫn nạp từ logo.base64 với mọi
    // type khác 'none', nên bật cờ này không đổi icon đang hiện.
    proto.initLayout = function () {
      baseInitLayout.call(this);
      if (this.settings && this.settings.logo) this.settings.logo.type = 'default';
    };

    proto.initWaterMark = function () {
      try {
        var gfx = engine.gfx;
        var cvs = drawTextCanvas(this.swapchain.height, this.swapchain.width);

        var region = new gfx.BufferTextureCopy();
        region.texExtent.width = cvs.width;
        region.texExtent.height = cvs.height;
        region.texExtent.depth = 1;

        this.watermarkTexture = this.device.createTexture(new gfx.TextureInfo(
          gfx.TextureType.TEX2D,
          gfx.TextureUsageBit.SAMPLED | gfx.TextureUsageBit.TRANSFER_DST,
          gfx.Format.RGBA8,
          cvs.width,
          cvs.height
        ));
        this.device.copyTexImagesToTexture([cvs], this.watermarkTexture, [region]);

        this.watermarkMat = new engine.Material();
        this.watermarkMat.initialize({ effectName: 'util/splash-screen' });
        var pass = this.watermarkMat.passes[0];
        var binding = pass.getBinding('mainTexture');
        pass.bindTexture(binding, this.watermarkTexture);
        pass.descriptorSet.update();
      } catch (e) {
        // Splash hỏng thì cả game không boot được — thà mất dòng chữ.
        // update/frame/destroy của engine đều kiểm watermarkMat trước khi dùng.
        console.warn('[splash-text] ' + ((e && e.message) || e));
        this.watermarkMat = null;
        this.watermarkTexture = null;
      }
    };

    // Engine đặt tâm chữ tại:
    //   yTâmChữ = yTâmLogo - (0.5*logoHeight*displayRatio + textYExtraTrans)*scaleSize - 0.5*caoẢnhChữ
    // tức (…)*scaleSize chính là khoảng từ tâm logo xuống *mép trên* chữ.
    // Nhưng `logoHeight` ở đó là cỡ thiết kế (100/200px) chứ không phải cỡ icon
    // vẽ thật trên màn (0.185*caoMàn*displayRatio), nên công thức gốc lệch và
    // chữ thụt lên đè vào icon. Tính ngược từ cỡ thật để `gapY` đúng nghĩa là
    // khoảng cách từ đáy icon xuống đầu chữ.
    proto.update = function (dt) {
      if (this.watermarkMat && this.watermarkTexture && this.settings) {
        this.initScale();
        var h = this.swapchain.height;
        var k = h / REF_H;
        var ratio = this.settings.displayRatio;
        var logoDrawH = 0.185 * h * ratio;
        var scale = this.scaleSize || 1;
        this.textYExtraTrans =
          (0.5 * logoDrawH + SPLASH_TEXT.gapY * k) / scale - 0.5 * (this.logoHeight || 0) * ratio;
        this.textXTrans = 0.5 + (SPLASH_TEXT.offsetX || 0) / REF_W;
      }
      baseUpdate.call(this, dt);
    };
  }

  return {
    setters: [],
    execute: function () {
      _export("Application", Application = function () {
        function Application() {
          this.settingsPath = 'src/settings.json';
          this.showFPS = false;
        }

        Application.prototype.init = function (engine) {
          cc = engine;
          try {
            installSplashText(cc);
          } catch (e) {
            console.warn('[splash-text] ' + ((e && e.message) || e));
          }
          cc.game.onPostBaseInitDelegate.add(this.onPostInitBase.bind(this));
          cc.game.onPostSubsystemInitDelegate.add(this.onPostSystemInit.bind(this));
        };

        Application.prototype.onPostInitBase = function () {
          // cc.settings.overrideSettings('assets', 'server', '');
          // do custom logic
        };

        Application.prototype.onPostSystemInit = function () {
          // do custom logic
        };

        Application.prototype.start = function () {
          return cc.game.init({
            debugMode: false ? cc.DebugMode.INFO : cc.DebugMode.ERROR,
            settingsPath: this.settingsPath,
            overrideSettings: {
              profiling: {
                showFPS: this.showFPS
              }
            }
          }).then(function () {
            return cc.game.run();
          });
        };

        return Application;
      }());
    }
  };
});

// Sinh uuid cho .ts.meta mới + nén về dạng Cocos dùng trong file scene.
//
// Nén: giữ nguyên 5 ký tự đầu của uuid, 27 ký tự hex còn lại gộp từng 3 (12 bit)
// thành 2 ký tự base64 — đúng thuật toán `compressUuid` của engine.
const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function compress(uuid) {
    const hex = uuid.replace(/-/g, '');
    if (hex.length !== 32) throw new Error('uuid phải 32 hex: ' + uuid);
    let out = hex.slice(0, 5);
    for (let i = 5; i < 32; i += 3) {
        const v = parseInt(hex.slice(i, i + 3), 16);
        out += BASE64[(v >> 6) & 63] + BASE64[v & 63];
    }
    return out;
}

function uuid4(rand) {
    const h = '0123456789abcdef';
    let s = '';
    for (let i = 0; i < 32; i++) s += h[Math.floor(rand() * 16)];
    s = s.slice(0, 12) + '4' + s.slice(13, 16) + h[8 + Math.floor(rand() * 4)] + s.slice(17);
    return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}

module.exports = { compress, uuid4, BASE64 };

if (require.main === module) {
    // Kiểm chứng bằng cặp đã biết trong scene.
    const check = [
        ['06fc2efe-a3bf-4698-9c2b-3989a2f92c4c', '06fc27+o79GmJwrOYmi+SxM'],
    ];
    for (const [u, want] of check) {
        const got = compress(u);
        console.log(got === want ? `ok  ${u} -> ${got}` : `SAI ${u} -> ${got} (mong ${want})`);
    }
}

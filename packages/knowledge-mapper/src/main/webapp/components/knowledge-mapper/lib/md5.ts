/*
 * MD5 of a string's UTF-8 bytes, as lower-case hex: the same value Splunk's
 * eval md5() gives for that string. Used to name entity ids in searches
 * without putting the ids themselves into SPL (see getRelationshipsForNodes).
 * Not used for security. WebCrypto has no MD5 and needs a secure context,
 * which Splunk Web over plain HTTP is not, hence this small implementation.
 */

const S = [
    7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
    5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
    4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
    6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
];
const K = Array.from({ length: 64 }, (_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32) >>> 0);

function utf8(text: string): number[] {
    const out: number[] = [];
    for (const ch of text) {
        let c = ch.codePointAt(0) as number;
        if (c >= 0xd800 && c <= 0xdfff) c = 0xfffd; // a lone surrogate: U+FFFD, as TextEncoder does
        if (c < 0x80) out.push(c);
        else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
        else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
        else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    }
    return out;
}

export function md5Hex(text: string): string {
    const bytes = utf8(text);
    const bitLen = bytes.length * 8;
    bytes.push(0x80);
    while (bytes.length % 64 !== 56) bytes.push(0);
    // Length in bits, little-endian, 64 bits (high word from the division).
    let lo = bitLen >>> 0;
    let hi = Math.floor(bitLen / 2 ** 32) >>> 0;
    for (let i = 0; i < 4; i++) { bytes.push(lo & 255); lo >>>= 8; }
    for (let i = 0; i < 4; i++) { bytes.push(hi & 255); hi >>>= 8; }

    let a0 = 0x67452301;
    let b0 = 0xefcdab89;
    let c0 = 0x98badcfe;
    let d0 = 0x10325476;
    const M = new Array<number>(16);
    for (let off = 0; off < bytes.length; off += 64) {
        for (let j = 0; j < 16; j++) {
            const p = off + j * 4;
            M[j] = (bytes[p] | (bytes[p + 1] << 8) | (bytes[p + 2] << 16) | (bytes[p + 3] << 24)) >>> 0;
        }
        let A = a0;
        let B = b0;
        let C = c0;
        let D = d0;
        for (let i = 0; i < 64; i++) {
            let F: number;
            let g: number;
            if (i < 16) { F = (B & C) | (~B & D); g = i; }
            else if (i < 32) { F = (D & B) | (~D & C); g = (5 * i + 1) % 16; }
            else if (i < 48) { F = B ^ C ^ D; g = (3 * i + 5) % 16; }
            else { F = C ^ (B | ~D); g = (7 * i) % 16; }
            F = (F + A + K[i] + M[g]) >>> 0;
            A = D;
            D = C;
            C = B;
            B = (B + ((F << S[i]) | (F >>> (32 - S[i])))) >>> 0;
        }
        a0 = (a0 + A) >>> 0;
        b0 = (b0 + B) >>> 0;
        c0 = (c0 + C) >>> 0;
        d0 = (d0 + D) >>> 0;
    }
    return [a0, b0, c0, d0]
        .map((w) => [0, 8, 16, 24].map((s) => ((w >>> s) & 255).toString(16).padStart(2, '0')).join(''))
        .join('');
}

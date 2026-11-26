/*
 * lib/md5.ts against Node's crypto MD5 (an implementation the app never
 * uses), over the RFC 1321 vectors, every length across the padding
 * boundaries, and non-ASCII text in every UTF-8 byte length.
 */
import { describe, expect, test } from '@jest/globals';
import { createHash } from 'crypto';
import { md5Hex } from '../lib/md5';
import { prng } from './fakeSplunk';

const nodeMd5 = (s: string) => createHash('md5').update(s, 'utf8').digest('hex');

describe('md5Hex', () => {
    test('RFC 1321 test suite', () => {
        expect(md5Hex('')).toBe('d41d8cd98f00b204e9800998ecf8427e');
        expect(md5Hex('a')).toBe('0cc175b9c0f1b6a831c399e269772661');
        expect(md5Hex('abc')).toBe('900150983cd24fb0d6963f7d28e17f72');
        expect(md5Hex('message digest')).toBe('f96b697d7cb7938d525a2f31aaf161d0');
        expect(md5Hex('abcdefghijklmnopqrstuvwxyz')).toBe('c3fcd3d76192e4007dfb496cca67e13b');
        expect(md5Hex('12345678901234567890123456789012345678901234567890123456789012345678901234567890'))
            .toBe('57edf4a22be3c955ac49da2e2107b67a');
    });

    test('every length from 0 to 300 characters', () => {
        for (let n = 0; n <= 300; n++) {
            const s = 'x"y,z'.repeat(61).slice(0, n);
            expect({ n, h: md5Hex(s) }).toEqual({ n, h: nodeMd5(s) });
        }
    });

    test('UTF-8 of 1, 2, 3 and 4 bytes, and lone surrogates', () => {
        for (const s of ['é', 'Zoë Ångström', '日本語', '🚀', 'a🚀b', 'ключ', '\u0000', '\ud800', 'x\udfffy']) {
            expect({ s, h: md5Hex(s) }).toEqual({ s, h: nodeMd5(s) });
        }
    });

    test('random strings', () => {
        const rnd = prng(7);
        const pool = 'abcXYZ019 "\',\\`$|()=\n\téü日🚀';
        const chars = Array.from(pool);
        for (let i = 0; i < 500; i++) {
            const len = Math.floor(rnd() * 140);
            const s = Array.from({ length: len }, () => chars[Math.floor(rnd() * chars.length)]).join('');
            expect({ s, h: md5Hex(s) }).toEqual({ s, h: nodeMd5(s) });
        }
    });
});

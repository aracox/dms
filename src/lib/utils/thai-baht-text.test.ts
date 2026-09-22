import { describe, expect, it } from 'vitest';

import { bahtText, numberToThaiText } from './thai-baht-text';

describe('numberToThaiText', () => {
  it('converts zero', () => {
    expect(numberToThaiText(0)).toBe('ศูนย์');
  });

  it('converts a standalone 1 as หนึ่ง, not เอ็ด', () => {
    expect(numberToThaiText(1)).toBe('หนึ่ง');
  });

  it('uses เอ็ด for a trailing 1 after another digit', () => {
    expect(numberToThaiText(11)).toBe('สิบเอ็ด');
    expect(numberToThaiText(21)).toBe('ยี่สิบเอ็ด');
    expect(numberToThaiText(101)).toBe('หนึ่งร้อยเอ็ด');
  });

  it('uses ยี่สิบ instead of สองสิบ', () => {
    expect(numberToThaiText(20)).toBe('ยี่สิบ');
  });

  it('uses สิบ alone for the tens digit 1, not หนึ่งสิบ', () => {
    expect(numberToThaiText(10)).toBe('สิบ');
  });

  it('converts hundreds, thousands, and mixed places', () => {
    expect(numberToThaiText(100)).toBe('หนึ่งร้อย');
    expect(numberToThaiText(1000)).toBe('หนึ่งพัน');
    expect(numberToThaiText(6500)).toBe('หกพันห้าร้อย');
  });

  it('converts across the ล้าน boundary', () => {
    expect(numberToThaiText(1234567)).toBe('หนึ่งล้านสองแสนสามหมื่นสี่พันห้าร้อยหกสิบเจ็ด');
    expect(numberToThaiText(1000001)).toBe('หนึ่งล้านเอ็ด');
  });

  it('skips zero digits without emitting stray place words', () => {
    expect(numberToThaiText(1005)).toBe('หนึ่งพันห้า');
  });
});

describe('bahtText', () => {
  it('appends ถ้วน when there is no satang', () => {
    expect(bahtText(6500)).toBe('หกพันห้าร้อยบาทถ้วน');
  });

  it('spells out satang when present', () => {
    expect(bahtText(1250.5)).toBe('หนึ่งพันสองร้อยห้าสิบบาทห้าสิบสตางค์');
  });

  it('handles zero baht', () => {
    expect(bahtText(0)).toBe('ศูนย์บาทถ้วน');
  });
});

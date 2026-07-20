import { isbn10ToIsbn13, normalizeIsbn } from './isbn.util';

describe('isbn.util', () => {
  describe('normalizeIsbn', () => {
    it('ハイフン・空白を除去する', () => {
      expect(normalizeIsbn('978-4-06-535155-0')).toBe('9784065351550');
      expect(normalizeIsbn('978 4 06 535155 0')).toBe('9784065351550');
    });

    it('末尾チェックディジットのXは大文字のまま残す', () => {
      expect(normalizeIsbn('4-06-535155-x')).toBe('406535155X');
    });
  });

  describe('isbn10ToIsbn13', () => {
    it('既知のISBN-10/13ペアで正しく変換する', () => {
      // ISBN-10: 4-06-535155-2 → ISBN-13: 978-4-06-535155-0
      expect(isbn10ToIsbn13('4065351552')).toBe('9784065351550');
    });

    it('ハイフン付きISBN-10も変換できる', () => {
      expect(isbn10ToIsbn13('4-06-535155-2')).toBe('9784065351550');
    });

    it('10桁でない不正な入力はnullを返す', () => {
      expect(isbn10ToIsbn13('12345')).toBeNull();
      expect(isbn10ToIsbn13('')).toBeNull();
    });
  });
});

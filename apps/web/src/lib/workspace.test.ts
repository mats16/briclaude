import { describe, it, expect } from 'vitest';
import {
  extractNameFromPath,
  splitPathToSegments,
  sanitizePath,
  isValidPath,
  safeSanitizePath,
  MAX_RECENT_WORKSPACES,
  BREADCRUMB_SEGMENT_MAX_WIDTH,
  BREADCRUMB_LAST_SEGMENT_MAX_WIDTH,
} from './workspace';

describe('extractNameFromPath', () => {
  it('パスから最後のセグメントを抽出する', () => {
    expect(extractNameFromPath('/Workspace/Users/john/project')).toBe('project');
  });

  it('ルートパスの場合、そのセグメント名を返す', () => {
    expect(extractNameFromPath('/Workspace')).toBe('Workspace');
  });

  it('深いパスでも正しく動作する', () => {
    expect(extractNameFromPath('/Workspace/Users/john/projects/my-app/src')).toBe('src');
  });

  it('空文字列の場合、空文字列を返す', () => {
    expect(extractNameFromPath('')).toBe('');
  });

  it('スラッシュのみの場合、空文字列を返す', () => {
    expect(extractNameFromPath('/')).toBe('');
  });

  it('末尾にスラッシュがあっても正しく動作する', () => {
    expect(extractNameFromPath('/Workspace/Users/john/')).toBe('john');
  });
});

describe('splitPathToSegments', () => {
  it('パスをセグメントに分割する', () => {
    const result = splitPathToSegments('/Workspace/Users/john');
    expect(result).toEqual([
      { name: 'Workspace', path: '/Workspace' },
      { name: 'Users', path: '/Workspace/Users' },
      { name: 'john', path: '/Workspace/Users/john' },
    ]);
  });

  it('単一セグメントのパスを処理する', () => {
    const result = splitPathToSegments('/Workspace');
    expect(result).toEqual([{ name: 'Workspace', path: '/Workspace' }]);
  });

  it('空文字列の場合、空配列を返す', () => {
    const result = splitPathToSegments('');
    expect(result).toEqual([]);
  });

  it('スラッシュのみの場合、空配列を返す', () => {
    const result = splitPathToSegments('/');
    expect(result).toEqual([]);
  });
});

describe('sanitizePath', () => {
  describe('正常系', () => {
    it('有効なパスをそのまま返す', () => {
      expect(sanitizePath('/Workspace/Users/john')).toBe('/Workspace/Users/john');
    });

    it('/Repos で始まるパスも有効', () => {
      expect(sanitizePath('/Repos/my-repo')).toBe('/Repos/my-repo');
    });

    it('連続するスラッシュを正規化する', () => {
      expect(sanitizePath('/Workspace//Users///john')).toBe('/Workspace/Users/john');
    });

    it('末尾のスラッシュを削除する', () => {
      expect(sanitizePath('/Workspace/Users/john/')).toBe('/Workspace/Users/john');
    });

    it('前後の空白をトリムする', () => {
      expect(sanitizePath('  /Workspace/Users/john  ')).toBe('/Workspace/Users/john');
    });

    it('先頭にスラッシュがない場合、追加する', () => {
      expect(sanitizePath('Workspace/Users/john')).toBe('/Workspace/Users/john');
    });
  });

  describe('セキュリティ: パストラバーサル攻撃', () => {
    it('.. を含むパスを拒否する', () => {
      expect(() => sanitizePath('/Workspace/../etc/passwd')).toThrow(
        'Path traversal is not allowed'
      );
    });

    it('中間に .. を含むパスを拒否する', () => {
      expect(() => sanitizePath('/Workspace/Users/../admin')).toThrow(
        'Path traversal is not allowed'
      );
    });

    it('末尾に .. を含むパスを拒否する', () => {
      expect(() => sanitizePath('/Workspace/Users/john/..')).toThrow(
        'Path traversal is not allowed'
      );
    });
  });

  describe('セキュリティ: NULL バイトインジェクション', () => {
    it('NULL バイトを含むパスを拒否する', () => {
      expect(() => sanitizePath('/Workspace/Users\0/john')).toThrow('Invalid path characters');
    });
  });

  describe('セキュリティ: 許可されていないベースパス', () => {
    it('/etc で始まるパスを拒否する', () => {
      expect(() => sanitizePath('/etc/passwd')).toThrow('Path must start with one of');
    });

    it('/home で始まるパスを拒否する', () => {
      expect(() => sanitizePath('/home/user')).toThrow('Path must start with one of');
    });

    it('ルートパスのみを拒否する', () => {
      expect(() => sanitizePath('/')).toThrow('Path must start with one of');
    });
  });

  describe('エラーケース', () => {
    it('空文字列を拒否する', () => {
      expect(() => sanitizePath('')).toThrow('Path is required');
    });

    it('空白のみを拒否する', () => {
      expect(() => sanitizePath('   ')).toThrow('Path is required');
    });
  });
});

describe('isValidPath', () => {
  it('有効なパスの場合、true を返す', () => {
    expect(isValidPath('/Workspace/Users/john')).toBe(true);
  });

  it('無効なパスの場合、false を返す', () => {
    expect(isValidPath('/etc/passwd')).toBe(false);
  });

  it('パストラバーサルを含むパスの場合、false を返す', () => {
    expect(isValidPath('/Workspace/../etc')).toBe(false);
  });

  it('空文字列の場合、false を返す', () => {
    expect(isValidPath('')).toBe(false);
  });
});

describe('safeSanitizePath', () => {
  it('有効なパスをサニタイズして返す', () => {
    expect(safeSanitizePath('/Workspace/Users/john')).toBe('/Workspace/Users/john');
  });

  it('無効なパスの場合、デフォルト値を返す', () => {
    expect(safeSanitizePath('/etc/passwd')).toBe('/Workspace');
  });

  it('カスタムデフォルト値を指定できる', () => {
    expect(safeSanitizePath('/etc/passwd', '/Repos')).toBe('/Repos');
  });

  it('パストラバーサルを含むパスの場合、デフォルト値を返す', () => {
    expect(safeSanitizePath('/Workspace/../etc')).toBe('/Workspace');
  });
});

describe('定数', () => {
  it('MAX_RECENT_WORKSPACES が正の整数である', () => {
    expect(MAX_RECENT_WORKSPACES).toBeGreaterThan(0);
    expect(Number.isInteger(MAX_RECENT_WORKSPACES)).toBe(true);
  });

  it('BREADCRUMB_SEGMENT_MAX_WIDTH が正の数である', () => {
    expect(BREADCRUMB_SEGMENT_MAX_WIDTH).toBeGreaterThan(0);
  });

  it('BREADCRUMB_LAST_SEGMENT_MAX_WIDTH が正の数である', () => {
    expect(BREADCRUMB_LAST_SEGMENT_MAX_WIDTH).toBeGreaterThan(0);
  });

  it('BREADCRUMB_LAST_SEGMENT_MAX_WIDTH が BREADCRUMB_SEGMENT_MAX_WIDTH より大きい', () => {
    expect(BREADCRUMB_LAST_SEGMENT_MAX_WIDTH).toBeGreaterThan(BREADCRUMB_SEGMENT_MAX_WIDTH);
  });
});

# Supply Chain Security Audit Report

**Date**: 2026-03-31
**Project**: briclaude
**Auditor**: Automated (Claude Code)

## Executive Summary

2025年はnpmエコシステムにとって過去最悪のサプライチェーン攻撃の年となりました。本プロジェクトの依存関係を主要インシデントと照合した結果、**侵害されたバージョンのパッケージは検出されませんでした**。ただし、`npm audit` により既知の脆弱性が複数検出されており、対応が推奨されます。

---

## 1. Major npm Supply Chain Incidents (2025-2026)

### 1.1 Chalk/Debug 大規模侵害 (2025年9月8日)

- **影響**: chalk, debug, ansi-styles, strip-ansi, color-convert, supports-color, wrap-ansi 等 18パッケージ
- **侵害バージョン**: chalk@5.6.1, debug@4.4.2, ansi-styles@6.2.2, strip-ansi@7.1.1, color-convert@3.1.1, supports-color@10.2.1, wrap-ansi@9.0.1, ansi-regex@6.2.1 等
- **攻撃手法**: npmjs.help というフィッシングドメインでメンテナの認証情報を窃取
- **被害**: 暗号通貨ウォレットのアドレスを書き換えるクリプトクリッパー型マルウェア
- **週間ダウンロード数**: 26億回以上
- **参考**: [StepSecurity](https://www.stepsecurity.io/blog/20-popular-npm-packages-compromised-chalk-debug-strip-ansi-color-convert-wrap-ansi), [Semgrep](https://semgrep.dev/blog/2025/chalk-debug-and-color-on-npm-compromised-in-new-supply-chain-attack/)

### 1.2 eslint-config-prettier 侵害 (2025年7月18日) - CVE-2025-54313

- **影響**: eslint-config-prettier, eslint-plugin-prettier, synckit, @pkgr/core
- **侵害バージョン**: eslint-config-prettier@8.10.1, @9.1.1, @10.1.6, @10.1.7; eslint-plugin-prettier@4.2.2, @4.2.3
- **攻撃手法**: npnjs.com を使ったフィッシングでnpmトークン窃取
- **被害**: Windows向けトロイの木馬DLL (node-gyp.dll) のRCE
- **参考**: [ZeroPath](https://zeropath.com/blog/cve-2025-54313-eslint-config-prettier-supply-chain-malware), [Snyk](https://security.snyk.io/vuln/SNYK-JS-ESLINTCONFIGPRETTIER-10873299)

### 1.3 Shai-Hulud ワーム (2025年9月〜12月)

- **影響**: @ctrl/tinycolor を起点に194パッケージ、582の侵害バージョン
- **攻撃手法**: 自己増殖型ワーム。パッケージのpackage.jsonを改変し、TruffleHogで機密情報を窃取
- **Shai-Hulud 2.0 (11月)**: 796パッケージ、Bunランタイム悪用、Dead Man's Switch搭載
- **Shai-Hulud 3.0 (12月)**: マルチプラットフォーム対応の進化版
- **参考**: [Unit42](https://unit42.paloaltonetworks.com/npm-supply-chain-attack/), [Socket](https://socket.dev/blog/tinycolor-supply-chain-attack-affects-40-packages)

### 1.4 Nx ビルドシステム侵害 - s1ngularity (2025年8月)

- **影響**: @nrwl/nx, @nx/devkit 等
- **攻撃手法**: GitHub Actions pull_request_target ワークフロー悪用
- **被害**: GitHub/npmトークン、暗号通貨ウォレット、SSHキーの窃取。AIツールの `--dangerously-skip-permissions` フラグ悪用
- **参考**: [TheHackerNews](https://thehackernews.com/2026/03/unc6426-exploits-nx-npm-supply-chain.html)

### 1.5 PackageGate ゼロデイ (2026年1月)

- **影響**: npm, pnpm, vlt, Bun のパッケージマネージャ自体
- **内容**: ライフサイクルスクリプト無効化やロックファイルによる防御を回避する6件のゼロデイ
- **参考**: [Bastion](https://bastion.tech/blog/npm-supply-chain-attacks-2026-saas-security-guide)

---

## 2. Project Dependency Cross-Reference

### 2.1 Chalk/Debug 関連パッケージ

| Package | Installed Version | Compromised Version | Status |
|---------|------------------|---------------------|--------|
| chalk | 4.1.2 | 5.6.1 | **SAFE** |
| debug | 4.4.3 | 4.4.2 | **SAFE** (修正版) |
| ansi-styles | 4.3.0 / 5.2.0 | 6.2.2 | **SAFE** |
| color-convert | 2.0.1 | 3.1.1 | **SAFE** |
| supports-color | 7.2.0 | 10.2.1 | **SAFE** |
| ansi-regex | 5.0.1 | 6.2.1 | **SAFE** |
| strip-ansi | (not installed) | 7.1.1 | **SAFE** |

### 2.2 ESLint/Prettier 関連パッケージ

| Package | Installed Version | Compromised Version | Status |
|---------|------------------|---------------------|--------|
| eslint-config-prettier | 9.1.2 | 8.10.1, 9.1.1, 10.1.6, 10.1.7 | **SAFE** (修正版) |
| eslint-plugin-prettier | (not installed) | 4.2.2, 4.2.3 | **SAFE** |

### 2.3 その他の関連パッケージ

| Package | Status |
|---------|--------|
| nx / @nrwl/nx | Not installed - **SAFE** |
| @ctrl/tinycolor | Not installed - **SAFE** |
| @anthropic-ai/claude-agent-sdk | No known compromise - **SAFE** |
| openai | No known compromise - **SAFE** |
| fastify | No known compromise - **SAFE** (脆弱性あり、下記参照) |
| vite | No known compromise - **SAFE** (vite-plugin-httpfile は影響、本体は無関係) |

---

## 3. npm audit Results

`npm audit` により以下の既知の脆弱性が検出されました (サプライチェーン攻撃とは異なるが対応推奨):

| Package | Severity | Issue |
|---------|----------|-------|
| **fastify** <=5.8.2 | **High** | DoS (sendWebStream), Content-Type バリデーション bypass, X-Forwarded ヘッダー偽装 |
| **rollup** 4.0.0-4.58.0 | **High** | パストラバーサルによる任意ファイル書き込み |
| **flatted** <=3.4.1 | **High** | 無限再帰DoS, Prototype Pollution |
| **@isaacs/brace-expansion** 5.0.0 | **High** | Uncontrolled Resource Consumption |
| **minimatch** <=3.1.3 | **High** | 複数のReDoS脆弱性 |
| **picomatch** <=2.3.1 | **High** | Method Injection, ReDoS |
| **dompurify** <=3.3.1 | Moderate | Mutation-XSS |
| **ajv** | Moderate | ReDoS ($data option) |
| **brace-expansion** | Moderate | Zero-step sequence DoS |

**合計: 10件の脆弱性 (High: 6, Moderate: 4)**

### 特に注意が必要な脆弱性

1. **fastify <=5.8.2**: 本プロジェクトのバックエンドフレームワーク。認証ヘッダー (X-Forwarded-*) の偽装が可能な脆弱性を含む。Databricks Apps環境ではプロキシが前段にあるため直接的なリスクは限定的だが、アップデートを推奨。
2. **rollup**: Viteの内部依存。ビルドツールのため本番リスクは低いが、CIパイプラインでの悪用リスクあり。

---

## 4. Recommendations

### 即座に対応すべき事項

1. **`npm audit fix` の実行**: 既知の脆弱性に対するパッチを適用
2. **fastify のアップデート**: v5.8.3以上にアップデートし、ヘッダー偽装脆弱性を解消

### 中期的に対応すべき事項

3. **npm Trusted Publishing (provenance) の導入**: パッケージが検証済みCI/CDから公開されたことを保証
4. **`package-lock.json` の定期監査**: ロックファイルに侵害バージョンが混入していないか確認
5. **`socket.dev` や GitHub Dependabot の導入**: 依存関係のリアルタイム監視
6. **CI/CDでの `npm audit` 自動実行**: ビルドパイプラインにセキュリティチェックを組み込み

### 長期的な対策

7. **SBOM (Software Bill of Materials) の生成**: 依存関係の可視化
8. **npm Granular Access Tokens への移行**: 2025年12月以降、npmはクラシックトークンを廃止。90日期限付きトークンと2FA必須に
9. **依存関係の定期的な棚卸し**: 不要な依存の削除、メンテナンスされていないパッケージの代替検討

---

## 5. Conclusion

本プロジェクトにおいて、2025-2026年の主要なサプライチェーン攻撃による直接的な影響は確認されませんでした。ただし、`npm audit` で検出された既知の脆弱性（特にfastify）への対応は速やかに行うことを推奨します。

npmエコシステム全体のセキュリティ状況は厳しく、自己増殖型ワーム (Shai-Hulud) やパッケージマネージャ自体のゼロデイ (PackageGate) など、従来の防御策を突破する攻撃が出現しています。継続的な監視体制の構築が重要です。

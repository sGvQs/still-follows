# Blue Screen Typing Game — Code Standards

## 1. 目的

このプロジェクトのコード品質を一貫して保つための規約。すべてのコントリビューターはこれを遵守する。

## 2. HTML 規約

### 2.1 インラインスタイルの禁止

- **禁止**: `style="..."` 属性を HTML に直接記述する
- **推奨**: すべてのスタイルは `.css` ファイルでクラスとして定義し、HTML で `class` 属性で参照する

```html
<!-- NG: インラインスタイル -->
<div style="font-size: 16px; color: red; margin: 8px;">Text</div>

<!-- OK: CSS クラス -->
<div class="error-text">Text</div>
```

### 2.2 class 属性の命名規則

- ケバブケース（kebab-case）で命名する
- 意味のある名前をつける（例: `.title-section`, `.action-group`）
- 一重の class のみ許可（ネストされた修飾子を使用しない）

```html
<!-- OK -->
<section class="title-section">
  <button class="difficulty-btn" data-difficulty="easy">EASY</button>
</section>

<!-- NG -->
<section class="title-section big">
  <button class="difficulty-btn easy-btn">EASY</button>
</section>
```

### 2.3 セマンティックタグの優先

- 視覚的な区切りには `div`、論理的な区切りには `section`、`nav`、`article` などを使用する
- 見出しは `h1`〜`h6` を適切に階層化して使用する

### 2.4 データ属性

- JavaScript 側の状態を識別するためにのみ `data-*` 属性を使用する
- 例: `data-difficulty="easy"`, `data-status="active"`

## 3. CSS 規約

### 3.1 変数（CSS Custom Properties）の定義

- 全ページ共通の色、フォント、サイズは `:root` 内に変数として定義する
- 変数名は `--color-{用途}`, `--font-{用途}`, `--size-{用途}` の形式で命名する

```css
:root {
  --color-nav: #1e427f;
  --color-bg: #1a4a8a;
  --color-text: #ffffff;
  --color-text-secondary: rgba(255, 255, 255, 0.55);
  --color-link: #7db1ff;
  --font-display: "UI Sans", "Helvetica Neue", Helvetica, Arial, sans-serif;
  --font-body: "UI Sans", "Helvetica Neue", Helvetica, Arial, sans-serif;
  --radius: 0px;
}
```

### 3.2 変数の使用規則

- HTML で直接色やサイズをハードコードしない
- すべての色・フォント・サイズは CSS 変数を経由して参照する
- 存在しない変数を参照しない（例: `--color-text-primary` は未定義のため使用しない）

### 3.3 セレクタの命名規則

- ケバブケースを使用する（例: `.btn-filled`, `.title-art`）
- モーフィングパターン（BEM風）を採用: `{区块}-{要素}-{modifier}`

```css
/* 例 */
.nav-bar          /* 要素 */
.nav-mode-btn     /* 要素内のボタン */
.btn-filled       /* 修飾子付きボタン */
.title-section    /* セクション */
.difficulty-btn   /* 難易度ボタン */
```

### 3.4 宣言の順序

1. レイアウト系（`display`, `flex`, `grid`, `position`）
2. 寸法系（`width`, `height`, `padding`, `margin`, `gap`）
3. 装飾系（`color`, `background`, `border`, `border-radius`, `box-shadow`）
4. テキスト系（`font-family`, `font-size`, `font-weight`, `line-height`, `text-align`）
5. 動作系（`transition`, `cursor`, `opacity`）

```css
.example {
  /* Layout */
  display: flex;
  align-items: center;

  /* Spacing */
  padding: 12px 24px;
  margin: 0 auto;

  /* Decoration */
  background: var(--color-bg);
  border: 1px solid rgba(255, 255, 255, 0.2);

  /* Text */
  font-family: var(--font-display);
  font-size: 14px;
  color: var(--color-text);

  /* Motion */
  transition: all 0.15s ease;
  cursor: pointer;
}
```

### 3.5 重複の排除

- 同じスタイルが複数の場所で定義されないよう、共通クラスとして抽出する
- ボタンの共通スタイルは `.btn`, `.btn-filled`, `.btn-ghost` などに分離する

### 3.6 補完と一括定義

- ボタン共通のスタイルを `.btn` に定義し、バリエーション（`.btn-filled`, `.btn-ghost`）は追加スタイルのみを記述する

## 4. JavaScript 規約

### 4.1 変数・関数の命名

- 変数: キャメルケース（例: `gameState`, `currentDifficulty`）
- 関数: キャメルケースで動詞を含む（例: `startGame()`, `updateScore()`）
- 定数: アッパーキャメルスネークケース（例: `DIFFICULTY_EASY`, `MAX_TIME`）

### 4.2 イベントリスナー

- 動的に要素を取得・操作する場合は `document.querySelector()` や `document.querySelectorAll()` を使用する
- イベントハンドラは `addEventListener` で統一する（インラインイベント属性 `onclick=""` は禁止）

### 4.3 状態管理

- ゲームの状態は単一オブジェクトで管理する（例: `gameState`）
- DOM 操作は最小限にし、状態変数から画面を再描画する方式を推奨

## 5. ファイル構成

```
blue-screen-typing-game/
├── index.html              # メインページ
├── package.json            # 依存関係・スクリプト定義
├── vite.config.ts          # ビルド設定（SITE_URL から base を導出）
├── public/                 # 静的ファイル（favicon、apple-touch-icon。OGP画像 ogp.png は配置済み）
├── src/seo/                # SEO ロジック（SITE_URL 検証、base 導出、index.html への反映）とテスト
├── src/
│   ├── styles.css          # 全スタイル定義（インラインスタイルの唯一のソース）
│   ├── game.js             # ゲームロジック（タイピング処理、スコア計算）
│   ├── data.js             # 難易度別テキストデータ
│   └── assets/             # アセット（アスキーアート、画像など）
└── docs/
    └── code-standards.md   # この規約書
```

### 5.1 各ファイルの責任

| ファイル | 責任 |
|---------|------|
| `index.html` | ページ構造とセマンティクス |
| `src/styles.css` | すべての視覚的表示（色、フォント、レイアウト） |
| `src/game.js` | ゲームロジック、ユーザー入力処理、状態遷移 |
| `src/data.js` | 難易度別のタイピングテキストデータ |
| `docs/code-standards.md` | 開発規約 |

### 5.2 追加ファイルの場合

- 新たなロジックが必要な場合は `src/` 内に `.js` ファイルを作成する
- 新規のコンポーネントが必要な場合は HTML にセクションを追加し、対応する CSS クラスを `.css` ファイルに追記する
- 説明文書は `docs/` 内に Markdown で保存する

## 6. リントとビルド

### 6.1 ビルド手順

```bash
npm install          # 依存関係のインストール
npm run dev          # 開発サーバー起動（Hot Reload 有効）
npm run build        # 本番ビルド（dist/ 出力）
```

`vite.config.ts` は tsconfig の対象外で型検査されない。ロジックは `src/seo` に置き、実ビルドと plan の出力検証で担保する。

CI（`.github/workflows/plan.yaml`、`main` 宛 PR）では `npm ci` → `npm test` → `npm run build`（ダミー `SITE_URL=https://example.com/sub/`）→ `dist/index.html` のアセットパスが `/sub/assets/` であることの検証を行う。

### 6.2 検証手順

- `npm run build` が成功すること
- ブラウザで `http://localhost:3000/` にアクセスし、スタイルが正しく適用されることを手動で確認する
- コンソールにエラーや警告がないことを確認する

## 7. 違反時の対応

この規約に違反するコードはレビューで却下される。具体的には：

- インラインスタイルが含まれる HTML
- 未定義の CSS 変数を参照している
- セマンティックタグの誤用（見出しの階層崩壊、`div` の濫用）
- JavaScript 内のインラインイベントハンドラ

---

*このドキュメントは Blue Screen Typing Game プロジェクト固有の規約です。プロジェクトの規模に応じて随時更新する。*

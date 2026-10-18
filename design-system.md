# デザインシステム（STILL FOLLOWS）

色、ボタン、フォント、ASCII アートのデザイン上の決まりをまとめたもの。値の出典は `src/game/config.ts`、`src/styles.css`、`src/components/Button.tsx`、`index.html`。

## 1. 色

青い画面（ブルースクリーン）と白だけで作る。使う色は青と白の 2 色。補助文字だけ白の透過（`--color-dim`）を使い、これ以外は足さない。

| 役割 | 値 | トークン |
|------|-----|---------|
| 背景・反転時の文字 | `#1a4a8a` | CSS: `--color-bg` / TS: `COLOR_BG` |
| 文字・線・反転時の背景 | `#ffffff` | `--color-fg` / `COLOR_FG` |
| 補助文字（薄い白） | `rgba(255,255,255,0.7)` | `--color-dim` / `COLOR_DIM` |

- 反転時は背景色と文字色を入れ替える（青地に白文字を、白地に青文字にする）。
- 反転時に入力済みの文字（`Topic.tsx`）は、青を `opacity: 0.7` で薄くする。白の透過ではなく、青の透過。
- 色は `config.ts` と `styles.css` の両方に同じ値で定義している。変えるときは両方を直す。
- 画像・写真・影・グラデーション・角丸は使わない。
- favicon（`public/favicon.svg` など）と OGP 画像は UI の外にある例外。色は青 `#1a4a8a` と白。

## 2. ボタン

共通 `Button`（`src/components/Button.tsx`）だけを使う。生の `<button>` を他に書かない。

- 大きさは 2 通りだけ（`size` で指定）。
  - normal: 文字 10px、padding 4px 12px。補助の操作に使う。
  - large: 文字 14px、padding 8px 20px。主要な操作に使う。
- 共通: 透明背景、白文字、1px の補助色（`--color-dim`）の枠線、角丸なし、フォントは Press Start 2P（`FONT_EN`）。
- ホバー／キーボードフォーカス: 白地・青文字の反転。枠線も青（`--color-bg`）になる（transition なしで瞬時）。
- 色・枠線・カーソル・ホバー反転は `styles.css` の `.btn` に集約する。
- ラベルは英字のみ。

## 3. フォント

フォントは 2 種類を役割で使い分け、フォールバックは置かない（`index.html` で Google Fonts から読み込み）。

| 用途 | フォント | トークン |
|------|---------|---------|
| 日本語の表示 | DotGothic16 | `FONT_JP` |
| 英字・数字・記号 | Press Start 2P | `FONT_EN` |
| ASCII アート | 等幅（Menlo, Consolas, "Courier New", monospace） | `FONT_MONO` |

- 1 つの文字列に日本語と英字が混ざる場合は、文字種ごとにフォントを振り分ける。
- 原則として太字・斜体は使わない。例外は 2 つ。(1) タイトル画面の日本語サブタイトル（`FONT_JP`・18px、`fontWeight: 'bold'`）。(2) JavaScript 無効時だけ表示される `index.html` の `<noscript>` 内の見出し `<h1>`。`.noscript-overlay h1` が font-weight を指定していないため、ブラウザ既定の太字になる。タイトル画面の `<h1>` は `fontWeight: 'normal'` を明示しており太字ではない。斜体の使用箇所はない。
- ボタンの文字は常に Press Start 2P。

## 4. ASCII アート

- 顔・部屋・タイトルは ASCII アートで描く。素材は `src/assets/` のテキストファイル（`title/`、`room/`、`cute/`、`horror/`）に置く。
- 表示は `<pre>` で、`white-space: pre`、フォントは等幅の `FONT_MONO`。文字幅比（`CHAR_RATIO` = 0.6）とブロック文字（`█` など）の表示のため、等幅から変えない。
- 色は白（反転時は青）。アート全体を 1 色で表示する。
- 大きさは `fontSize` で決める。タイトルは 10px・行高 1.3。部屋と顔は行高 = 文字サイズ。
- 顔は大きさ別のファイル（`face25pix.txt` から `face300pix.txt`）を用意している。
- 位置や大きさは `config.ts` / `layout.ts` の定数・関数経由にし、直接数字を散らさない。

# STILL FOLLOWS

シンプルなブラウザタイピングゲーム。PC専用です。

プレイはこちら: https://www.stillfollows.com

A short typing game in the browser. PC only.

## 遊び方

- タイトル画面で難易度（EASY / NORMAL / HARD）のボタンをクリックして開始します。
- 画面に表示される語をローマ字で入力すると撃破できます。
- HP は 3 です。被弾すると減り、0 になるとゲームオーバー。60 秒生き延びるとクリアです。
- 被弾時に画面が一瞬青白く反転します。
- 日本語入力がオンの間は入力が無視されます（タイトル画面に警告が出ます）。
- タイトル画面の LANG ボタンで日本語（JA）と英語（EN）を切り替えられます。

## 動作環境

- PC のブラウザとキーボードが必要です。
- 日本語 IME はオフ推奨です。
- 音が出ます。
- 初回は音声ファイルの読み込みに時間がかかる場合があります。
- 開発には Node 22 などを使います。

## 技術スタック

React 19 / TypeScript / Vite / Vitest

## ローカルでの動かし方

```bash
npm ci          # または npm install
npm run dev     # http://localhost:3000
npm test        # テスト
```

## ビルド

```bash
npm run build   # dist/ に出力
```

## デプロイの概要

GitHub Actions で GitHub Pages に公開します。`main` への push でテスト、ビルド、デプロイを実行し、`main` 宛の PR ではテストとビルドを確認します。公開 URL はリポジトリ変数 `SITE_URL` で設定します。

## クレジット

音声は OtoLogic の素材を使用しています。詳しくは [CREDITS.md](CREDITS.md) を参照してください。

制作: sGvQs（Directed & developed by sGvQs）

音声と制作者の表記は、タイトル画面にもあります。

## ライセンス

コードは MIT ライセンスです（[LICENSE](LICENSE)）。ASCII アートと音声は MIT の対象外で、別扱いです（ASCII アートは All rights reserved、音声は OtoLogic の利用規約に従います）。

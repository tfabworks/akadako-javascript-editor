# AkaDako JavaScript Editor

ブラウザだけで **1つのHTMLページ（CSS / JavaScript 含む）** を書き、
[akadako.js](https://github.com/tfabworks/akadako.js) を使って実機の AkaDako
(STEAM BOX / STEAM Tool) を制御できるエディタです。
画面構成は [akadako-python-editor](https://github.com/tfabworks/akadako-python-editor)
を参考に、明るい配色にしています。

## 使い方

```bash
python3 serve.py     # http://localhost:8771/ を Chrome / Edge で開く
```

（WebMIDI が必要なため file:// では動きません。Chrome / Edge を使ってください）

1. AkaDako を USB で接続し、**「Connect」** をクリック
   → 接続されているセンサーを自動で走査し、**見つかったセンサーを全て**
   右パネルにリアルタイムのグラフで表示します。
2. エディタで HTML ページを編集し、**「Run ▶」**（Ctrl/⌘+Enter）
   → **HTMLページ画面** に切り替わり、ページが動きます。
   ヘッダーの **「Edit / Page」** ボタンでいつでも切り替えられます。
3. **「Sample」** → 接続されている全てのセンサーの値を表示する
   HTML ページを自動生成します。
4. **「Stop ◼」** → ページを止めてエディタに戻ります
   （実行中はページ側がボードを使うため、センサーモニターは一時停止します）。

## 画面

- **左上**: CodeMirror エディタ（HTML/CSS/JS ハイライト、`board.` / `AkaDako.`
  で日本語説明つきの補完、Ctrl+Space でも起動）
- **左下**: コンソール（ページ内の `console.log` / エラーがここに出ます）
- **右**: 「センサー」タブ = 全センサーのライブグラフ /
  「リファレンス」タブ = akadako.js の JavaScript リファレンス
- **Save / Open**: ブラウザの localStorage に保存。編集中の内容は
  自動でドラフト保存され、再訪問時に復元できます。
- **Vibe Coding ✨**: バイブコーディング（準備中。今後 AI によるコード生成を予定）

## 実行のしくみ

- 「Run ▶」でエディタの HTML をそのまま iframe (`srcdoc`) に描画します。
  AkaDako は WebMIDI を使うため、iframe には `allow="midi *"` を付けています。
- ページ内の `console.log` / エラーは、`<head>` に自動挿入される小さな
  ブリッジスクリプトで親のコンソール欄に転送されます。
- `<script src="akadako.js"></script>` は同梱の UMD ビルド
  （グローバル `AkaDako`）を読み込みます。作ったページを別の場所に
  置いて使う場合は、`akadako.js` を同じディレクトリにコピーしてください。

## ファイル構成

```
index.html        エディタ本体（UI・スタイル）
main.js           エディタのロジック（実行 / 接続 / センサー走査 / グラフ / 保存）
akadako-api.js    API カタログ（補完・リファレンス・センサー定義）
akadako.js        akadako.js の UMD ビルド（tfabworks/akadako.js dist より）
vendor/codemirror CodeMirror 5.65.16（自前ホスト）
serve.py          ローカル配信用の簡易サーバー
```

## 対応環境

- WebMIDI が使える Chrome / Edge（PC / Chromebook）。
- SysEx 権限を使うため、接続時に MIDI の許可ダイアログが出ます。

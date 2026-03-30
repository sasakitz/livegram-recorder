# Live Recorder

Instagram・TikTok Liveの配信を録画・保存するChrome拡張機能です。

## 機能

- Instagram Live / TikTok Live の配信をブラウザ上で録画
- 録画時間とファイルサイズのリアルタイム表示
- MP4形式で保存（非対応環境はWebMにフォールバック）
- 音声付き録画（MediaStream APIによる取得）
- プラットフォーム自動検出（Instagram / TikTok でヘッダーカラーを切り替え）

## インストール方法

1. このリポジトリをクローンまたはZIPでダウンロード
2. Chrome で `chrome://extensions/` を開く
3. 右上の「デベロッパーモード」を有効にする
4. 「パッケージ化されていない拡張機能を読み込む」をクリック
5. ダウンロードしたフォルダを選択

## 使い方

1. [Instagram](https://www.instagram.com) または [TikTok](https://www.tiktok.com) のライブ配信ページを開く
2. ツールバーの拡張機能アイコンをクリック
3. 「LIVE検出」バッジが表示されたら「録画開始」ボタンを押す
4. 「録画を停止してダウンロード」ボタンを押すと動画ファイルが自動保存される

保存されるファイル名の形式：
- Instagram: `instagram-live_YYYY-MM-DD_HH-mm-ss.mp4`
- TikTok: `tiktok-live_YYYY-MM-DD_HH-mm-ss.mp4`

## 動作環境

- Google Chrome（推奨）
- Manifest V3 対応

## ファイル構成

```
livegram-recorder/
├── manifest.json    # 拡張機能の設定ファイル
├── background.js    # サービスワーカー
├── content.js       # 録画処理（MediaRecorder API）
├── popup.html       # ポップアップUI
├── popup.js         # ポップアップのロジック
└── icons/           # 拡張機能アイコン
```

## 注意事項

- 本拡張機能は個人利用を目的としています
- Instagram・TikTokの利用規約に従ってご利用ください
- 録画したコンテンツの著作権は配信者に帰属します

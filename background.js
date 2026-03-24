// MV3 サービスワーカー
// コンテンツスクリプトとポップアップ間のメッセージルーティングのみ担当

chrome.runtime.onInstalled.addListener(() => {
  console.log('[LiveRecorder] 拡張機能がインストールされました');
});

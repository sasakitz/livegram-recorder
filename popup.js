(() => {
  'use strict';

  const mainContent = document.getElementById('main-content');
  let pollInterval = null;

  /**
   * 現在のアクティブタブが Instagram かどうかを確認
   */
  async function getActiveInstagramTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url || !tab.url.includes('instagram.com')) {
      return null;
    }
    return tab;
  }

  /**
   * コンテンツスクリプトへメッセージを送信
   */
  async function sendMessage(tabId, action) {
    try {
      return await chrome.tabs.sendMessage(tabId, { action });
    } catch (err) {
      return { success: false, error: 'コンテンツスクリプトと通信できません。ページを再読み込みしてください。' };
    }
  }

  /**
   * 秒数を MM:SS 形式にフォーマット
   */
  function formatDuration(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) {
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  /**
   * ファイルサイズをフォーマット
   */
  function formatFileSize(kb) {
    if (kb < 1024) return `${kb} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
  }

  /**
   * Instagram 以外のページで表示するUI
   */
  function renderNotInstagram() {
    mainContent.innerHTML = `
      <div class="not-instagram">
        <div class="not-instagram-icon">📷</div>
        <div class="not-instagram-text">
          Instagram のページを開いてから<br>この拡張機能を使用してください
        </div>
        <a class="not-instagram-link" href="https://www.instagram.com" target="_blank">
          Instagram を開く
        </a>
      </div>
    `;
  }

  /**
   * メインUIをレンダリング
   */
  function renderMain(status, errorMessage) {
    const { isLive, isRecording, duration, fileSizeKB } = status || {};

    const liveBadge = isLive
      ? `<span class="status-badge badge-live">● LIVE検出</span>`
      : `<span class="status-badge badge-no-live">待機中</span>`;

    const recBadge = isRecording
      ? `<span class="status-badge badge-recording">録画中</span>`
      : `<span class="status-badge badge-idle">停止</span>`;

    const durationHtml = isRecording
      ? `<div class="duration-display">${formatDuration(duration || 0)}</div>
         <div class="filesize-text">${formatFileSize(fileSizeKB || 0)}</div>`
      : `<div class="duration-display" style="color:#333">--:--</div>`;

    const errorHtml = errorMessage
      ? `<div class="message message-error">${errorMessage}</div>`
      : '';

    const hintHtml = !isLive && !isRecording
      ? `<div class="message message-info">Instagram Liveの配信ページで録画ボタンを押してください</div>`
      : '';

    mainContent.innerHTML = `
      <div class="content">
        <div class="status-card">
          <div class="status-row">
            <span class="status-label">ライブ配信</span>
            ${liveBadge}
          </div>
          <div class="status-row">
            <span class="status-label">録画状態</span>
            ${recBadge}
          </div>
          ${durationHtml}
        </div>

        ${isRecording
          ? `<button class="btn btn-stop" id="stop-btn">録画を停止してダウンロード</button>`
          : `<button class="btn btn-start" id="start-btn" ${!isLive ? 'disabled' : ''}>録画開始</button>`
        }

        ${errorHtml}
        ${hintHtml}
      </div>
    `;

    // ボタンのイベントリスナーを設定
    const startBtn = document.getElementById('start-btn');
    const stopBtn = document.getElementById('stop-btn');

    if (startBtn) {
      startBtn.addEventListener('click', handleStart);
    }
    if (stopBtn) {
      stopBtn.addEventListener('click', handleStop);
    }
  }

  let currentTabId = null;

  async function handleStart() {
    if (!currentTabId) return;
    const btn = document.getElementById('start-btn');
    if (btn) {
      btn.disabled = true;
      btn.textContent = '開始中...';
    }
    const result = await sendMessage(currentTabId, 'startRecording');
    if (!result.success) {
      renderMain(await fetchStatus(), result.error);
    } else {
      await updateUI();
    }
  }

  async function handleStop() {
    if (!currentTabId) return;
    const btn = document.getElementById('stop-btn');
    if (btn) {
      btn.disabled = true;
      btn.textContent = '停止中...';
    }
    const result = await sendMessage(currentTabId, 'stopRecording');
    if (!result.success) {
      renderMain(await fetchStatus(), result.error);
    } else {
      // 少し待ってからUIを更新（ダウンロード処理の余裕を持たせる）
      setTimeout(updateUI, 500);
    }
  }

  async function fetchStatus() {
    if (!currentTabId) return null;
    return await sendMessage(currentTabId, 'getStatus');
  }

  async function updateUI() {
    const status = await fetchStatus();
    if (status && status.error && !status.isLive) {
      renderMain({ isLive: false, isRecording: false, duration: 0, fileSizeKB: 0 });
    } else {
      renderMain(status);
    }
  }

  /**
   * 初期化
   */
  async function init() {
    const tab = await getActiveInstagramTab();
    if (!tab) {
      renderNotInstagram();
      return;
    }

    currentTabId = tab.id;

    // コンテンツスクリプトが読み込まれているか確認
    const status = await fetchStatus();
    if (!status || status.error === 'コンテンツスクリプトと通信できません。ページを再読み込みしてください。') {
      renderMain(
        { isLive: false, isRecording: false, duration: 0, fileSizeKB: 0 },
        'ページを再読み込みしてから再試行してください'
      );
      return;
    }

    renderMain(status);

    // 録画中はポーリングでUIを更新
    pollInterval = setInterval(async () => {
      const s = await fetchStatus();
      if (s) renderMain(s);
    }, 1000);
  }

  // ポップアップが閉じられたらポーリングを停止
  window.addEventListener('unload', () => {
    if (pollInterval) clearInterval(pollInterval);
  });

  init();
})();

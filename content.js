(() => {
  'use strict';

  let mediaRecorder = null;
  let recordedChunks = [];
  let recordingStartTime = null;
  let statusInterval = null;
  let selectedMimeType = '';

  /**
   * ページ上の再生中の動画要素を探す
   * Instagram Liveは通常 <video> タグで配信される
   */
  function findLiveVideo() {
    const videos = Array.from(document.querySelectorAll('video'));

    // 再生中かつ十分なデータが読み込まれているものを優先
    const playing = videos.find(
      (v) => !v.paused && !v.ended && v.readyState >= 2 && v.videoWidth > 0
    );
    if (playing) return playing;

    // フォールバック: 最初の動画要素
    return videos.find((v) => v.videoWidth > 0) || videos[0] || null;
  }

  /**
   * MediaRecorder がサポートする最適な mimeType を選択する
   */
  function getSupportedMimeType() {
    const candidates = [
      'video/mp4;codecs=avc1,mp4a.40.2', // Chrome 130+ でサポート
      'video/mp4;codecs=avc1',
      'video/mp4',
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
    ];
    for (const mime of candidates) {
      if (MediaRecorder.isTypeSupported(mime)) return mime;
    }
    return '';
  }

  /**
   * 録画開始
   */
  function startRecording() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      return { success: false, error: '既に録画中です' };
    }

    const video = findLiveVideo();
    if (!video) {
      return { success: false, error: 'Instagram Liveの動画が見つかりません。ライブ配信ページを開いてください。' };
    }

    let stream;
    try {
      stream = video.captureStream();
    } catch (err) {
      return { success: false, error: `ストリームの取得に失敗しました: ${err.message}` };
    }

    // 音声トラックがなければ追加を試みる
    if (stream.getAudioTracks().length === 0) {
      try {
        const audioCtx = new AudioContext();
        const source = audioCtx.createMediaElementSource(video);
        const dest = audioCtx.createMediaStreamDestination();
        source.connect(dest);
        source.connect(audioCtx.destination); // スピーカーへの出力も維持
        dest.stream.getAudioTracks().forEach((track) => stream.addTrack(track));
      } catch (_) {
        // 音声取得に失敗しても映像のみで続行
      }
    }

    const mimeType = getSupportedMimeType();
    const options = mimeType ? { mimeType } : {};

    try {
      mediaRecorder = new MediaRecorder(stream, options);
    } catch (err) {
      return { success: false, error: `MediaRecorder の初期化に失敗しました: ${err.message}` };
    }

    selectedMimeType = mimeType;
    recordedChunks = [];
    recordingStartTime = Date.now();

    mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        recordedChunks.push(e.data);
      }
    };

    mediaRecorder.onstop = () => {
      saveRecording();
    };

    mediaRecorder.onerror = (e) => {
      console.error('[LiveRecorder] MediaRecorder error:', e.error);
    };

    mediaRecorder.start(1000); // 1秒ごとにデータを収集

    return { success: true };
  }

  /**
   * 録画停止
   */
  function stopRecording() {
    if (!mediaRecorder || mediaRecorder.state === 'inactive') {
      return { success: false, error: '録画中ではありません' };
    }
    mediaRecorder.stop();
    return { success: true };
  }

  /**
   * 録画データをファイルとして保存
   */
  function saveRecording() {
    if (recordedChunks.length === 0) {
      console.warn('[LiveRecorder] 保存するデータがありません');
      return;
    }

    const isMP4 = selectedMimeType.startsWith('video/mp4');
    const fileType = isMP4 ? 'video/mp4' : 'video/webm';
    const fileExt = isMP4 ? 'mp4' : 'webm';
    const blob = new Blob(recordedChunks, { type: fileType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const now = new Date();
    const timestamp = now
      .toISOString()
      .replace(/T/, '_')
      .replace(/:/g, '-')
      .replace(/\..+/, '');

    a.href = url;
    a.download = `instagram-live_${timestamp}.${fileExt}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    setTimeout(() => URL.revokeObjectURL(url), 10000);
    recordedChunks = [];
  }

  /**
   * 現在の状態を返す
   */
  function getStatus() {
    const video = findLiveVideo();
    const isLive = !!(video && !video.paused && !video.ended);
    const isRecording = !!(mediaRecorder && mediaRecorder.state === 'recording');
    const duration = isRecording
      ? Math.floor((Date.now() - recordingStartTime) / 1000)
      : 0;
    const fileSizeKB = isRecording
      ? Math.round(recordedChunks.reduce((acc, c) => acc + c.size, 0) / 1024)
      : 0;

    return { isLive, isRecording, duration, fileSizeKB };
  }

  // popup / background からのメッセージを受け取る
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    switch (message.action) {
      case 'getStatus':
        sendResponse(getStatus());
        break;
      case 'startRecording':
        sendResponse(startRecording());
        break;
      case 'stopRecording':
        sendResponse(stopRecording());
        break;
      default:
        sendResponse({ success: false, error: '不明なアクション' });
    }
    return true; // 非同期レスポンスのためtrueを返す
  });
})();

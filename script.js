(function () {
  // 統一以 UTC+8（台灣時間）判斷日期與時段，不受裝置所在時區影響
  function getTaipeiNow() {
    return new Date(Date.now() + 8 * 3600000);
  }
  const now = getTaipeiNow();
  const taipeiHour = now.getUTCHours();

  const val = (id) => document.getElementById(id).value.trim();
  const checkMark = (checked) => (checked ? '✅' : '❌');

  // 日期：自動帶入今天日期 (M/D)
  const dateInput = document.getElementById('date');
  dateInput.value = `${now.getUTCMonth() + 1}/${now.getUTCDate()}`;

  // 時段：晚上6點前自動選1400，6點後自動選2000，仍可手動切換
  const shiftPeriodEl = document.getElementById('shiftPeriod');
  let shiftPeriod = taipeiHour >= 18 ? '2000' : '1400';
  shiftPeriodEl.querySelectorAll('.seg-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.value === shiftPeriod);
  });
  shiftPeriodEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.seg-btn');
    if (!btn) return;
    shiftPeriodEl.querySelectorAll('.seg-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    shiftPeriod = btn.dataset.value;
  });

  // 測溫：晚上6點後自動打勾晚班
  const tempEveningEl = document.getElementById('tempEvening');
  if (taipeiHour >= 18) {
    tempEveningEl.checked = true;
  }

  function buildReportText() {
    const revenue = val('revenue') || '0';
    const tc = val('tc') || '0';
    const ta = val('ta') || '0';
    const webTakeout = val('webTakeout') || '0';
    const selfDelivery = val('selfDelivery') || '0';
    const panda = val('panda') || '0';
    const uber = val('uber') || '0';
    const chicken10 = val('chicken10') || '0';
    const snack59 = val('snack59') || '0';
    const sichuan = val('sichuan') || '0';
    const staffMorning = val('staffMorning') || '1+1';
    const staffEvening = val('staffEvening') || '1+2';
    const hoursEstimate = val('hoursEstimate') || '0';
    const hoursMorningActual = val('hoursMorningActual') || '0';
    const hoursEveningTotal = val('hoursEveningTotal');
    const hoursTraining = val('hoursTraining') || '0';
    const tempMorning = document.getElementById('tempMorning').checked;
    const tempEvening = tempEveningEl.checked;

    const sections = [
      [
        `門市：753`,
        `日期：${dateInput.value}`,
        `時段：${shiftPeriod}`,
      ],
      [
        `業績：${revenue}`,
        `TC：${tc}`,
        `TA：${ta}`,
      ],
      [
        `官網外帶：${webTakeout}`,
        `自送：${selfDelivery}`,
        `Panda：${panda}`,
        `Uber：${uber}`,
      ],
      [
        `10🐔：${chicken10}`,
        `點心加購59$：${snack59}`,
        `川椒：${sichuan}`,
      ],
      [
        `人力：`,
        `　早班：${staffMorning}`,
        `　晚班：${staffEvening}`,
      ],
      [
        `時數：`,
        `　本日預估：${hoursEstimate}`,
        `　早班實際：${hoursMorningActual}`,
        `　晚班總時數：${hoursEveningTotal}`,
        `　訓練時數：${hoursTraining}`,
      ],
      [
        `測溫：`,
        `　早班${checkMark(tempMorning)}`,
        `　晚班${checkMark(tempEvening)}`,
      ],
    ];

    return sections.map((lines) => lines.join('\n')).join('\n\n');
  }

  const toastEl = document.getElementById('toast');
  let toastTimer = null;
  function showToast(message) {
    toastEl.textContent = message;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2200);
  }

  // LINE 等App內建瀏覽器對 Web Share API／Clipboard API 支援不穩定，
  // 因此保留 execCommand 與彈窗作為備援，但主要仍優先使用原生分享選單。
  function tryLegacyCopy(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.top = '-1000px';
    textarea.style.left = '-1000px';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    let success = false;
    try {
      success = document.execCommand('copy');
    } catch (err) {
      success = false;
    }
    document.body.removeChild(textarea);
    return success;
  }

  const shareModalOverlay = document.getElementById('shareModalOverlay');
  const shareModalText = document.getElementById('shareModalText');
  function openShareModal(text) {
    if (!shareModalOverlay || !shareModalText) return;
    shareModalText.value = text;
    shareModalOverlay.hidden = false;
    shareModalText.focus();
    shareModalText.select();
  }
  function closeShareModal() {
    if (!shareModalOverlay) return;
    shareModalOverlay.hidden = true;
  }

  // LINE內建瀏覽器的 Web Share API 支援不穩定（常直接失敗、退回複製），
  // 因此偵測到在LINE內時改用LINE官方的分享網址格式，
  // LINE會直接攔截並開啟原生的「轉傳」選單，不依賴 Web Share API。
  function isLineInAppBrowser() {
    return /\bLine\//i.test(navigator.userAgent);
  }
  function shareViaLine(text) {
    window.location.href = 'https://line.me/R/msg/text/?' + encodeURIComponent(text);
  }

  // 分享按鈕的核心邏輯優先綁定，避免其他區塊（如彈窗）初始化失敗時
  // 連帶讓分享按鈕完全沒有反應。
  const shareBtn = document.getElementById('shareBtn');
  if (shareBtn) {
    shareBtn.addEventListener('click', async () => {
      const text = buildReportText();

      if (isLineInAppBrowser()) {
        shareViaLine(text);
        return;
      }

      if (navigator.share) {
        try {
          await navigator.share({ text });
          return;
        } catch (err) {
          if (err && err.name === 'AbortError') return;
        }
      }

      if (tryLegacyCopy(text)) {
        showToast('已複製到剪貼簿');
        return;
      }

      if (navigator.clipboard && navigator.clipboard.writeText) {
        try {
          await navigator.clipboard.writeText(text);
          showToast('已複製到剪貼簿');
          return;
        } catch (err) {
          // 繼續往下開啟彈窗讓使用者手動複製
        }
      }

      openShareModal(text);
    });
  }

  // 以下為非必要功能（彈窗按鈕、全部展開/收合），個別以 try/catch 隔離，
  // 避免任一區塊出錯時影響上方分享按鈕已完成的綁定。
  try {
    const modalCloseBtn = document.getElementById('modalCloseBtn');
    const modalCopyBtn = document.getElementById('modalCopyBtn');
    if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeShareModal);
    if (modalCopyBtn) {
      modalCopyBtn.addEventListener('click', () => {
        shareModalText.focus();
        shareModalText.select();
        if (tryLegacyCopy(shareModalText.value)) {
          showToast('已複製到剪貼簿');
        } else {
          showToast('請長按內容手動選取複製');
        }
      });
    }
    if (shareModalOverlay) {
      shareModalOverlay.addEventListener('click', (e) => {
        if (e.target === shareModalOverlay) closeShareModal();
      });
    }
  } catch (err) {
    // 彈窗功能非必要，失敗不影響其他功能
  }

  try {
    const allDetails = Array.from(document.querySelectorAll('main.container > details.card'));
    const toggleAllBtn = document.getElementById('toggleAllBtn');
    if (toggleAllBtn && allDetails.length) {
      function refreshToggleAllLabel() {
        const anyClosed = allDetails.some((d) => !d.open);
        toggleAllBtn.textContent = anyClosed ? '全部展開' : '全部收合';
      }
      toggleAllBtn.addEventListener('click', () => {
        const anyClosed = allDetails.some((d) => !d.open);
        allDetails.forEach((d) => { d.open = anyClosed; });
        refreshToggleAllLabel();
      });
      allDetails.forEach((d) => d.addEventListener('toggle', refreshToggleAllLabel));
      refreshToggleAllLabel();
    }
  } catch (err) {
    // 全部展開/收合為非必要功能，失敗不影響其他功能
  }
})();

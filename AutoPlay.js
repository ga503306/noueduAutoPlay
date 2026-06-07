(() => {
  /**
   * 在目前視窗與所有 iframe 裡尋找包含左側目錄 #displayPanel 的 document
   */
  window.findCatalogDoc = function findCatalogDoc(win = window) {
    try {
      // 如果目前視窗的 document 裡有左側目錄，就回傳這個 document
      if (win.document.querySelector("#displayPanel")) return win.document;

      // 遞迴搜尋所有 iframe
      for (let i = 0; i < win.frames.length; i++) {
        const doc = findCatalogDoc(win.frames[i]);
        if (doc) return doc;
      }
    } catch {}

    // 找不到或跨網域存取失敗時回傳 null
    return null;
  };

  /**
   * 在目前視窗與所有 iframe 裡尋找 video 元素
   */
  window.findVideo = function findVideo(win = window) {
    try {
      // 如果目前 document 有 video，就回傳
      const video = win.document.querySelector("video");
      if (video) return video;

      // 遞迴搜尋所有 iframe
      for (let i = 0; i < win.frames.length; i++) {
        const found = findVideo(win.frames[i]);
        if (found) return found;
      }
    } catch {}

    // 找不到或跨網域存取失敗時回傳 null
    return null;
  };

  /**
   * 取得左側課程目錄中的所有課程項目
   */
  window.getCourseItems = function getCourseItems() {
    const doc = window.findCatalogDoc();

    // 找不到左側目錄時，回傳空陣列
    if (!doc) {
      console.log("找不到左側目錄 #displayPanel");
      return [];
    }

    return [...doc.querySelectorAll('#displayPanel li[id^="ITEM-"]')]
      .map((li, index) => {
        const a = li.querySelector("a[title]");

        return {
          index,
          id: li.id,
          title: a?.title?.trim() || "",
          text: a?.innerText?.trim().replace(/\s+/g, " ") || "",
          selected: li.classList.contains("selected"),
          li,
          a,
        };
      })
      // 過濾掉沒有 title 或文字內容的項目
      .filter(item => item.title || item.text);
  };

  /**
   * 取得目前選取的課程項目，以及下一個課程項目
   */
  window.getCurrentAndNextItem = function getCurrentAndNextItem() {
    const items = window.getCourseItems();
    const currentIndex = items.findIndex(item => item.selected);

    return {
      items,
      currentIndex,
      currentItem: items[currentIndex],
      nextItem: items[currentIndex + 1],
    };
  };

  /**
   * 綁定目前影片的 ended 事件
   * 影片播放結束後，標示並點擊下一個課程項目
   */
  window.bindCurrentVideoReminder = function bindCurrentVideoReminder() {
    const video = window.findVideo();

    // 找不到 video 時不綁定
    if (!video) return false;

    // 避免同一個 video 重複綁定 ended 事件
    if (video.dataset.endedReminderBound === "1") {
      return true;
    }

    video.dataset.endedReminderBound = "1";

    video.addEventListener("ended", () => {
      const { currentIndex, currentItem, nextItem } = window.getCurrentAndNextItem();

      console.log("影片結束");
      console.log("目前 index:", currentIndex);
      console.log("目前項目:", currentItem);
      console.log("下一個項目:", nextItem);

      // 如果有下一個項目，標示它並捲動到畫面中央
      if (nextItem?.li) {
        nextItem.li.style.outline = "3px solid #ff9800";
        nextItem.li.style.backgroundColor = "#fff7e6";
        nextItem.li.scrollIntoView({ block: "center" });
      }
      // 綁定後延遲 1 秒自動播放影片
      setTimeout(function () {
       // 點擊下一個項目
        nextItem.a.click();
      }, 20000); // 20000 毫秒 = 20 秒
    });

    console.log("已自動綁定 video：", video);

    // 綁定後延遲 1 秒自動播放影片
    setTimeout(function () {
      video.play();
    }, 1000); // 1000 毫秒 = 1 秒

    return true;
  };

  /**
   * 啟動自動重綁機制
   * 每秒重新嘗試尋找並綁定目前的 video
   */
  window.startAutoRebindVideoReminder = function startAutoRebindVideoReminder() {
    // 如果 timer 已存在，代表已經啟動
    if (window.videoReminderTimer) {
      console.log("自動重綁已經啟動");
      return;
    }

    // 先立即綁定一次
    window.bindCurrentVideoReminder();

    // 每秒嘗試重新綁定一次
    window.videoReminderTimer = setInterval(() => {
      window.bindCurrentVideoReminder();
    }, 1000);

    console.log("已啟動 top-frame 自動重綁影片結束提醒");
  };

  /**
   * 停止自動重綁機制
   */
  window.stopAutoRebindVideoReminder = function stopAutoRebindVideoReminder() {
    clearInterval(window.videoReminderTimer);
    window.videoReminderTimer = null;

    console.log("已停止自動重綁");
  };

  // 立即啟動自動重綁
  window.startAutoRebindVideoReminder();
})();

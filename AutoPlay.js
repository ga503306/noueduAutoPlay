(() => {
  const STORAGE_KEY = "autoClickCourseItemId";
  const CLICK_DELAY_MS = 3000;
  const BIND_INTERVAL_MS = 1000;
  const PLAY_DELAY_MS = 1000;
  const RESUME_CLICK_DELAY_MS = 1000;

  /**
   * 在目前視窗與所有 iframe 裡尋找符合 selector 的第一個元素。
   * 遇到跨網域 iframe 時會略過。
   */
  function findElementDeep(selector, win = window) {
    try {
      const element = win.document.querySelector(selector);
      if (element) {
        return element;
      }

      for (let i = 0; i < win.frames.length; i++) {
        const found = findElementDeep(selector, win.frames[i]);
        if (found) {
          return found;
        }
      }
    } catch (error) {
      return null;
    }

    return null;
  }

  /**
   * 在目前視窗與所有 iframe 裡尋找包含左側目錄 #displayPanel 的 document。
   */
  window.findCatalogDoc = function findCatalogDoc(win = window) {
    try {
      if (win.document.querySelector("#displayPanel")) {
        return win.document;
      }

      for (let i = 0; i < win.frames.length; i++) {
        const doc = findCatalogDoc(win.frames[i]);
        if (doc) {
          return doc;
        }
      }
    } catch (error) {
      return null;
    }

    return null;
  };

  /**
   * 在目前視窗與所有 iframe 裡尋找 video 元素。
   */
  window.findVideo = function findVideo() {
    return findElementDeep("video");
  };

  /**
   * 取得左側課程目錄中的所有課程項目。
   */
  window.getCourseItems = function getCourseItems() {
    const doc = window.findCatalogDoc();

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
      .filter((item) => item.title || item.text);
  };

  /**
   * 取得目前選取的課程項目，以及下一個課程項目。
   */
  window.getCurrentAndNextItem = function getCurrentAndNextItem() {
    const items = window.getCourseItems();
    const currentIndex = items.findIndex((item) => item.selected);

    return {
      items,
      currentIndex,
      currentItem: items[currentIndex],
      nextItem: items[currentIndex + 1],
    };
  };

  /**
   * 標示下一個項目，方便確認稍後要點擊的節點。
   */
  window.markCourseItem = function markCourseItem(item) {
    if (!item?.li) {
      return;
    }

    item.li.style.outline = "3px solid #ff9800";
    item.li.style.backgroundColor = "#fff7e6";
    item.li.scrollIntoView({ block: "center" });
  };

  /**
   * 儲存稍後要點擊的課程項目。
   * 如果平台觸發 location.reload()，reload 後仍可恢復。
   */
  window.rememberCourseItemToClick = function rememberCourseItemToClick(item) {
    if (!item?.id) {
      return false;
    }

    sessionStorage.setItem(STORAGE_KEY, item.id);
    console.log("已記住 reload 後要點擊的項目:", item.id, item.title || item.text);
    return true;
  };

  /**
   * 點擊課程項目。
   */
  window.clickCourseItem = function clickCourseItem(item) {
    if (!item?.a) {
      console.log("沒有可點擊的下一個項目");
      return false;
    }

    window.rememberCourseItemToClick(item);
    item.a.click();
    return true;
  };

  /**
   * reload 後自動恢復原本準備點擊的課程項目。
   */
  window.resumeAutoClickAfterReload = function resumeAutoClickAfterReload() {
    const itemId = sessionStorage.getItem(STORAGE_KEY);
    if (!itemId) {
      return false;
    }

    const doc = window.findCatalogDoc();
    if (!doc) {
      return false;
    }

    const li = doc.getElementById(itemId);
    const a = li?.querySelector("a[title]");

    if (!a) {
      return false;
    }

    sessionStorage.removeItem(STORAGE_KEY);

    console.log("reload 後恢復點擊:", itemId, a.title || a.innerText);

    setTimeout(() => {
      a.click();
    }, RESUME_CLICK_DELAY_MS);

    return true;
  };

  /**
   * 綁定目前影片的 ended 事件。
   * 影片播放結束後，先記住下一個項目，等待平台 60 秒紀錄，再點擊下一個項目。
   */
  window.bindCurrentVideoReminder = function bindCurrentVideoReminder() {
    const video = window.findVideo();

    if (!video) {
      return false;
    }

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

      if (!nextItem?.a) {
        console.log("已經沒有下一個課程項目");
        return;
      }

      window.markCourseItem(nextItem);
      window.rememberCourseItemToClick(nextItem);

      setTimeout(() => {
        window.clickCourseItem(nextItem);
      }, CLICK_DELAY_MS);
    });

    console.log("已自動綁定 video:", video);

    setTimeout(() => {
      video.play().catch((error) => {
        console.log("影片自動播放失敗，可能需要手動點播放:", error);
      });
    }, PLAY_DELAY_MS);

    return true;
  };

  /**
   * 啟動自動重綁機制。
   * 每秒重新嘗試尋找並綁定目前的 video。
   */
  window.startAutoRebindVideoReminder = function startAutoRebindVideoReminder() {
    if (window.videoReminderTimer) {
      console.log("自動重綁已經啟動");
      return;
    }

    window.resumeAutoClickAfterReload();
    window.bindCurrentVideoReminder();

    window.videoReminderTimer = setInterval(() => {
      window.resumeAutoClickAfterReload();
      window.bindCurrentVideoReminder();
    }, BIND_INTERVAL_MS);

    console.log("已啟動 top-frame 自動重綁影片結束提醒");
  };

  /**
   * 停止自動重綁機制。
   */
  window.stopAutoRebindVideoReminder = function stopAutoRebindVideoReminder() {
    clearInterval(window.videoReminderTimer);
    window.videoReminderTimer = null;

    console.log("已停止自動重綁");
  };

  window.startAutoRebindVideoReminder();
})();

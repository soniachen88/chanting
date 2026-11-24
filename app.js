/* global ChantingLogic */
(function () {
  "use strict";

  var STORAGE_KEY = "chanting-tracker-v1";
  var L = ChantingLogic;

  var ui = {
    data: null,
    modal: null,
    pendingImport: null,
    historyMonth: null,
    selectedDate: null,
    historyId: null,
    toastTimer: 0,
    routeKey: "",
  };

  var SUN_SVG =
    '<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="8" fill="none" stroke="currentColor" stroke-width="2.4"/><g stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M24 6v6M24 36v6M6 24h6M36 24h6M11 11l4.2 4.2M32.8 32.8 37 37M37 11l-4.2 4.2M15.2 32.8 11 37"/></g></svg>';
  var MOON_SVG =
    '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M28 8a14 14 0 1 0 12 20A12 12 0 0 1 28 8z" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/></svg>';
  var BOOK_SVG =
    '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M10 12h12.5A6.5 6.5 0 0 1 29 18.5V38H16a6 6 0 0 0-6 6V12zM38 12H25.5A6.5 6.5 0 0 0 19 18.5V38h13a6 6 0 0 1 6 6V12z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/></svg>';

  function $(id) {
    return document.getElementById(id);
  }

  function esc(value) {
    return String(value).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

  function today() {
    return L.taipeiDate();
  }

  function findScripture(id) {
    var list = ui.data.scriptures;
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  function countsFor(id) {
    return ui.data.counts[id] || {};
  }

  function loadData() {
    var raw = null;
    try {
      raw = localStorage.getItem(STORAGE_KEY);
    } catch (err) {
      return L.defaultState();
    }
    if (!raw) {
      var seeded = L.defaultState();
      persist(seeded);
      return seeded;
    }
    try {
      var parsed = JSON.parse(raw);
      var result = L.normalizeState(parsed);
      if (!result.ok) throw new Error(result.error);
      return result.data;
    } catch (err) {
      try {
        localStorage.setItem(STORAGE_KEY + "-unreadable", raw);
      } catch (ignore) {}
      var fresh = L.defaultState();
      persist(fresh);
      return fresh;
    }
  }

  function persist(data) {
    var payload = data || ui.data;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      return true;
    } catch (err) {
      showToast("無法儲存。請先匯出備份，並確認瀏覽器允許網站儲存資料。");
      return false;
    }
  }

  function showToast(message) {
    var el = $("toast");
    if (!el) return;
    el.hidden = false;
    el.textContent = message;
    window.clearTimeout(ui.toastTimer);
    ui.toastTimer = window.setTimeout(function () {
      el.hidden = true;
    }, 1800);
  }

  function parseRoute() {
    var hash = location.hash.replace(/^#/, "");
    if (!hash || hash === "/") return { name: "home" };
    var parts = hash.split("/").filter(Boolean);
    var name = parts[0];
    var id = parts[1] ? safeDecode(parts[1]) : null;
    if (name === "read" && id) return { name: "read", id: id };
    if (name === "edit" && id) return { name: "edit", id: id };
    if (name === "new") return { name: "edit", id: null };
    if (name === "history") return { name: "history", id: id };
    if (name === "backup" || name === "help") return { name: name };
    return { name: "home" };
  }

  function safeDecode(value) {
    try {
      return decodeURIComponent(value);
    } catch (err) {
      return value;
    }
  }

  function go(hash) {
    if (location.hash === hash) render();
    else location.hash = hash;
  }

  function mark(title) {
    if (title.indexOf("太陰") !== -1) return MOON_SVG;
    if (title.indexOf("太陽") !== -1) return SUN_SVG;
    return BOOK_SVG;
  }

  function allGoalsMet(day) {
    var list = ui.data.scriptures;
    if (!list.length) return false;
    for (var i = 0; i < list.length; i++) {
      if (L.countOn(countsFor(list[i].id), day) < list[i].dailyGoal) return false;
    }
    return true;
  }

  function render(options) {
    options = options || {};
    try {
      renderApp(options);
    } catch (err) {
      console.error(err);
      $("app").textContent = "畫面顯示失敗，請重新整理。";
    }
  }

  function renderApp(options) {
    var route = parseRoute();
    var key = route.name + ":" + (route.id || "");
    var same = key === ui.routeKey;
    ui.routeKey = key;
    var y = options.keepScroll && same ? window.scrollY : 0;
    var html = "";
    if (route.name === "read") html = viewRead(route.id);
    else if (route.name === "edit") html = viewEdit(route.id);
    else if (route.name === "history") html = viewHistory(route.id);
    else if (route.name === "backup") html = viewBackup();
    else if (route.name === "help") html = viewHelp();
    else html = viewHome();
    if (ui.modal) html += renderModal();
    $("app").innerHTML = html;
    document.body.classList.toggle("has-dock", !!document.querySelector(".read-dock"));
    window.scrollTo(0, y);
    var heading = document.querySelector("h1");
    if (heading && !options.keepScroll) {
      heading.setAttribute("tabindex", "-1");
      heading.focus({ preventScroll: true });
    }
  }

  function topbar(title) {
    return (
      '<div class="topbar"><button type="button" class="back" data-action="back">返回</button><h1 class="page-title">' +
      esc(title) +
      "</h1></div>"
    );
  }

  function viewHome() {
    var day = today();
    var cards = ui.data.scriptures
      .map(function (s) {
        return cardHtml(s, day);
      })
      .join("");
    if (!cards) {
      cards = '<p class="empty">還沒有經文。請按「新增經文」加入。</p>';
    }
    var banner = allGoalsMet(day) ? '<p class="banner">今天的功課都圓滿了。</p>' : "";
    var anyCount = false;
    var ids = Object.keys(ui.data.counts);
    for (var i = 0; i < ids.length; i++) {
      if (L.totalCount(ui.data.counts[ids[i]]) > 0) anyCount = true;
    }
    var hint = anyCount
      ? ""
      : '<p class="hint">點經名可看全文。念完按 +1。紀錄存在這台手機裡。</p>';
    return (
      '<header class="hero"><div class="brand"><span class="brand-mark">' +
      SUN_SVG +
      '</span><h1>念經</h1><span class="brand-mark">' +
      MOON_SVG +
      '</span></div><p class="today-line">' +
      esc(L.formatLong(day)) +
      "</p>" +
      banner +
      hint +
      '</header><div class="card-list">' +
      cards +
      '</div><div class="action-grid">' +
      '<button type="button" class="btn" data-action="go" data-href="#/new">新增經文</button>' +
      '<button type="button" class="btn" data-action="go" data-href="#/history">每日紀錄</button>' +
      '<button type="button" class="btn" data-action="go" data-href="#/backup">備份還原</button>' +
      '<button type="button" class="btn" data-action="go" data-href="#/help">使用說明</button>' +
      '</div><p class="quiet">資料只存在這台手機，不會上傳。</p>'
    );
  }

  function cardHtml(s, day) {
    var count = L.countOn(countsFor(s.id), day);
    var goal = s.dailyGoal;
    var pct = L.progressPercent(count, goal);
    var done = count >= goal;
    var streak = L.consecutiveDays(countsFor(s.id), goal, day);
    var total = L.totalCount(countsFor(s.id));
    return (
      '<article class="card' +
      (done ? " done" : "") +
      '"><div class="card-head"><span class="mark">' +
      mark(s.title) +
      "</span><h2>" +
      esc(s.title) +
      '</h2></div><p class="today-count">今日 ' +
      count +
      ' <span class="goal">/ ' +
      goal +
      "</span>" +
      (done ? '<span class="done-word">已達標</span>' : "") +
      '</p><div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="' +
      goal +
      '" aria-valuenow="' +
      Math.min(count, goal) +
      '" aria-label="今日進度"><span style="width:' +
      pct +
      '%"></span></div><p class="meta">累計 ' +
      total +
      " 遍　連續達標 " +
      streak +
      ' 天</p><button type="button" class="stretch" data-action="open" data-id="' +
      esc(s.id) +
      '">開啟' +
      esc(s.title) +
      '</button><div class="card-row"><button type="button" class="btn" data-action="edit" data-id="' +
      esc(s.id) +
      '">編輯</button><button type="button" class="btn btn-primary grow" data-action="inc" data-id="' +
      esc(s.id) +
      '">念完 +1</button></div></article>'
    );
  }

  function viewRead(id) {
    var s = findScripture(id);
    if (!s) return missing("找不到這部經。");
    var day = today();
    var count = L.countOn(countsFor(s.id), day);
    var total = L.totalCount(countsFor(s.id));
    var streak = L.consecutiveDays(countsFor(s.id), s.dailyGoal, day);
    var blocks = L.sentenceBlocks(s.text);
    var body = blocks.length
      ? blocks
          .map(function (line) {
            return '<p class="sutra-line">' + esc(line) + "</p>";
          })
          .join("")
      : '<p class="empty">這部經還沒有貼上經文。您仍可以計數，或按「編輯」補上全文。</p>';
    var done = count >= s.dailyGoal;
    return (
      topbar(s.title) +
      '<p class="read-stats"><span>累計 ' +
      total +
      " 遍</span><span>連續達標 " +
      streak +
      ' 天</span><button type="button" class="btn" data-action="edit" data-id="' +
      esc(s.id) +
      '">編輯</button></p><article class="sutra" lang="zh-Hant">' +
      body +
      '</article><div class="dock read-dock"><div class="dock-inner"><p class="dock-count">今日 ' +
      count +
      " / " +
      s.dailyGoal +
      (done ? "　已達標" : "") +
      '</p><div class="dock-actions"><button type="button" class="btn" data-action="dec" data-id="' +
      esc(s.id) +
      '"' +
      (count === 0 ? " disabled" : "") +
      '>撤銷 −1</button><button type="button" class="btn btn-primary" data-action="inc" data-id="' +
      esc(s.id) +
      '">念完一遍 +1</button></div></div></div>'
    );
  }

  function viewEdit(id) {
    var s = id ? findScripture(id) : null;
    if (id && !s) return missing("找不到這部經。");
    var title = s ? s.title : "";
    var goal = s ? s.dailyGoal : 7;
    var text = s ? s.text : "";
    var heading = s ? "編輯經文" : "新增經文";
    var del = s
      ? '<button type="button" class="btn btn-quiet" data-action="delete-ask" data-id="' +
        esc(s.id) +
        '">刪除這部經</button>'
      : "";
    return (
      topbar(heading) +
      '<form id="scripture-form" class="stack" method="post" action="index.html">' +
      (s ? '<input type="hidden" name="scriptureId" value="' + esc(s.id) + '">' : "") +
      '<div class="field"><label for="title">經名</label><input id="title" name="title" type="text" maxlength="80" required autocomplete="off" spellcheck="false" value="' +
      esc(title) +
      '" placeholder="例如：心經"></div>' +
      '<div class="field"><label for="goal">每日目標（遍）</label><input id="goal" name="goal" type="number" inputmode="numeric" min="1" max="999" step="1" required value="' +
      goal +
      '"></div>' +
      '<div class="field"><label for="body">經文全文（可不填）</label><textarea id="body" name="body" spellcheck="false" autocapitalize="off" autocomplete="off" placeholder="可貼上全文，也可以先留空。">' +
      esc(text) +
      '</textarea></div><p class="form-error" id="form-error"></p><div class="btn-row"><button type="button" class="btn" data-action="back">取消</button><button type="submit" class="btn btn-primary grow">儲存</button></div>' +
      del +
      "</form>"
    );
  }

  function viewHistory(routeId) {
    if (!ui.data.scriptures.length) {
      return topbar("每日紀錄") + '<p class="empty">還沒有經文。請先新增。</p>';
    }
    var currentId = routeId && findScripture(routeId) ? routeId : ui.data.scriptures[0].id;
    if (ui.historyId !== currentId) {
      ui.historyId = currentId;
      ui.selectedDate = null;
    }
    var s = findScripture(currentId);
    var day = today();
    if (!ui.historyMonth) ui.historyMonth = day.slice(0, 7);
    var month = ui.historyMonth;
    var atCurrent = month >= day.slice(0, 7);
    var selected = ui.selectedDate;
    if (!selected || selected.slice(0, 7) !== month) {
      selected = month === day.slice(0, 7) ? day : lastSelectable(month, day);
      ui.selectedDate = selected;
    }
    var seg = ui.data.scriptures
      .map(function (item) {
        var on = item.id === s.id;
        return (
          '<button type="button" data-action="pick-scripture" data-id="' +
          esc(item.id) +
          '" aria-selected="' +
          (on ? "true" : "false") +
          '">' +
          esc(item.title) +
          "</button>"
        );
      })
      .join("");
    var cells = L.monthGrid(month);
    var bucket = countsFor(s.id);
    var monthTotal = 0;
    var recorded = [];
    var cal = cells
      .map(function (iso) {
        if (!iso) return '<span class="day-pad"></span>';
        var count = L.countOn(bucket, iso);
        if (count && iso.slice(0, 7) === month) {
          monthTotal += count;
          recorded.push(iso);
        }
        var future = iso > day;
        var cls = "day";
        if (count > 0) cls += " has";
        if (count >= s.dailyGoal) cls += " met";
        if (iso === day) cls += " today";
        if (iso === selected) cls += " selected";
        var label = Number(iso.slice(8)) + "日";
        if (count) label += "，" + count + "遍";
        return (
          '<button type="button" class="' +
          cls +
          '" data-action="pick-day" data-date="' +
          iso +
          '"' +
          (future ? " disabled" : "") +
          ' aria-label="' +
          esc(label) +
          '"><span class="n">' +
          Number(iso.slice(8)) +
          '</span><span class="c">' +
          (count ? String(count) : "") +
          "</span></button>"
        );
      })
      .join("");
    recorded.sort().reverse();
    var list = recorded.length
      ? '<ul class="day-list">' +
        recorded
          .map(function (iso) {
            var count = L.countOn(bucket, iso);
            var met = count >= s.dailyGoal ? "已達標" : "";
            return "<li><span>" + esc(L.formatDay(iso)) + "</span><span>" + count + " 遍" + (met ? "　" + met : "") + "</span></li>";
          })
          .join("") +
        "</ul>"
      : '<p class="empty">這個月還沒有紀錄。</p>';
    var selectedCount = selected ? L.countOn(bucket, selected) : 0;
    var adjust = selected
      ? '<div class="adjust"><p>' +
        esc(L.formatDay(selected)) +
        "　" +
        selectedCount +
        ' 遍</p><div class="btn-row"><button type="button" class="btn" data-action="adjust" data-id="' +
        esc(s.id) +
        '" data-date="' +
        selected +
        '" data-delta="-1"' +
        (selectedCount === 0 ? " disabled" : "") +
        '>−1</button><button type="button" class="btn btn-primary grow" data-action="adjust" data-id="' +
        esc(s.id) +
        '" data-date="' +
        selected +
        '" data-delta="1">+1</button></div></div>'
      : "";
    return (
      topbar("每日紀錄") +
      '<div class="seg" role="tablist">' +
      seg +
      '</div><div class="month-bar"><button type="button" class="btn" data-action="month" data-delta="-1">上個月</button><strong>' +
      esc(L.formatMonth(month)) +
      '</strong><button type="button" class="btn" data-action="month" data-delta="1"' +
      (atCurrent ? " disabled" : "") +
      '>下個月</button></div><p class="legend">金色是有念過，綠色是達標。本月共 ' +
      monthTotal +
      ' 遍。點日期可以改遍數。</p><div class="weekdays"><span>日</span><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span></div><div class="cal">' +
      cal +
      "</div>" +
      adjust +
      list
    );
  }

  function lastSelectable(month, day) {
    var cells = L.monthGrid(month).filter(Boolean);
    var last = cells[cells.length - 1];
    return last > day ? day : last;
  }

  function viewBackup() {
    return (
      topbar("備份還原") +
      '<div class="stack"><p class="lede">紀錄存在這台手機裡。換手機、或清除瀏覽資料之前，請先把備份存下來。</p>' +
      '<button type="button" class="btn btn-primary" data-action="export">匯出備份</button>' +
      '<label class="btn file-btn">匯入備份<input id="import-file" type="file" accept="application/json,.json"></label>' +
      '<p class="quiet">匯出時，iPhone 會出現分享畫面。請選「儲存到檔案」，或傳給自己。匯入會用檔案裡的內容取代現在的紀錄。</p></div>'
    );
  }

  function viewHelp() {
    return (
      topbar("使用說明") +
      '<article class="help"><h2>怎麼記一次</h2><p>點經名看全文，念完按底下的「念完一遍 +1」。按錯了按「撤銷 −1」。不想看全文時，首頁卡片上的「念完 +1」也可以記。</p>' +
      "<h2>加入 iPhone 主畫面</h2><ol><li>用 Safari 打開這個網頁。</li><li>點下方分享按鈕（方框加向上箭頭）。</li><li>點「加入主畫面」，再點「加入」。</li><li>之後從主畫面的圖示開啟。</li></ol><p>請先在有網路時打開過一次，沒有網路時才開得了。</p>" +
      "<h2>備份</h2><p>到「備份還原」點「匯出備份」，在分享畫面選「儲存到檔案」或傳給自己。換手機後，用「匯入備份」選取那個檔案。</p>" +
      "<h2>連續天數</h2><p>連續達標是指連續幾天都有念滿當日目標。今天若還沒念完，先從昨天往回算，不會一早就算斷掉。日期以台北時間為準。</p>" +
      "<p class=\"quiet\">資料只存在這台手機，不會上傳。</p></article>"
    );
  }

  function missing(message) {
    return topbar("念經") + '<p class="empty missing">' + esc(message) + "</p>";
  }

  function renderModal() {
    var modal = ui.modal;
    if (!modal) return "";
    if (modal.type === "delete") {
      var s = findScripture(modal.id);
      if (!s) return "";
      return (
        '<div class="modal-back" data-action="modal-cancel"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><h2 id="modal-title">刪除這部經？</h2><p>確定要刪除「' +
        esc(s.title) +
        "」嗎？這部經的念經紀錄也會一起刪掉。若要留底，請先取消，到「備份還原」匯出。</p>" +
        '<div class="stack"><button type="button" class="btn btn-danger" data-action="delete-confirm" data-id="' +
        esc(s.id) +
        '">確定刪除</button><button type="button" class="btn" data-action="modal-cancel">取消</button></div></div></div>'
      );
    }
    if (modal.type === "import" && ui.pendingImport) {
      var data = ui.pendingImport.data;
      var lines = data.scriptures
        .slice(0, 8)
        .map(function (item) {
          return (
            "<li>" +
            esc(item.title) +
            "（累計 " +
            L.totalCount(data.counts[item.id]) +
            " 遍，每日 " +
            item.dailyGoal +
            " 遍）</li>"
          );
        })
        .join("");
      var more =
        data.scriptures.length > 8 ? "<li>另外 " + (data.scriptures.length - 8) + " 部</li>" : "";
      var when = "";
      if (ui.pendingImport.exportedAt) {
        var exportedDate = new Date(ui.pendingImport.exportedAt);
        if (!isNaN(exportedDate.getTime())) {
          when = "<p>備份日期：" + esc(L.formatLong(L.taipeiDate(exportedDate))) + "</p>";
        }
      }
      return (
        '<div class="modal-back" data-action="modal-cancel"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><h2 id="modal-title">匯入這份備份？</h2><p>匯入會取代這台手機上目前的紀錄。若還沒備份現在的資料，請先取消。</p>' +
        when +
        '<ul class="summary-list">' +
        lines +
        more +
        '</ul><div class="stack"><button type="button" class="btn btn-primary" data-action="import-confirm">匯入並取代</button><button type="button" class="btn" data-action="modal-cancel">取消</button></div></div></div>'
      );
    }
    return "";
  }

  function adjust(id, iso, delta) {
    var s = findScripture(id);
    if (!s) return;
    var day = today();
    if (iso > day) {
      showToast("還沒到這一天。");
      return;
    }
    var bucket = ui.data.counts[id] ? Object.assign({}, ui.data.counts[id]) : {};
    var prev = bucket[iso] || 0;
    var next = prev + delta;
    if (next < 0) next = 0;
    if (next > 9999) next = 9999;
    if (next === 0) delete bucket[iso];
    else bucket[iso] = next;
    if (Object.keys(bucket).length) ui.data.counts[id] = bucket;
    else delete ui.data.counts[id];
    persist();
    if (delta > 0 && iso === day && prev < s.dailyGoal && next >= s.dailyGoal) showToast("今日目標達成。");
    else if (delta > 0 && iso === day) showToast("已記下，今日第 " + next + " 遍。");
    else if (delta < 0 && iso === day) showToast(next === 0 ? "已撤銷，今日是 0 遍。" : "已減 1，今日 " + next + " 遍。");
    else showToast("已改為 " + next + " 遍。");
    render({ keepScroll: true });
  }

  function formField(form, name) {
    return form.elements.namedItem(name);
  }

  function saveForm(form) {
    var titleInput = formField(form, "title");
    var goalInput = formField(form, "goal");
    var bodyInput = formField(form, "body");
    var idInput = formField(form, "scriptureId");
    var title = titleInput.value.trim();
    var goal = Number(goalInput.value);
    var text = bodyInput.value.replace(/\r\n/g, "\n");
    var error = $("form-error");
    if (!title) {
      error.textContent = "請填寫經名。";
      titleInput.focus();
      return;
    }
    if (title.length > 80) {
      error.textContent = "經名請在 80 字以內。";
      titleInput.focus();
      return;
    }
    if (!Number.isInteger(goal) || goal < 1 || goal > 999) {
      error.textContent = "每日目標請填 1 到 999 的整數。";
      goalInput.focus();
      return;
    }
    if (text.length > 200000) {
      error.textContent = "經文太長，請縮短一些再儲存。";
      return;
    }
    var id = idInput ? idInput.value : "";
    if (id) {
      var existing = findScripture(id);
      if (!existing) return;
      existing.title = title;
      existing.dailyGoal = goal;
      existing.text = text;
    } else {
      ui.data.scriptures.push({
        id: L.newId(
          ui.data.scriptures.reduce(function (map, item) {
            map[item.id] = true;
            return map;
          }, {})
        ),
        title: title,
        text: text,
        dailyGoal: goal,
        createdAt: new Date().toISOString(),
      });
    }
    persist();
    showToast("已儲存。");
    go("#/");
  }

  function deleteScripture(id) {
    ui.data.scriptures = ui.data.scriptures.filter(function (item) {
      return item.id !== id;
    });
    delete ui.data.counts[id];
    ui.modal = null;
    persist();
    showToast("已刪除。");
    go("#/");
  }

  function downloadText(filename, text) {
    var blob = new Blob([text], { type: "application/json;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 1500);
  }

  function exportBackup() {
    var payload = L.exportPayload(ui.data);
    var json = JSON.stringify(payload, null, 2);
    var filename = "念經備份-" + today() + ".json";
    var file = new File([json], filename, { type: "application/json" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator
        .share({ files: [file], title: "念經備份" })
        .then(function () {
          showToast("請在分享選單裡存到「檔案」。");
        })
        .catch(function (err) {
          if (err && err.name === "AbortError") return;
          downloadText(filename, json);
          showToast("已下載備份檔。");
        });
      return;
    }
    downloadText(filename, json);
    showToast("已下載備份檔。");
  }

  function onImportFile(file) {
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      var parsed;
      try {
        parsed = JSON.parse(String(reader.result || ""));
      } catch (err) {
        showToast("這個檔案不是可用的備份。");
        return;
      }
      var result = L.normalizeState(parsed);
      if (!result.ok) {
        showToast(result.error);
        return;
      }
      ui.pendingImport = {
        data: result.data,
        exportedAt: typeof parsed.exportedAt === "string" ? parsed.exportedAt : "",
      };
      ui.modal = { type: "import" };
      render({ keepScroll: true });
    };
    reader.onerror = function () {
      showToast("無法讀取這個檔案。");
    };
    reader.readAsText(file);
  }

  function onClick(event) {
    var el = event.target.closest("[data-action]");
    if (!el) return;
    var action = el.dataset.action;
    if (action === "modal-cancel" && event.target !== el) return;
    var id = el.dataset.id;
    if (action === "go") {
      go(el.dataset.href);
      return;
    }
    if (action === "back") {
      if (history.length > 1) history.back();
      else go("#/");
      return;
    }
    if (action === "open") {
      go("#/read/" + encodeURIComponent(id));
      return;
    }
    if (action === "edit") {
      go("#/edit/" + encodeURIComponent(id));
      return;
    }
    if (action === "inc") {
      adjust(id, today(), 1);
      return;
    }
    if (action === "dec") {
      adjust(id, today(), -1);
      return;
    }
    if (action === "adjust") {
      adjust(id, el.dataset.date, Number(el.dataset.delta));
      return;
    }
    if (action === "delete-ask") {
      ui.modal = { type: "delete", id: id };
      render({ keepScroll: true });
      return;
    }
    if (action === "delete-confirm") {
      deleteScripture(id);
      return;
    }
    if (action === "modal-cancel") {
      ui.modal = null;
      ui.pendingImport = null;
      render({ keepScroll: true });
      return;
    }
    if (action === "import-confirm" && ui.pendingImport) {
      ui.data = ui.pendingImport.data;
      ui.pendingImport = null;
      ui.modal = null;
      ui.historyId = null;
      ui.selectedDate = null;
      persist();
      showToast("已匯入 " + ui.data.scriptures.length + " 部經文。");
      go("#/");
      return;
    }
    if (action === "export") {
      exportBackup();
      return;
    }
    if (action === "pick-scripture") {
      ui.selectedDate = null;
      go("#/history/" + encodeURIComponent(id));
      return;
    }
    if (action === "pick-day") {
      ui.selectedDate = el.dataset.date;
      render({ keepScroll: true });
      return;
    }
    if (action === "month") {
      shiftMonth(Number(el.dataset.delta));
    }
  }

  function shiftMonth(delta) {
    var bits = (ui.historyMonth || today().slice(0, 7)).split("-");
    var utc = new Date(Date.UTC(Number(bits[0]), Number(bits[1]) - 1 + delta, 1));
    var next = utc.getUTCFullYear() + "-" + String(utc.getUTCMonth() + 1).padStart(2, "0");
    if (next > today().slice(0, 7)) return;
    if (next < "1970-01") return;
    ui.historyMonth = next;
    ui.selectedDate = null;
    render();
  }

  function onSubmit(event) {
    var form = event.target && event.target.tagName === "FORM" ? event.target : null;
    if (form && form.getAttribute("id") === "scripture-form") {
      event.preventDefault();
      saveForm(form);
    }
  }

  function onChange(event) {
    if (event.target && event.target.id === "import-file") {
      var file = event.target.files && event.target.files[0];
      event.target.value = "";
      onImportFile(file);
    }
  }

  function registerWorker() {
    if (!("serviceWorker" in navigator)) return;
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("./sw.js").catch(function () {});
    });
  }

  document.body.addEventListener("click", onClick);
  document.body.addEventListener("submit", onSubmit);
  document.body.addEventListener("change", onChange);
  window.addEventListener("hashchange", function () {
    ui.modal = null;
    render();
  });

  ui.data = loadData();
  render();
  registerWorker();
})();

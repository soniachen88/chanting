/* global globalThis */
// Pure helpers and the two seed scriptures.
// Scripture text is verbatim from 善書圖書館「太陽星君聖經、太陰星君聖經」:
// http://www.taolibrary.com/category/category86/c86011.htm
// Do not normalize variant characters (唸/念、離民、到惹、超昇/超生).
(function (root) {
  "use strict";

  var SUN_TEXT = [
    "太陽明明珠光佛。四大神明正乾坤。太陽日出滿天紅。曉夜行來不住停。行得快來催人老。",
    "行得遲來不留停。家家門前都走過。到惹諸人叫小名。惹得日神歸山去。餓死離民苦眾生。",
    "天上無我無晝夜。地下無我少收成。個個神明有人敬。那個敬我太陽星。太陽三月十九生。",
    "家家唸佛點紅燈。有人傳我太陽經。闔家老幼免災星。無人傳我太陽經。眼前就是地獄門。",
    "太陽明明珠光佛。傳與善男信女們。每日朝朝念七遍。永世不入地獄門。臨終之時生淨土。",
    "九泉七祖盡超生。",
  ].join("\n");

  var MOON_TEXT = [
    "太陰菩薩向東來。十重地獄九重開。十萬八千諸菩薩。諸佛菩薩兩邊排。諸尊佛敬無雲地。",
    "出水蓮花滿地開。頭帶七層珠寶塔。娑婆世界眼光明。一佛報答天地恩。二佛報答父母恩。",
    "在生父母增福壽。過世父母早超昇。",
    "南無佛。南無法。南無僧。南無阿彌陀佛。",
    "天羅神。地羅神。人離難。難離身。一切災殃化為塵。",
    "有人念得七遍太陰經。生死不踏地獄門。",
  ].join("\n");

  var WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];
  var DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  var MONTH_RE = /^\d{4}-\d{2}$/;

  function pad(n) {
    return String(n).padStart(2, "0");
  }

  function taipeiDate(date) {
    var parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Taipei",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date || new Date());
    var map = {};
    for (var i = 0; i < parts.length; i++) map[parts[i].type] = parts[i].value;
    return map.year + "-" + map.month + "-" + map.day;
  }

  function addDays(iso, delta) {
    var bits = iso.split("-");
    var utc = new Date(Date.UTC(Number(bits[0]), Number(bits[1]) - 1, Number(bits[2])));
    utc.setUTCDate(utc.getUTCDate() + delta);
    return utc.getUTCFullYear() + "-" + pad(utc.getUTCMonth() + 1) + "-" + pad(utc.getUTCDate());
  }

  function weekdayIndex(iso) {
    var bits = iso.split("-");
    return new Date(Date.UTC(Number(bits[0]), Number(bits[1]) - 1, Number(bits[2]))).getUTCDay();
  }

  function formatLong(iso) {
    var bits = iso.split("-");
    return (
      Number(bits[0]) +
      "年" +
      Number(bits[1]) +
      "月" +
      Number(bits[2]) +
      "日　星期" +
      WEEKDAYS[weekdayIndex(iso)]
    );
  }

  function formatDay(iso) {
    var bits = iso.split("-");
    return Number(bits[1]) + "月" + Number(bits[2]) + "日　星期" + WEEKDAYS[weekdayIndex(iso)];
  }

  function formatMonth(yearMonth) {
    var bits = yearMonth.split("-");
    return Number(bits[0]) + "年" + Number(bits[1]) + "月";
  }

  function countOn(byDate, iso) {
    if (!byDate || !byDate[iso]) return 0;
    return byDate[iso];
  }

  function totalCount(byDate) {
    if (!byDate) return 0;
    var n = 0;
    var keys = Object.keys(byDate);
    for (var i = 0; i < keys.length; i++) n += byDate[keys[i]];
    return n;
  }

  // Today still counts toward the streak once the goal is met.
  // Before that, today does not break a run that was intact through yesterday.
  function consecutiveDays(byDate, goal, today) {
    var met = function (iso) {
      return countOn(byDate, iso) >= goal;
    };
    var cursor = met(today) ? today : addDays(today, -1);
    var n = 0;
    while (n < 20000 && met(cursor)) {
      n += 1;
      cursor = addDays(cursor, -1);
    }
    return n;
  }

  function progressPercent(count, goal) {
    if (!goal || goal <= 0) return 0;
    return Math.max(0, Math.min(100, Math.round((count / goal) * 100)));
  }

  function monthGrid(yearMonth) {
    if (!MONTH_RE.test(yearMonth || "")) return [];
    var bits = yearMonth.split("-");
    var year = Number(bits[0]);
    var month = Number(bits[1]);
    var days = new Date(Date.UTC(year, month, 0)).getUTCDate();
    var lead = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
    var cells = [];
    var i;
    for (i = 0; i < lead; i++) cells.push(null);
    for (i = 1; i <= days; i++) cells.push(year + "-" + pad(month) + "-" + pad(i));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }

  function sentenceBlocks(text) {
    var normalized = String(text || "").replace(/\r\n/g, "\n");
    var blocks = [];
    var buf = "";
    for (var i = 0; i < normalized.length; i++) {
      var ch = normalized.charAt(i);
      if (ch === "\n" || ch === "\r") {
        if (buf.trim()) blocks.push(buf.trim());
        buf = "";
        continue;
      }
      buf += ch;
      if (ch === "。") {
        if (buf.trim()) blocks.push(buf.trim());
        buf = "";
      }
    }
    if (buf.trim()) blocks.push(buf.trim());
    return blocks;
  }

  function newId(seen) {
    var id;
    do {
      if (root.crypto && typeof root.crypto.randomUUID === "function") id = root.crypto.randomUUID();
      else id = "s-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    } while (seen[id]);
    return id;
  }

  function defaultState() {
    return {
      app: "chanting",
      version: 1,
      scriptures: [
        {
          id: "sun",
          title: "太陽星君聖經",
          text: SUN_TEXT,
          dailyGoal: 7,
          createdAt: "2026-01-01T00:00:00.000Z",
        },
        {
          id: "moon",
          title: "太陰星君聖經",
          text: MOON_TEXT,
          dailyGoal: 7,
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      counts: {},
    };
  }

  function normalizeState(input) {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      return { ok: false, error: "這個檔案不是念經備份。" };
    }
    if (input.app !== "chanting") {
      return { ok: false, error: "這不是念經次數的備份檔。" };
    }
    if (!Array.isArray(input.scriptures)) {
      return { ok: false, error: "備份裡找不到經文清單。" };
    }
    if (input.scriptures.length > 100) {
      return { ok: false, error: "經文數量過多，無法匯入。" };
    }

    var scriptures = [];
    var seen = {};
    var i;
    for (i = 0; i < input.scriptures.length; i++) {
      var item = input.scriptures[i];
      if (!item || typeof item !== "object") continue;
      var title = typeof item.title === "string" ? item.title.trim() : "";
      if (!title) continue;
      var id = typeof item.id === "string" ? item.id.trim() : "";
      if (!id || seen[id] || id.length > 80) id = newId(seen);
      seen[id] = true;
      var goal = Number(item.dailyGoal);
      if (!Number.isInteger(goal) || goal < 1) goal = 7;
      if (goal > 999) goal = 999;
      var text = typeof item.text === "string" ? item.text.replace(/\r\n/g, "\n") : "";
      if (text.length > 200000) text = text.slice(0, 200000);
      scriptures.push({
        id: id,
        title: title.slice(0, 80),
        text: text,
        dailyGoal: goal,
        createdAt: typeof item.createdAt === "string" ? item.createdAt.slice(0, 40) : new Date().toISOString(),
      });
    }

    if (input.scriptures.length > 0 && scriptures.length === 0) {
      return { ok: false, error: "備份裡沒有可用的經文。" };
    }

    var countsIn = input.counts && typeof input.counts === "object" && !Array.isArray(input.counts) ? input.counts : {};
    var counts = {};
    for (i = 0; i < scriptures.length; i++) {
      var sid = scriptures[i].id;
      var src = countsIn[sid];
      if (!src || typeof src !== "object" || Array.isArray(src)) continue;
      var bucket = {};
      var dates = Object.keys(src);
      for (var d = 0; d < dates.length; d++) {
        var date = dates[d];
        if (!DATE_RE.test(date)) continue;
        var n = Number(src[date]);
        if (!Number.isInteger(n) || n < 1 || n > 9999) continue;
        bucket[date] = n;
      }
      if (Object.keys(bucket).length) counts[sid] = bucket;
    }

    return {
      ok: true,
      data: { app: "chanting", version: 1, scriptures: scriptures, counts: counts },
    };
  }

  function exportPayload(data) {
    return {
      app: "chanting",
      version: 1,
      exportedAt: new Date().toISOString(),
      scriptures: data.scriptures,
      counts: data.counts,
    };
  }

  root.ChantingLogic = {
    SUN_TEXT: SUN_TEXT,
    MOON_TEXT: MOON_TEXT,
    taipeiDate: taipeiDate,
    addDays: addDays,
    weekdayIndex: weekdayIndex,
    formatLong: formatLong,
    formatDay: formatDay,
    formatMonth: formatMonth,
    countOn: countOn,
    totalCount: totalCount,
    consecutiveDays: consecutiveDays,
    progressPercent: progressPercent,
    monthGrid: monthGrid,
    sentenceBlocks: sentenceBlocks,
    newId: newId,
    defaultState: defaultState,
    normalizeState: normalizeState,
    exportPayload: exportPayload,
  };
})(typeof globalThis !== "undefined" ? globalThis : this);

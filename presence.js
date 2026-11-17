// Offish 모드 2 서버 판정: 화면 열림 신호 (Offish_backend docs/domain/presence.md "JS 모듈과의 약속").
// Unity 밖에서 돈다. 숨은 탭에서 Unity 루프가 멈춰도 하트비트가 가야 해서다.
// - 하트비트: Web Worker 타이머로 30초마다 POST /api/me/heartbeat {tabId, visible, active, mobile}
// - 활동: 누름·키·터치, focus, 다시 보임, pageshow를 표시해 두었다가 다음 하트비트에 active: true. 보이게 되면 바로 한 번 보낸다
// - 탭 닫힘: pagehide에서 닫힘 비콘 POST /api/me/heartbeat/close?tabId= (식별 헤더 없음, 늘 204)
// - 휴대폰: 화면이 숨으면 바로 닫힘 비콘 (휴대폰은 켜 둔 동안만 센다)
// - 응답 {serverNow, seat, sittingVersion}은 P.last에 두고 P.beats를 올린다. Unity가 읽어 seat가 null이면 다시 입장, sittingVersion이 바뀌면 내 화면을 다시 읽는다
// 기기 식별: 같은 주소의 API면 쿠키(+쓰기에 X-Offish-Client), 다른 주소면 헤더 X-Offish-Device (토큰은 Unity가 넘긴다).
// API 주소: 기본은 같은 주소. 정적 서버로 시험할 때는 ?api=http://localhost:8090, 끄려면 ?api=off.
(function () {
  "use strict";
  var BEAT_MS = 30000;
  var P = window.offishPresence = {};

  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    var b = new Uint8Array(16);
    (window.crypto || window.msCrypto).getRandomValues(b);
    b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
    var h = Array.prototype.map.call(b, function (x) { return (x + 256).toString(16).slice(1); }).join("");
    return h.slice(0, 8) + "-" + h.slice(8, 12) + "-" + h.slice(12, 16) + "-" + h.slice(16, 20) + "-" + h.slice(20);
  }

  P.tabId = uuid();
  P.mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  // "cookie|<주소>" / "header|<주소>" / "off|"
  P.apiConfig = function () {
    var q = null;
    try { q = new URLSearchParams(location.search).get("api"); } catch (e) {}
    if (!q && window.OFFISH_API_BASE) q = window.OFFISH_API_BASE;
    if (q === "off") return "off|";
    if (!q) return "cookie|" + location.origin;
    var base = q.replace(/\/+$/, "");
    var origin = "";
    try { origin = new URL(base, location.href).origin; } catch (e) {}
    return (origin === location.origin ? "cookie|" : "header|") + base;
  };

  var base = "", token = "", running = false, closed = false, active = true, hiddenClosed = false, worker = null, timer = 0;

  function headers() {
    var h = { "Content-Type": "application/json" };
    if (token) h["X-Offish-Device"] = token; else h["X-Offish-Client"] = "1";
    return h;
  }

  function beat() {
    if (!running || closed) return;
    var visible = document.visibilityState === "visible";
    if (P.mobile && !visible) return;
    var body = JSON.stringify({ tabId: P.tabId, visible: visible, active: active, mobile: P.mobile });
    active = false;
    hiddenClosed = false;
    fetch(base + "/api/me/heartbeat", { method: "POST", headers: headers(), body: body, credentials: token ? "omit" : "same-origin" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { if (j) { P.last = j; P.beats = (P.beats || 0) + 1; } })
      .catch(function () {});
  }

  // 닫힘은 식별 헤더 없이 탭 번호만 보낸다 (늘 204). text/plain이라 다른 주소의 API에도 미리 묻기(preflight) 없이 간다
  function sendClose() {
    if (!running) return;
    var url = base + "/api/me/heartbeat/close?tabId=" + encodeURIComponent(P.tabId);
    var body = JSON.stringify({ tabId: P.tabId });
    if (navigator.sendBeacon && navigator.sendBeacon(url, new Blob([body], { type: "text/plain" }))) return;
    try { fetch(url, { method: "POST", body: body, keepalive: true, mode: "no-cors" }).catch(function () {}); } catch (e) {}
  }

  function startTimer() {
    if (worker || timer) return;
    try {
      var src = "setInterval(function () { postMessage(0); }, " + BEAT_MS + ");";
      worker = new Worker(URL.createObjectURL(new Blob([src], { type: "text/javascript" })));
      worker.onmessage = beat;
    } catch (e) {
      timer = setInterval(beat, BEAT_MS); // 워커를 못 쓰면 페이지 타이머 (숨은 탭에서 늦어질 수 있다)
    }
  }

  function markActive() { active = true; }

  ["pointerdown", "keydown", "touchstart"].forEach(function (t) { window.addEventListener(t, markActive, { capture: true, passive: true }); });
  window.addEventListener("focus", function () { active = true; beat(); });
  window.addEventListener("pageshow", function () { active = true; if (hiddenClosed) beat(); });
  window.addEventListener("pagehide", function () { sendClose(); });
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible") { active = true; beat(); return; }
    if (P.mobile && running && !closed) { hiddenClosed = true; sendClose(); }
  });

  // Unity가 입장한 뒤 부른다
  P.start = function (apiBase, deviceToken) {
    base = (apiBase || "").replace(/\/+$/, "");
    token = deviceToken || "";
    running = true;
    closed = false;
    startTimer();
    beat();
  };
  P.setToken = function (t) { token = t || ""; };
  // 확인용 [닫힘 흉내]: 하트비트를 멈추고 닫힘 비콘
  P.close = function () { if (closed) return; closed = true; sendClose(); };
  // [다시 열기]
  P.resume = function () { closed = false; active = true; beat(); };
})();

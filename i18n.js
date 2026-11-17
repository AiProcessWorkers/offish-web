// Offish 웹 템플릿 문구 표 (다국어). Unity 밖 HTML 글자(전체 화면 버튼 이름, 불러오기 실패 안내, <html lang>)를 한국어·영어·일본어로 보인다.
// index.html이 presence.js 앞에서 부른다. 글자 요소에는 data-i18n(글자)·data-i18n-title·data-i18n-aria를 단다.
// 언어 고르기는 Unity(Languages.Pick)와 같다 (L-1, A10): 저장한 선택(localStorage offish.language) > 브라우저 언어 목록(navigator.languages)을
// 차례로 보며 지원하는 첫 언어(태그의 첫 부분: ja-JP → ja) > 영어.
// Unity가 언어를 바꾸면 BrowserLanguage.Remember → OffishLanguage_Remember → offishI18n.set(code)로 알려 준다.
(function () {
  "use strict";
  var KEY = "offish.language";
  var FALLBACK = "en";
  var TABLE = {
    ko: {
      fullscreen: "전체 화면",
      loadFailed: "불러오지 못했어요 · 새로 고침해 주세요"
    },
    en: {
      fullscreen: "Full screen",
      loadFailed: "Couldn't load · Please refresh"
    },
    ja: {
      fullscreen: "全画面",
      loadFailed: "読み込めませんでした · 再読み込みしてください"
    }
  };

  // Object 기본 속성 이름(constructor 등)은 표의 언어·키로 치지 않는다
  function own(obj, k) { return Object.prototype.hasOwnProperty.call(obj, k); }
  function known(code) { return own(TABLE, code); }

  function saved() {
    try { return localStorage.getItem(KEY) || ""; } catch (e) { return ""; }
  }

  // 브라우저 언어 목록을 차례로 본다: "ko-KR", "ko_KR", "ko" → ko. 지원하는 언어가 하나도 없으면 영어
  function fromBrowser() {
    var list = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || ""];
    for (var i = 0; i < list.length; i++) {
      var primary = String(list[i] || "").split(/[-_]/)[0].toLowerCase();
      if (known(primary)) return primary;
    }
    return FALLBACK;
  }

  function pick() {
    var s = saved().toLowerCase();
    return known(s) ? s : fromBrowser();
  }

  var I = window.offishI18n = { lang: pick() };

  // 키의 글 (지금 언어에 없으면 한국어, 그래도 없으면 키)
  I.t = function (key) {
    var row = TABLE[I.lang];
    if (own(row, key)) return row[key];
    return own(TABLE.ko, key) ? TABLE.ko[key] : key;
  };

  // 페이지 글자를 지금 언어로: data-i18n(글자), data-i18n-title(title), data-i18n-aria(aria-label)
  I.apply = function () {
    document.documentElement.lang = I.lang;
    var nodes = document.querySelectorAll("[data-i18n],[data-i18n-title],[data-i18n-aria]");
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      if (n.hasAttribute("data-i18n")) n.textContent = I.t(n.getAttribute("data-i18n"));
      if (n.hasAttribute("data-i18n-title")) n.title = I.t(n.getAttribute("data-i18n-title"));
      if (n.hasAttribute("data-i18n-aria")) n.setAttribute("aria-label", I.t(n.getAttribute("data-i18n-aria")));
    }
  };

  // Unity가 고른 언어를 알려 줄 때 (저장하고 바로 바꾼다)
  I.set = function (code) {
    var c = (code || "").toLowerCase();
    if (!known(c)) return;
    I.lang = c;
    try { localStorage.setItem(KEY, c); } catch (e) {}
    I.apply();
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", I.apply);
  else I.apply();
})();

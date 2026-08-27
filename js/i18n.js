/* ============================================================
 * i18n — 全站中英双语机制
 *
 *   - 静态文本：就近写在元素属性上（中文保留不删）
 *       data-scn / data-en                       → textContent
 *       data-scn-html / data-en-html             → innerHTML（慎用，仅信任内容）
 *       data-scn-placeholder / data-en-placeholder → placeholder
 *       data-scn-aria / data-en-aria             → aria-label
 *   - 动态文本（JS 渲染）：集中写在下方 DICT 字典，I18N.t('key') 取当前语言
 *   - 切换语言：I18N.switchLang('zh' | 'en')（写入 localStorage: site-lang）
 *   - 语言变化后需要重算的动态内容，监听 'i18n:changed' 事件
 * 默认语言：en（中文内容保留在 data-scn / DICT.scn 与 DICT['zh-tcn'] 中）
 * ============================================================ */
(function () {
  'use strict';

  /* ---------- 动态文本字典（静态文本就近写在 data-scn/data-en 上，不进此字典） ---------- */
  var DICT = {
    en: {
      'dp.analyze': 'Analyze',
      'dp.analyzing': 'Analyzing…',
      'dp.alertEmpty': 'Please enter a requirement description.',
      'dp.charUnit': ' chars',
      'dp.yes': 'Yes',
      'dp.no': 'No',
      'dp.period': '.',
      'dp.pointEarned': ' Point earned.',
      'dp.pointNotEarned': ' No point earned.',
      'dp.q1': 'Does it clearly identify a specific user group?',
      'dp.q1.tip': 'Checks whether the description mentions a specific user group, e.g. "new users", "elderly users" or "enterprise admins".',
      'dp.q1.found': 'User group detected: ',
      'dp.q1.notFound': 'No specific user group detected.',
      'dp.q2': 'Does it describe a specific user behavior or pain point?',
      'dp.q2.tip': 'Checks whether the description covers a concrete behavior or pain point, rather than merely mentioning a missing feature.',
      'dp.q2.found': 'User behavior / pain point detected: ',
      'dp.q2.notFound': 'No specific user behavior or pain point detected.',
      'dp.q3': 'Does it state the context / scenario where it happens?',
      'dp.q3.tip': 'Checks for a concrete scenario such as "when checking out" or "while browsing the product list".',
      'dp.q3.found': 'Scenario detected: ',
      'dp.q3.notFound': 'No specific context / scenario detected.',
      'dp.q4': 'Does it avoid including any specific solution or feature?',
      'dp.q4.tip': 'Checks whether the description includes any concrete solution. Any solution keyword means no point for this item.',
      'dp.q4.found': 'Solution keywords detected: ',
      'dp.q4.notFound': 'No specific solution or feature detected.',
      'dp.q5': 'Does the description still stand on its own without the solution?',
      'dp.q5.tip': 'Only when it includes a user group, a user behavior / pain point and a context / scenario can the description stand independently without a solution.',
      'dp.q5.stand': 'The problem does not depend on a specific solution; it still exists even without one.',
      'dp.q5.bound': 'The problem may be bound to a specific solution and may no longer hold without it.',
      'dp.q6': 'Can it be rewritten as an open-ended "How Might We" question?',
      'dp.q6.tip': 'Evaluates whether the description can be turned into an open-ended "How Might We…" question.',
      'dp.q6.found': 'Can be rewritten.',
      'dp.q6.hmwLabel': 'HMW (How Might We) Rewrite: ',
      'dp.q6.notFound': 'The description may lack the necessary elements to be rewritten into an effective HMW question.'
    },
    scn: {
      'dp.analyze': '开始分析',
      'dp.analyzing': '分析中…',
      'dp.alertEmpty': '请输入需求描述内容',
      'dp.charUnit': ' 字',
      'dp.yes': '是',
      'dp.no': '否',
      'dp.period': '。',
      'dp.pointEarned': '此项得分。',
      'dp.pointNotEarned': '此项不得分。',
      'dp.q1': '是否明确指出了具体的用户群体？',
      'dp.q1.tip': '评估描述中是否包含如「新用户」、「老年用户」、「企业管理员」等具体用户群体描述。',
      'dp.q1.found': '检测到用户群体：',
      'dp.q1.notFound': '未检测到具体的用户群体描述。',
      'dp.q2': '是否描述了具体的用户行为或痛点？',
      'dp.q2.tip': '检查是否描述了用户的具体行为或痛点，而不是仅仅提到功能缺失。',
      'dp.q2.found': '检测到用户行为或痛点描述：',
      'dp.q2.notFound': '未检测到具体的用户行为或痛点描述。',
      'dp.q3': '是否说明了发生的情境/场景？',
      'dp.q3.tip': '评估是否包含如「在结账时」、「浏览商品列表时」等具体场景描述。',
      'dp.q3.found': '检测到场景：',
      'dp.q3.notFound': '未检测到具体的情境/场景描述。',
      'dp.q4': '是否没有包含任何具体的解决方案或功能描述？',
      'dp.q4.tip': '检查描述是否包含任何具体的解决方案。只要包含解决方案关键词，此项就不得分。',
      'dp.q4.found': '检测到解决方案关键词：',
      'dp.q4.notFound': '未检测到具体的解决方案或功能描述。',
      'dp.q5': '去掉解决方案后，这个描述还能独立成立吗？',
      'dp.q5.tip': '只有同时包含用户群体、用户行为/痛点以及情境/场景时，描述才能在去掉解决方案后独立成立。',
      'dp.q5.stand': '问题描述不依赖于特定解决方案，即使去掉解决方案部分，问题依然存在。',
      'dp.q5.bound': '问题描述可能与特定解决方案绑定，去掉解决方案后可能不再成立。',
      'dp.q6': '是否可以用「How Might We」形式改写成开放式问题？',
      'dp.q6.tip': '评估描述是否可以转化为「How Might We…」形式的开放式问题。',
      'dp.q6.found': '可以改写。',
      'dp.q6.hmwLabel': 'HMW (How Might We) 改写：',
      'dp.q6.notFound': '当前描述可能缺少必要元素，无法有效改写成 HMW 问题。'
    },
    'zh-tcn': {
      'dp.analyze': '開始分析',
      'dp.analyzing': '分析中…',
      'dp.alertEmpty': '請輸入需求描述內容',
      'dp.charUnit': ' 字',
      'dp.yes': '是',
      'dp.no': '否',
      'dp.period': '。',
      'dp.pointEarned': '此項得分。',
      'dp.pointNotEarned': '此項不得分。',
      'dp.q1': '是否明確指出了具體的用戶群體？',
      'dp.q1.tip': '評估描述中是否包含如「新用戶」、「老年用戶」、「企業管理員」等具體用戶群體描述。',
      'dp.q1.found': '檢測到用戶群體：',
      'dp.q1.notFound': '未檢測到具體的用戶群體描述。',
      'dp.q2': '是否描述了具體的用戶行為或痛點？',
      'dp.q2.tip': '檢查是否描述了用戶的具體行為或痛點，而不是僅僅提到功能缺失。',
      'dp.q2.found': '檢測到用戶行為或痛點描述：',
      'dp.q2.notFound': '未檢測到具體的用戶行為或痛點描述。',
      'dp.q3': '是否說明了發生的情境/場景？',
      'dp.q3.tip': '評估是否包含如「在結賬時」、「瀏覽商品列表時」等具體場景描述。',
      'dp.q3.found': '檢測到場景：',
      'dp.q3.notFound': '未檢測到具體的情境/場景描述。',
      'dp.q4': '是否沒有包含任何具體的解決方案或功能描述？',
      'dp.q4.tip': '檢查描述是否包含任何具體的解決方案。只要包含解決方案關鍵詞，此項就不得分。',
      'dp.q4.found': '檢測到解決方案關鍵詞：',
      'dp.q4.notFound': '未檢測到具體的解決方案或功能描述。',
      'dp.q5': '去掉解決方案後，這個描述還能獨立成立嗎？',
      'dp.q5.tip': '只有同時包含用戶群體、用戶行為/痛點以及情境/場景時，描述才能在去掉解決方案後獨立成立。',
      'dp.q5.stand': '問題描述不依賴於特定解決方案，即使去掉解決方案部分，問題依然存在。',
      'dp.q5.bound': '問題描述可能與特定解決方案綁定，去掉解決方案後可能不再成立。',
      'dp.q6': '是否可以用「How Might We」形式改寫成開放式問題？',
      'dp.q6.tip': '評估描述是否可以轉化為「How Might We…」形式的開放式問題。',
      'dp.q6.found': '可以改寫。',
      'dp.q6.hmwLabel': 'HMW (How Might We) 改寫：',
      'dp.q6.notFound': '當前描述可能缺少必要元素，無法有效改寫成 HMW 問題。'
    }
  };

  var STORAGE_KEY = 'site-lang';
  var W = window;

  W.I18N = { lang: 'en', t: t, apply: apply, switchLang: switchLang, DICT: DICT };

  function currentLang() { return W.I18N.lang; }

  function t(key) {
    var lang = currentLang();
    var dict = DICT[lang] || (lang === 'zh-tcn' ? DICT.scn : DICT.en);
    return dict[key] != null ? dict[key] : key;
  }

  function apply() {
    var lang = currentLang();

    // type: '' | '-html' | '-placeholder' | '-aria'
    function resolveAttr(el, type) {
      if (lang === 'zh-tcn') {
        var hant = el.getAttribute('data-zh-tcn' + type);
        if (hant !== null && hant !== '') return hant;
        return el.getAttribute('data-scn' + type);
      }
      return el.getAttribute('data-' + lang + type);
    }

    /* 静态文本：data-scn / data-zh-tcn / data-en → textContent */
    document.querySelectorAll('[data-scn], [data-zh-tcn], [data-en]').forEach(function (el) {
      var val = resolveAttr(el, '');
      if (val !== null && val !== '') el.textContent = val;
    });

    /* 静态 HTML：data-scn-html / data-zh-tcn-html / data-en-html → innerHTML（仅用于需要内联标签的内容） */
    document.querySelectorAll('[data-scn-html], [data-zh-tcn-html], [data-en-html]').forEach(function (el) {
      var val = resolveAttr(el, '-html');
      if (val !== null && val !== '') el.innerHTML = val;
    });

    /* placeholder */
    document.querySelectorAll('[data-scn-placeholder], [data-zh-tcn-placeholder], [data-en-placeholder]').forEach(function (el) {
      var val = resolveAttr(el, '-placeholder');
      if (val !== null) el.setAttribute('placeholder', val);
    });

    /* aria-label */
    document.querySelectorAll('[data-scn-aria], [data-zh-tcn-aria], [data-en-aria]').forEach(function (el) {
      var val = resolveAttr(el, '-aria');
      if (val !== null) el.setAttribute('aria-label', val);
    });

    if (document.documentElement) document.documentElement.lang = lang;

    /* 通知依赖方（如 validator）重算动态内容 */
    try {
      document.dispatchEvent(new CustomEvent('i18n:changed', { detail: { lang: lang } }));
    } catch (e) { /* ignore */ }
  }

  function switchLang(lang) {
    if (lang !== 'scn' && lang !== 'zh-tcn' && lang !== 'en') lang = 'en';
    W.I18N.lang = lang;
    try { localStorage.setItem(STORAGE_KEY, lang); } catch (e) { /* ignore */ }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () {
        bindLangSwitchers();
        apply();
        updateLangButtonActiveState();
      });
    } else {
      apply();
      updateLangButtonActiveState();
    }
    return lang;
  }

  /* ---------- 语言切换按钮绑定 ---------- */
  // 手机端：点击开关先展开显示全部语言，再由用户手动点选目标语言（不再自动轮切）
  // 桌面端：直接点选对应语言切换
  function bindLangSwitchers() {
    var switchEl = document.querySelector('.lang-switch');
    var langs = ['scn', 'zh-tcn', 'en'];

    // 展开/收起：收起时点击展开；展开时点击空白处收起
    if (switchEl) {
      switchEl.addEventListener('click', function (e) {
        if (window.innerWidth > 1200) return;
        if (!switchEl.classList.contains('is-animating')) {
          switchEl.style.setProperty('--active-index', Math.max(0, langs.indexOf(currentLang())));
          switchEl.classList.add('is-animating');
        } else if (!e.target.closest('.lang-btn')) {
          switchEl.classList.remove('is-animating');
        }
      });
    }

    // 点击具体语言：桌面端直接切换；手机端在展开状态下手动选择
    document.querySelectorAll('.lang-btn[data-lang]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (window.innerWidth > 1200) {
          switchLang(btn.getAttribute('data-lang'));
          return;
        }
        if (!switchEl || !switchEl.classList.contains('is-animating')) return;
        var target = btn.getAttribute('data-lang');
        switchLang(target); // 滑块滑到目标语言、目标文字变粗、其它变细
        setTimeout(function () {
          if (switchEl) switchEl.classList.remove('is-animating');
        }, 420); // 等滑动结束后再收起，只显示所选语言
      });
    });

    // 手机端：点击页面其它区域收起（不切换）
    document.addEventListener('click', function (e) {
      if (window.innerWidth > 768) return;
      if (!switchEl || !switchEl.classList.contains('is-animating')) return;
      if (switchEl.contains(e.target)) return;
      switchEl.classList.remove('is-animating');
    });
  }

  function updateLangButtonActiveState() {
    var lang = currentLang();
    var langs = ['scn', 'zh-tcn', 'en'];
    var idx = langs.indexOf(lang);
    var switchEl = document.querySelector('.lang-switch');
    if (switchEl && idx >= 0) {
      switchEl.style.setProperty('--active-index', idx);
    }
    document.querySelectorAll('.lang-btn[data-lang]').forEach(function (btn) {
      btn.classList.toggle('active', btn.getAttribute('data-lang') === lang);
    });
  }

  /* ---------- 初始化：默认英文；本地有存档则使用 ---------- */
  (function init() {
    var stored = null;
    try { stored = localStorage.getItem(STORAGE_KEY); } catch (e) { /* ignore */ }
    if (stored === 'scn' || stored === 'zh-tcn' || stored === 'en') W.I18N.lang = stored;

    function onReady() {
      bindLangSwitchers();
      apply();
      updateLangButtonActiveState();
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', onReady);
    } else {
      onReady();
    }
  })();
})();

/* ============================================================
 * Problem Validator — Validator 编排总枢纽（M2/M4/M5/M6）
 * 依赖：validator-engine.js（先加载，暴露 window.ValidatorEngine）
 * 来源：FRS → M4 附录 C（Orchestration 参考实现）
 *       script.js 精简适配版（去掉 M5 滚动/打字机/对话框粘性）
 * ============================================================ */
(function () {
  'use strict';

  /* ---------- 辅助函数 ---------- */
  const $ = (sel, root) => (root || document).querySelector(sel);

  /* ---------- ICONOIR 图标（逐字复制 script.js 第 14–18 行） ---------- */
  const ICON = {
    check: '<svg class="iconoir" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M5 13L9 17L19 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    cross: '<svg class="iconoir" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6.75827 17.2426L12.0009 12M17.2435 6.75736L12.0009 12M12.0009 12L6.75827 6.75736M12.0009 12L17.2435 17.2426" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    help:  '<svg class="iconoir" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7.90039 8.07954C7.90039 3.30678 15.4004 3.30682 15.4004 8.07955C15.4004 11.4886 11.9913 10.8067 11.9913 14.8976" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 19.01L12.01 18.9989" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  };

  /* ---------- 会话令牌（防竞态） ---------- */
  let activeSession = 0;

  /* ---------- 对话框吸顶折叠锁（M5 示例点击冻结期间不动，Step 4 使用） ---------- */
  let dialogStyleLocked = false;

  /* ---------- 示例球钉视口跟随（仅结果卡存在时生效，需求 1/2/3/4）---------- */
  let exampleBaseline = null;          // 结果卡出现时的 scrollY：此后 --example-y = scrollY − exampleBaseline 把球钉在视口
  let exampleAnchorTop = null;         // 结果卡出现时示例球的视口 top：钉位目标，确保球始终留在界面内

  /* ---------- 6 题结果 HTML 渲染（文案经 I18N.t 取当前语言，中文保留在 i18n.js DICT.zh） ---------- */
  function buildResultHTML(r) {
    const T = window.I18N ? window.I18N.t : (k) => k;
    const q = (idx, text, tip, yes, detail, passes) => {
      if (passes === undefined) passes = yes;
      return `
      <div class="question-item">
        <div class="question-text">${idx}. ${text}<span class="tooltip-container"><span class="icon-btn tooltip-icon">${ICON.help}</span><span class="tooltip-text">${tip}</span></span></div>
        <div class="result-row">
          <div class="result-icon ${passes ? 'result-yes' : 'result-no'}">${passes ? ICON.check : ICON.cross}</div>
          <div class="result-text">${yes ? T('dp.yes') : T('dp.no')}</div>
        </div>
        ${detail}
      </div>`;
    };

    let html = '';

    // 统一得分后缀：命中（得分情形）→ dp.pointEarned「此项得分。」；未命中 / 反向题命中（不得分情形）→ dp.pointNotEarned「此项不得分。」
    html += q(1, T('dp.q1'), T('dp.q1.tip'), r.hasUserGroup,
      r.details.userGroupFound
        ? `<div class="details">${T('dp.q1.found')}<span class="highlight highlight--success">${r.details.userGroupFound}</span>${T('dp.period')}${T('dp.pointEarned')}</div>`
        : `<div class="details">${T('dp.q1.notFound')}${T('dp.pointNotEarned')}</div>`);

    html += q(2, T('dp.q2'), T('dp.q2.tip'), r.hasUserBehavior,
      r.hasUserBehavior
        ? `<div class="details">${T('dp.q2.found')}<span class="highlight highlight--success">${r.details.behaviorFound}</span>${T('dp.period')}${T('dp.pointEarned')}</div>`
        : `<div class="details">${T('dp.q2.notFound')}${T('dp.pointNotEarned')}</div>`);

    html += q(3, T('dp.q3'), T('dp.q3.tip'), r.hasScenario,
      r.details.scenarioFound
        ? `<div class="details">${T('dp.q3.found')}<span class="highlight highlight--success">${r.details.scenarioFound}</span>${T('dp.period')}${T('dp.pointEarned')}</div>`
        : `<div class="details">${T('dp.q3.notFound')}${T('dp.pointNotEarned')}</div>`);

    html += q(4, T('dp.q4'), T('dp.q4.tip'), !r.hasSolution,
      r.hasSolution
        ? `<div class="details">${T('dp.q4.found')}<span class="highlight highlight--fail">${r.details.solutionFound}</span>${T('dp.period')}${T('dp.pointNotEarned')}</div>`
        : `<div class="details">${T('dp.q4.notFound')}${T('dp.pointEarned')}</div>`);

    html += q(5, T('dp.q5'), T('dp.q5.tip'), r.standsWithoutSolution,
      r.standsWithoutSolution
        ? `<div class="details">${T('dp.q5.stand')}${T('dp.pointEarned')}</div>`
        : `<div class="details">${T('dp.q5.bound')}${T('dp.pointNotEarned')}</div>`);

    html += q(6, T('dp.q6'), T('dp.q6.tip'), r.canBeHMW,
      r.canBeHMW
        ? `<div class="details">${T('dp.q6.found')}${T('dp.pointEarned')}</div><div class="hmw-output"><h3>${T('dp.q6.hmwLabel')}</h3><p>${r.hmwQuestion}</p></div>`
        : `<div class="details">${T('dp.q6.notFound')}${T('dp.pointNotEarned')}</div>`);

    return html;
  }

  /* ---------- DOM 引用 ---------- */
  let textarea, btn, result, resultScoreNum, resultQuestions, resultSkeleton, resultWrap;
  let inputClear, charCount;                        // #inputClear / #charCount（模块级，供 syncClearButton 等复用）
  let glassCardEl = null, glassCardInnerEl = null;   // #analyzer(.glass-card) / .glass-card__inner
  let scrollFrozenY = null;                          // M5 冻结钉位：示例点击/填充时记录的滚动位置
  const isDialogCollapsed = () => (glassCardEl ? glassCardEl.classList.contains('is-collapsed') : false);
  let analysisToggleLocked = false;                  // 分析周期内抑制「吸顶自动折叠/展开」，消除点分析后的闪动
  let runGoodExample = null;                          // 空输入默认加载「优秀示例」的入口（init 时绑定，供 doAnalyze 调用）

  /* 复用：清除按钮可见性 —— 仅在文本框为空时隐藏（折叠/展开态、input 时均走此处，避免多处重复判断） */
  const syncClearButton = () => {
    if (inputClear && textarea) {
      inputClear.hidden = textarea.value.trim().length === 0;
    }
  };

  /* 复用：把 textarea 高度设为完整版下限（2 行）。
     折叠/展开切换、首屏初始化均调用此处，避免「取 lineHeight 设 2 行高度」逻辑重复两套。 */
  const setTextareaFullHeight = () => {
    if (!textarea) return;
    const lineH = parseFloat(getComputedStyle(textarea).lineHeight) || 25.5;
    textarea.style.height = (2 * lineH) + 'px';
  };
  // 过渡/收起结束等时机刷新用的钩子：接受 onDone 回调（参考 intro 滚动重算范式），外部可在结果卡展开/收起动画
  // 完成后回调重算并重新派发 scroll，确保位移夹紧值在最终布局下生效。
  function updateExampleYBounds(onDone) {
    if (onDone) onDone();
  }

  /* ---------- 骨架屏 ---------- */
  let reservedResultH = 0;

  const showResultSkeleton = () => {
    // 切换示例 / 重新分析时，按示例球「当前视口位置」建立跟随基线，
    // 使结果卡切换时球不跳变、持续钉在视口原位（修复：已滚动下点其它球不跟随）。
    // 关键：基线 = 当前 scrollY − 当前 --example-y；渲染时 exY = scrollY − 基线 = 当前 --example-y，球保持原位。
    const _ec = document.querySelector('.example-cards');
    const _currentExY = _ec ? (parseFloat(_ec.dataset.exY) || 0) : 0;
    exampleBaseline = window.scrollY - _currentExY;
    exampleAnchorTop = _ec ? _ec.getBoundingClientRect().top : null;

    if (resultWrap) {
      reservedResultH = resultWrap.scrollHeight;
      resultWrap.style.minHeight = reservedResultH + 'px';
    }
    if (resultSkeleton) resultSkeleton.hidden = false;
    if (result) {
      result.classList.remove('is-revealing', 'is-retracting');
      result.hidden = true;
    }
    updateDialogSticky();   // 骨架屏等待期间：结果卡已隐藏 → 取消吸顶
  };

  const hideResultSkeleton = () => {
    if (resultSkeleton) resultSkeleton.hidden = true;
    if (resultWrap) resultWrap.style.minHeight = '';
  };

  /* 对话框吸顶控制：仅当有结果卡（或骨架屏等待中）时才给 .glass-card 加 .is-sticky 启用吸顶；
     无结果卡时移除 .is-sticky，对话框保持普通流（position: relative），不做任何置顶。
     这样无结果卡时对话框不会有吸顶/置顶行为。 */
  const updateDialogSticky = () => {
    const el = document.getElementById('analyzer');
    if (!el) return;
    const hasCard = !!(result && !result.hidden);
    const hasSkeleton = !!(resultSkeleton && !resultSkeleton.hidden);
    el.classList.toggle('is-sticky', hasCard || hasSkeleton);
    // 切换吸顶态后，getStickTop() 依赖的「卡片 computed top」会变化：
    // 非吸顶时 .glass-card 是 position:relative，computed top=auto→NaN→会被缓存成 0；
    // 一旦加 .is-sticky 变 sticky，top 才是真实像素偏移。这里强制让 _stickTop 失效重算，
    // 否则折叠判定 stuck = top<=getStickTop()+2 会一直用错误的 0，导致吸顶后不切简化版。
    _stickTop = null;
  };

  /* ---------- 结果渲染 ---------- */
  let lastResult = null;   // 最近一次分析结果：语言切换时据此用当前语言重渲染结果文案
  function renderResult(r) {
    if (!result) { console.error('[renderResult] #result not found'); return; }
    lastResult = r;

    if (resultScoreNum) resultScoreNum.textContent = String(r.score);
    if (resultQuestions) resultQuestions.innerHTML = buildResultHTML(r);

    result.removeAttribute('hidden');
    result.style.display = '';
    hideResultSkeleton();
    updateDialogSticky();   // 结果卡出现 → 启用吸顶
    // 注意：跟随基线 exampleBaseline 已在 showResultSkeleton（分析开始时）按球当前视口位置写好，
    // 此处不再用 window.scrollY 覆盖，否则切换示例/已滚动时点其它球会把球弹回 hero（不跟随）。

    const w = $('#resultWrap');
    if (w) {
      w.style.transition = 'none';
      w.classList.remove('is-collapsing');
      w.style.maxHeight = '';
      void w.offsetWidth;
      w.style.transition = '';
    }

    result.classList.remove('is-revealing');
    void result.offsetWidth;
    result.classList.add('is-revealing');

    /* 结果卡展开使 Define Problem 高度增大 → 过渡结束后再重算示例球上下限（回调派发 scroll，确保最终布局下夹紧生效） */
    const _rebound = () => updateExampleYBounds(() => window.dispatchEvent(new Event('scroll')));
    result.addEventListener('transitionend', _rebound, { once: true });
    setTimeout(_rebound, 700);   // 无 transitionend 引擎兜底（兜底时长覆盖展开动画）

    const containers = resultQuestions
      ? resultQuestions.querySelectorAll('.tooltip-container')
      : [];
    containers.forEach((c) => {
      c.addEventListener('click', function (e) {
        e.stopPropagation();
        containers.forEach((x) => { if (x !== c) x.classList.remove('active'); });
        c.classList.toggle('active');
      });
    });
  }

  /* ---------- 分析触发（M5 适配：支持 (onDone, session)，示例点击填充完成后回调） ---------- */
  const doAnalyze = (onDone, session) => {
    analysisToggleLocked = true;   // 整个分析周期抑制吸顶折叠/展开（消除点分析后闪动）；结果滚动结束(scrollToResult)再释放

    /* 打字机冲刷：若还在打字，立即 flush（直搬 script.js 逻辑，纯 DOM 无滚动） */
    if (typingTimer) {
      if (textarea && typingFullText) {
        textarea.value = typingFullText;
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
      }
      stopTyping();
    }

    const mySession = (typeof session === 'number') ? session : ++activeSession;

    const T = window.I18N ? window.I18N.t : (k) => k;
    const go = () => {
      const text = textarea ? textarea.value : '';
      if (!text.trim()) {
        // 空输入：默认加载「优秀示例」，效果与点击「优秀示例」卡片一致（不再弹空输入提示）
        if (typeof runGoodExample === 'function') {
          runGoodExample();
          return;
        }
        alert(T('dp.alertEmpty'));
        return;
      }

      btn.classList.add('is-loading');
      const labelEl = btn.querySelector('.btn-analyze__label');
      const original = labelEl ? labelEl.textContent : T('dp.analyze');
      if (labelEl) labelEl.textContent = T('dp.analyzing');

      showResultSkeleton();

      setTimeout(() => {
        if (mySession !== activeSession) {
          btn.classList.remove('is-loading');
          if (labelEl) labelEl.textContent = original;
          return;
        }

        try {
          const r = ValidatorEngine.analyze(text);   // 目标站：window.ValidatorEngine.analyze
          renderResult(r);
          dialogStyleLocked = false;                 // ← M5 适配点 1（目标站）：释放冻结锁
          scrollToResult();                          // ← M5 适配点 2（目标站）：方案A 智能滚动（§3.3）
          if (typeof onDone === 'function') onDone();
        } catch (e) {
          console.error('[analyze→render] error:', e);
        }

        btn.classList.remove('is-loading');
        if (labelEl) labelEl.textContent = original;
      }, 520);
    };

    go();
  };

  /* ---------- FUNC-17 打字机示例填充（逐字直搬 script.js） ---------- */
  let typingTimer = null;
  let typingFullText = '';   /* 保存完整文本，便于「分析需求」冲刷并跳过 */

  const stopTyping = () => {
    if (typingTimer) { clearInterval(typingTimer); typingTimer = null; }
    typingFullText = '';
    if (glassCardInnerEl) glassCardInnerEl.classList.remove('is-typing');
  };

  function typeText(target, text, onDone) {
    if (typingTimer) { clearInterval(typingTimer); typingTimer = null; }
    typingFullText = text;
    if (glassCardInnerEl) glassCardInnerEl.classList.add('is-typing');
    target.value = '';
    target.dispatchEvent(new Event('input', { bubbles: true }));
    let i = 0;
    const BASE_STEP = 18;  // ~56 chars/sec — 稳定、肉眼可读的节奏
    const MIN_TOTAL = 600; // 短文本不会快于此
    const step = Math.max(BASE_STEP, MIN_TOTAL / text.length);
    typingTimer = setInterval(() => {
      i += 1;
      target.value = text.slice(0, i);
      target.dispatchEvent(new Event('input', { bubbles: true }));
      if (i >= text.length) {
        clearInterval(typingTimer);
        typingTimer = null;
        stopTyping();
        // 自动打字填满文本框时（内容超出自适应上限），打字结束平滑回首行：露出第一行而非最后一行
        if (target.scrollHeight > target.clientHeight) {
          target.scrollTo({ top: 0, behavior: 'smooth' });
        }
        if (onDone) onDone();
      }
    }, step);
  }

  /* ---------- FUNC-19 结果智能滚动（方案 A：自写 window.scrollTo + 吸顶偏移补偿） ---------- */
  function scrollToResult() {
    if (result.hidden && resultSkeleton.hidden) {
      analysisToggleLocked = false;                                 // 无可见结果，无需滚动，直接释放锁
      return;
    }
    const target = result.hidden ? resultSkeleton : result;        // 优先已渲染结果，否则骨架屏
    if (!target || !glassCardEl) {
      analysisToggleLocked = false;
      return;
    }

    const rect = target.getBoundingClientRect();
    // 吸顶偏移直接读 --dialog-stick-top 设计值（而非 getStickTop()，后者在对话框尚未吸顶时读 .top=auto→0）
    const stickTop = parseFloat(getComputedStyle(glassCardEl).getPropertyValue('--dialog-stick-top')) || 0;
    const dialogH = glassCardEl.getBoundingClientRect().height;    // 吸顶对话框高度
    const dialogBottom = stickTop + dialogH;                       // 吸顶对话框下边缘：结果卡顶应对齐此处
    // 已可见：结果卡顶已在对话框下边缘下方、且底在视口内 → 不滚（关键：用 dialogBottom 而非 dialogH，否则结果卡顶会被吸顶对话框遮住）
    const visible = rect.top >= dialogBottom - 8 && rect.bottom <= window.innerHeight - 8;
    if (visible) {
      analysisToggleLocked = false;                                 // 已可见 → 不滚，释放锁
      dialogStyleLocked = false;                                    // 一并释放：否则示例卡路径 result 已可见时此处早退会漏放，导致后续 handleScroll 永久被 445 行冻结
      return;
    }

    const savedCollapsed = isDialogCollapsed();                    // 滚前快照：滚完须还原
    const targetY = Math.max(0, window.scrollY + (rect.top - dialogBottom - 12));

    let finished = false;                                           // 双保险：scrollend 优先，1s 兜底
    const finish = () => {
      if (finished) return;
      finished = true;
      dialogStyleLocked = false;                                    // 解冻（功能3 钩子）
      analysisToggleLocked = false;                                 // 分析周期结束：恢复滚动折叠能力
      setDialogCollapsed(savedCollapsed);
    };
    window.addEventListener('scrollend', finish, { once: true });
    setTimeout(finish, 1000);
    window.scrollTo({ top: targetY, behavior: 'smooth' });
  }

  /* ---------- 结果卡重置（FUNC-06 清除按钮调用 / FUNC-21 平滑收起） ---------- */
  const resetResultCard = (animate) => {
    if (animate === undefined) animate = true;
    // 结果卡收起 → 取消示例球随滚动下移的视差，回到 hero 顶原行为（不依赖下一次滚动）
    const ex = document.querySelector('.example-cards');
    if (ex) { ex.style.setProperty('--example-y', '0px'); ex.dataset.exY = '0px'; }
    exampleBaseline = null;   // 结果卡收起 → 取消跟随基线（需求 2：无结果卡不跟随）
    exampleAnchorTop = null;
    if (result) result.classList.remove('is-revealing', 'is-retracting');
    if (resultSkeleton) resultSkeleton.hidden = true;
    updateDialogSticky();   // 结果卡与骨架屏都清空 → 取消吸顶（保留功能3 实现）

    const w = $('#resultWrap');
    if (!w) {
      if (result) result.hidden = true;
      updateDialogSticky();   // 结果卡已清空 → 摘掉 .is-sticky，对话框回到普通流（清除后与出结果前一致，不随滚动置顶）
      /* Define Problem 高度改变 → 过渡结束后再重算示例球上下限（回调派发 scroll） */
      updateExampleYBounds(() => window.dispatchEvent(new Event('scroll')));
      return;
    }
    if (!animate) {
      // 即时收起（无过渡）：清除后程序化聚焦时，若结果卡 max-height 正在做 600ms 过渡动画，
      // iOS Safari 会在动画期间不绘制光标（"无光标" bug）。即时收起让聚焦时布局已静止，
      // 光标可正常渲染（与「全新加载点按输入框光标正常」一致——那时页面无动画）。
      if (result) result.hidden = true;
      w.classList.remove('is-collapsing');
      w.style.maxHeight = '';
      w.style.minHeight = '';
      updateDialogSticky();
      updateExampleYBounds(() => window.dispatchEvent(new Event('scroll')));
      return;
    }
    // 叠加 is-collapsing 平滑收起（CSS 已具备，原功能3 未使用）：先按当前高度定高，
    // 再切 is-collapsing → max-height:0 !important；收起完成后再隐藏内容。
    w.style.minHeight = '';
    w.style.maxHeight = w.scrollHeight + 'px';
    void w.offsetHeight;                       // 强制 reflow，让起始 max-height 生效
    w.classList.add('is-collapsing');
    const finalize = () => {
      w.removeEventListener('transitionend', finalize);
      if (result) result.hidden = true;       // 收起完成后再隐藏内容
      updateDialogSticky();   // 结果卡已清空 → 摘掉 .is-sticky，对话框回到普通流（清除后与出结果前一致，不随滚动置顶）
      w.classList.remove('is-collapsing');
      w.style.maxHeight = '';
      updateExampleYBounds(() => window.dispatchEvent(new Event('scroll'))); // 收起完成 → 过渡结束后重算上下限
    };
    w.addEventListener('transitionend', finalize, { once: true });
    setTimeout(finalize, 600);                 // 无 transitionend 引擎兜底
  };

  /* ========== 对话框吸顶折叠（FUNC-08）==========
   * 参考 intro 区块做法：Define Problem 为普通层叠滚动区块，随页面整体滚动；
   * 全屏背景由全局 body::before（fixed）提供，故滚动源使用 window。
   * 冲突修复（原「对话框置顶」与「目标网站菜单置顶」争同一顶部像素 → 闪动）：
   *   .glass-card 改为 position: sticky; top: var(--nav-h)，吸顶时贴在固定导航栏
   *   正下方，与 .nav-menu（fixed; top:0）物理错开，从根本上消除重叠/闪动。
   *   因此不再需要「菜单让位」(menu-yield) 逻辑。 */
  const DEADZONE = 4;
  const blockEl = document.querySelector('.define-problem');

  /* 按导航栏实测高度写入吸顶偏移：--dialog-stick-top = 导航栏高度 + 16px。
     CSS 里的 --nav-h(8.5rem) 只是布局预留值，与导航栏实际渲染高度不等，
     直接拿它算会让「菜单下方 16px」变成更小的间距。 */
  const DIALOG_GAP = 16;
  let _navH = 0;
  /* 导航栏带 postLoading 类，加载完成前高度为 0，故不能只在 init 时算一次：
     每帧廉价地比对一次实测高度，变化时（含从 0 变为真实高度）才写入变量并让缓存失效。 */
  function updateStickTopVar() {
    const nav = document.querySelector('.nav-menu');
    if (!nav) return;
    const h = Math.round(nav.getBoundingClientRect().height);
    if (!h || h === _navH) return;
    _navH = h;
    document.documentElement.style.setProperty('--dialog-stick-top', (h + DIALOG_GAP) + 'px');
    _stickTop = null;            // 偏移变了，重新读取
  }

  /* 导航栏由 postLoading 控制显隐，尺寸就绪时刻不确定：用 ResizeObserver 在它
     真正拿到高度的那一刻立即写入偏移，不必等用户滚动。 */
  function observeNavHeight() {
    const nav = document.querySelector('.nav-menu');
    if (!nav || typeof ResizeObserver === 'undefined') return;
    new ResizeObserver(updateStickTopVar).observe(nav);
  }

  /* 对话框吸顶偏移 = .glass-card(#analyzer) 的 sticky top 的像素值。
     吸顶元素已改回对话框自身，故从这里读取；缓存并在 resize 时刷新。 */
  let _stickTop = null;
  function getStickTop() {
    if (_stickTop === null) {
      const card = document.getElementById('analyzer');
      const t = card ? parseFloat(getComputedStyle(card).top) : NaN;
      _stickTop = Number.isFinite(t) ? t : 0;
    }
    return _stickTop;
  }

  /* 切换折叠/完整态（菜单独占 top:0，对话框贴其下方，二者不再耦合） */
  function setDialogCollapsed(on, animate) {
    if (animate === undefined) animate = true;
    const el = document.getElementById('analyzer');
    if (el) el.classList.toggle('is-collapsed', !!on);
    // 折叠态同样保留清除功能：仅在文本框为空时隐藏清除按钮（展开/折叠态一致）
    syncClearButton();
    if (textarea) {
      if (textarea.__smhTimer) clearTimeout(textarea.__smhTimer);
      if (animate) {
        // 仅在折叠/展开切换时刻启用 height+max-height 过渡，让「1 行 ↔ 2 行」高度变化平滑；
        // 过渡结束后立即移除临时 transition（恢复无 height 过渡），避免打字等高频 input 触发动画、带来性能开销。
        textarea.style.transition = 'height .3s ease, max-height .3s ease';
        textarea.__smhTimer = setTimeout(function () {
          textarea.style.transition = '';
        }, 400);
      } else {
        // 聚焦瞬间展开：关闭 textarea 过渡（含基础 CSS 的 max-height .3s 过渡），改为即时展开。
        // 否则聚焦时 textarea 正处于高度过渡中，iOS Safari 会不渲染光标（经典 bug），表现为「有时光标不出现」。
        textarea.style.transition = 'none';
        // 下一帧恢复过渡（折叠动画等后续需求仍可平滑），此时已无几何变化、不会触发动画。
        requestAnimationFrame(function () {
          requestAnimationFrame(function () {
            if (textarea) textarea.style.transition = '';
          });
        });
      }
    }
    // 展开完整版时：立即把 textarea 的 height 设为完整版目标高度（2 行），不要延迟。
    // 原因：折叠态 style.height 已被 autoResize 压成 1 行（25.5px），若不立即设高，
    // 高度会被 style.height 锁死，max-height 过渡（25.5→51）无法生效（height 优先），
    // 只能等延迟设高时才突然变，造成「字数先出现、高度后突然跳」。
    // 立即设 2 行高度后，显示高度由 max-height 的 .3s 过渡平滑控制（从 1 行渐变到 2 行）。
    if (!on) setTextareaFullHeight();
  }

  // 示例球「钉视口跟随」更新（需求 1/2/3/4）。抽为独立函数，供滚动处理(handleScroll)与
  // 导航收敛(reconcileDialogState)共用：修复「折叠/淡出态点菜单导航回来后，示例球残留旧
  // --example-y 位移停在视口外消失，须等下次滚动才重算归位」的 bug。
  function updateExampleCards() {
    const exampleCardsEl = document.querySelector('.example-cards');
    if (!exampleCardsEl || exampleCardsEl.closest('.examples-overlay')) return; // 小屏浮层内不处理
    const hasResult = !!(result && !result.hidden);
    if (!hasResult) {
      // 无结果卡：不跟随，回到 hero 自然位（exY=0），并取消过界隐藏
      if (exampleCardsEl.dataset.exY !== '0px') {
        exampleCardsEl.dataset.exY = '0px';
        exampleCardsEl.style.setProperty('--example-y', '0px');
      }
      exampleCardsEl.classList.remove('is-out');
      return;
    }
    const y = window.scrollY;
    const baseline = (exampleBaseline == null) ? y : exampleBaseline;
    const sol = blockEl || document.querySelector('.define-problem');
    const sRect = sol ? sol.getBoundingClientRect() : null;
    const vh = window.innerHeight || 0;
    const cardH = exampleCardsEl.offsetHeight || 600;
    const navH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nav-h')) || 80;
    const topMin = navH + 16;
    const topMax = Math.max(topMin, vh - cardH - 16);
    const targetTop = Math.max(topMin, Math.min(exampleAnchorTop, topMax));

    // 1:1 钉视口：以滚动速度把球反向位移，固定在「结果卡出现时的视口位置」（速度=滚动速度，不滞后）。
    // 再夹紧到 Define Problem 区块的「文档坐标」范围内：到底（区块下边缘）即停住、不再跟随下移，
    // 也不淡出，随区块一起自然滚走；到顶（区块上边缘）即停住，不跑到上一区块（intro）去。
    // 修复：原先「过界才消失」依赖淡出；现改为「到边界即停住、不消失」（用户要求）。
    let exY = (y - baseline) + (targetTop - exampleAnchorTop);
    if (sRect && exampleAnchorTop != null && exampleBaseline != null) {
      const anchorDocTop = exampleAnchorTop + exampleBaseline;   // 球层在 exY=0 时的文档顶部
      const blockDocTop = sRect.top + y;                         // 区块顶（文档坐标）
      const blockDocBottom = sRect.bottom + y;                   // 区块底（文档坐标）
      const exYMin = blockDocTop - anchorDocTop;                // 球不高于（不跑出）区块顶
      const exYMax = Math.max(exYMin, blockDocBottom - cardH - anchorDocTop); // 球不低于（不跑出）区块底
      exY = Math.min(Math.max(exY, exYMin), exYMax);
    } else {
      exY = Math.max(0, exY);
    }
    const exYStr = exY.toFixed(1) + 'px';
    if (exampleCardsEl.dataset.exY !== exYStr) {
      exampleCardsEl.dataset.exY = exYStr;
      exampleCardsEl.style.setProperty('--example-y', exYStr);
    }
  }

  // 导航滚动结束的兜底重算：点击「Define the Problem」菜单平滑滚动期间，滚动处理器被 window._navScrolling 冻结
  // 而不重算折叠/吸顶态；滚动收敛后不会再派发 scroll 事件，对话框会卡在折叠/淡出态（菜单点完却仍是折叠版，或结果卡之上空白），
  // 且示例球残留旧 --example-y 位移停在视口外消失。宿主脚本（js.js）在导航收敛后调用本函数：恢复完整版、解除淡出、并同步重算示例球位置。
  const reconcileDialogState = () => {
    const el = document.getElementById('analyzer');
    if (!el) return;
    const sRect = blockEl ? blockEl.getBoundingClientRect() : null;
    const vh = window.innerHeight || document.documentElement.clientHeight;
    const active = sRect ? (sRect.top < vh && sRect.bottom > 0) : true;
    // 非折叠但可能已淡出（完整版滚过结果卡）/ 折叠态：导航回来且区块在视口内时，恢复完整版并解除淡出
    if (!el.classList.contains('is-collapsed')) {
      el.classList.remove('is-fading');
    } else if (active) {
      setDialogCollapsed(false);      // 恢复完整版
      el.classList.remove('is-fading'); // 解除淡出（避免结果卡之上出现空白）
    }
    // 同步重算示例球位移：导航收敛后不会再有 scroll 事件触发 handleScroll，
    // 否则示例球残留旧位移停在视口外、须等下次手动滚动才归位（bug：点菜单回到顶部示例球全部消失）。
    updateExampleCards();
  };
  // 导航开始时立即强制恢复对话框到完整版（无视区块是否在视口内）：点击「Define the Problem」菜单后，
  // 平滑滚动期间 onScroll 被 _navScrolling 冻结，若等到收敛再恢复会出现「滚到顶才弹回完整版」的突兀感；
  // 改为在滚动开始即恢复，让「恢复完整版」与「返回顶部」同步进行（示例球随滚动平滑跟随，到顶时已为完整版）。
  const forceRestoreDialog = () => {
    const el = document.getElementById('analyzer');
    if (!el) return;
    if (el.classList.contains('is-collapsed')) setDialogCollapsed(false); // 展开（恢复完整版）
    el.classList.remove('is-fading');                                     // 解除淡出
    updateExampleCards();
  };
  window.ValidatorOrchestration = window.ValidatorOrchestration || {};
  window.ValidatorOrchestration.forceRestoreDialog = forceRestoreDialog;
  window.ValidatorOrchestration.reconcileDialogState = reconcileDialogState;
  // 供宿主平滑滚动循环每帧调用：导航滚动期间 onScroll 被 window._navScrolling 冻结，
  // 示例球不会因滚动事件更新，故由滚动循环直接每帧重算，保持与页面同步滚动、避免收敛后一次性大跳变。
  window.ValidatorOrchestration.updateExampleCards = updateExampleCards;

  let _resizeTimer = null;
  let _resizeSilent = false;
  let lastY = window.scrollY;
  let _scrollTicking = false;
  let _lastToggle = 0;            // 折叠/展开切换冷却时间戳，屏蔽微小抖动导致的持续闪烁
  let _suppressBlurUntil = 0;     // 聚焦保护窗：在此时间戳之前，滚动不触发输入框失焦（避免移动端聚焦后浏览器自动滚入视口导致键盘被立即收起）
  const TOGGLE_COOLDOWN = 160;    // ms：单次切换后在该窗口内忽略反向切换

  function onResize() {
    _resizeSilent = true;
    updateStickTopVar();         // 导航栏高度可能随断点变化，重算吸顶偏移
    updateExampleYBounds();      // hero 高度 / 断点变化后重算示例球位移上下限
    _stickTop = null;            // 吸顶偏移可能随断点变化，刷新缓存
    clearTimeout(_resizeTimer);
    _resizeTimer = setTimeout(() => { _resizeSilent = false; }, 250);
  }

  function handleScroll() {
    // M5 冻结钉位（Step 4 自补，§1.5）：示例点击/填充/分析期间 dialogStyleLocked=true，
    // 把页面钉在冻结位置，不碰 <body> overflow（否则破坏 position:sticky 对话卡）。
    if (dialogStyleLocked) {
      window.scrollTo(0, scrollFrozenY != null ? scrollFrozenY : window.scrollY);
      return;
    }
    if (_resizeSilent) return;
    if (window._navScrolling) return;                   // 宿主程序化滚动期间冻结

    if (_scrollTicking) return;
    _scrollTicking = true;
    requestAnimationFrame(() => {
      _scrollTicking = false;

      updateStickTopVar();   // 导航栏渲染出来/高度变化后自愈式校正吸顶偏移

      const y = window.scrollY;
      const delta = y - lastY;
      lastY = y;

      // 页面滚动时取消输入框（#requirement）的激活/聚焦状态：
      // 收起移动端软键盘，并避免滚动被输入态拦截。仅在确有滚动位移时才 blur。
      // 但聚焦后一小段保护窗（_suppressBlurUntil）内不 blur：移动端聚焦会触发浏览器
      // 自动把输入框滚入视口，那段滚动不是用户主动滚，不能抢走焦点、收起键盘。
      const _now = (window.performance && performance.now) ? performance.now() : Date.now();
      const _suppress = _now < _suppressBlurUntil;
      if (textarea && document.activeElement === textarea && Math.abs(delta) > 0 && !_suppress) {
        textarea.blur();
      }

      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;

      const el = document.getElementById('analyzer');
      if (!el) return;

      const isCollapsed = el.classList.contains('is-collapsed');

      // active 表示 Define Problem 区块是否仍在视口内（与视口有重叠），
      // 仅用于吸顶折叠的触发门控；背景已由 CSS 改为 absolute 随区块一起滚动，无需 JS 控制显隐。
      const sRect = blockEl ? blockEl.getBoundingClientRect() : null;
      const vh = window.innerHeight;
      const active = sRect ? (sRect.top < vh && sRect.bottom > 0) : true;

      // 视觉差：大柠檬 / 散落小柠檬 / 小bubble 以不同速度随滚动位移，制造纵深层叠感。
      // rel = 区块顶部相对视口顶部已滚过的像素（>0 表示区块正向上滚出视口）。
      // 各图层乘以不同系数（速度：大柠檬 > 小柠檬 > 小bubble），速度越大越“靠前”，随滚动上移越快。
      if (blockEl) {
        const rel = -sRect.top;
        blockEl.style.setProperty('--lemon-large-y', (-rel * 0.25).toFixed(1) + 'px');
        blockEl.style.setProperty('--lemon-small-y', (-rel * 0.30).toFixed(1) + 'px');
        blockEl.style.setProperty('--bubble-y',      (-rel * 0.20).toFixed(1) + 'px');
      }

      // 对话框（吸顶）「滑」到结果卡底部时才淡出消失：吸顶后对话框视觉顶固定在 stickTop，
      // 结果卡在其下方随页面向上滚动；当结果卡底部滚到【对话框吸顶时的下边缘】时，
      // 表示对话框已把整张结果卡滑过覆盖、到达结果卡底部，此时淡出。
      // 注意基准是「对话框下边缘」而非「吸顶位置(stickTop=对话框顶)」：若用对话框顶，
      // 要等结果卡整张滚出视口顶、多滚一个对话框高度的距离才触发，会明显滞后。
      // 仅当对话框已吸顶(stuck)且存在结果卡时才淡出；未吸顶（仍读结果卡）不淡出。
      // 滞回：结果卡底 <= 对话框底+2 才淡出；结果卡底 > 对话框底+30 才恢复，2~30px 死区防抖动。
      const hasResult = !!(result && !result.hidden);
      if (hasResult && resultWrap) {
        const stickTop = getStickTop();                                  // 对话框吸顶位置（视口坐标）
        const stuck = el.getBoundingClientRect().top <= stickTop + 2;    // 对话框当前是否已吸顶
        const cardBottom = el.getBoundingClientRect().bottom;            // 对话框吸顶时下边缘
        const wrapBottom = resultWrap.getBoundingClientRect().bottom;    // 结果卡底部相对视口顶
        if (stuck && wrapBottom <= cardBottom + 2) el.classList.add('is-fading');
        else if (wrapBottom > cardBottom + 30) el.classList.remove('is-fading');
      } else {
        el.classList.remove('is-fading'); // 无结果卡 / 结果卡底部远离对话框 → 恢复可见
      }

      // 示例球「钉视口跟随」（需求 1/2/3/4，用户要求：不要离开界面；且仅结果卡存在时跟随）：
      // 钉视口跟随机制：--example-y = clamp(scrollY − exampleBaseline, 0, …)：
      //  - exampleBaseline = 结果卡出现/切换时的 scrollY − 当前位移；结果卡出现前不跟随（需求 2：球留 hero 自然位）
      //  - 结果卡出现后以 1:1 抵消滚动，把球钉在「出现时的视口位置」，随页面滚动但始终留在界面内（需求 1）
      //  - 视口边界夹紧：球始终留在可视区域内，不跑出顶/底（修复：原先以容器高 600px 误算球底，
      //    导致上界≈0、球几乎不跟随就被滚出画面）
      //  - 整块滚出视口(sRect.bottom<=0)后解除钉位，球随 Define Problem 区块一起离开（需求 3/4）
      // 小屏浮层打开时球被移入固定浮层，此处不施加 / 更新位移（需求 5：否则走位/看不见）。
      updateExampleCards();   // 抽为函数：滚动处理与导航收敛(reconcileDialogState)共用，避免导航后残留旧位移

      // 吸顶折叠由「对话框是否越过吸顶线」驱动：
      // - 向下滚过吸顶线(stuck) → 折叠为输入条（长结果卡上滚读时保持输入条可用）；
      // - 向上滚不恢复完整版（需求：向上滚动时不要切回完整版）；
      // - 仅当对话框「回到原位」（不再吸顶，getBoundingClientRect().top 回落到吸顶线下方）才恢复完整版。
      if (active && !analysisToggleLocked) {
        // 吸顶判定：对话框视觉顶部 <= 吸顶偏移 即视为吸顶
        const stuck = el.getBoundingClientRect().top <= getStickTop() + 2;
        const goingDown = delta > DEADZONE;
        const now = (window.performance && performance.now) ? performance.now() : Date.now();

        if (isCollapsed && !hasResult) {
          // 无结果卡时强制恢复完整版（例如结果被清空后）
          setDialogCollapsed(false);
        } else if (now - _lastToggle > TOGGLE_COOLDOWN) {
          if (stuck && goingDown && !isCollapsed && y > 0 && hasResult
              && document.activeElement !== textarea) {
            // 输入框正聚焦时不折叠：手机端聚焦会自动把输入框滚入视口，
            // 这个滚动会被误判为「向下滚过吸顶线」从而把刚展开的完整版折叠回去。
            setDialogCollapsed(true);
            _lastToggle = now;
          } else if (!stuck && isCollapsed) {
            // 对话框回到原位（不再吸顶）→ 恢复完整版
            setDialogCollapsed(false);
            _lastToggle = now;
          }
        }
      }
    });
  }

  /* ---------- FUNC-11 示例分数预计算（写入 .score-num 徽标） ---------- */
  /* 遍历 .example-card，读当前语言的示例文本（中文/繁中统一用简体 data-text / 英文 data-text-en）→
     ValidatorEngine.analyze(text).score → 写 .score-num。
     引擎对中英同义输入算出相同分数，故各语言徽标一致（优秀6/一般2/较差1/不合格0）。
     繁体 UI 仍使用简体示例文本，确保引擎判定分数稳定。 */
  const applyExampleScores = () => {
    if (typeof ValidatorEngine === 'undefined' || !ValidatorEngine.analyze) return;
    const lang = window.I18N ? window.I18N.lang : 'en';
    document.querySelectorAll('.example-card').forEach((card) => {
      const numEl = card.querySelector('.score-num');
      const isChinese = (lang === 'scn' || lang === 'zh-tcn');
      const text = (lang === 'zh-tcn' && card.getAttribute('data-text-tcn'))
        ? card.getAttribute('data-text-tcn')
        : (isChinese
          ? card.getAttribute('data-text')
          : (card.getAttribute('data-text-en') || card.getAttribute('data-text')));
      if (!numEl || !text) return;
      numEl.textContent = String(ValidatorEngine.analyze(text).score);
    });
  };

  /* ---------- 初始化（DOMContentLoaded） ---------- */
  const init = () => {
    textarea        = $('#requirement');
    btn             = $('#btnAnalyze');
    result          = $('#result');
    resultScoreNum  = $('#resultScoreNum');
    resultQuestions = $('#resultQuestions');
    resultSkeleton  = $('#resultSkeleton');
    resultWrap      = $('#resultWrap');
    glassCardEl     = $('#analyzer');            // = .glass-card 根
    glassCardInnerEl = $('.glass-card__inner');  // 打字机柔光 .is-typing 切换目标

    applyExampleScores();   // FUNC-11：用引擎真实分数覆盖卡片静态占位数字

    if (btn) {
      btn.addEventListener('click', doAnalyze);
      // 鼠标点按：在 blur 之前（pointerdown 早于 mousedown→blur）先置锁，
      // 使「开始分析」按钮导致的输入框失焦不会触发折叠（消除闪动）。
      btn.addEventListener('pointerdown', () => { analysisToggleLocked = true; });
    }

    if (textarea) {
      textarea.addEventListener('keydown', (e) => {
        // 回车（无 Shift）= 等同点击「开始分析」。兼容不同浏览器/移动端的键码写法，
        // 并排除中文等输入法组字过程（isComposing / keyCode 229），避免选词上屏时误触发。
        const isEnter = e.key === 'Enter' || e.keyCode === 13 || e.which === 13;
        const composing = e.isComposing || e.keyCode === 229;
        if (isEnter && !e.shiftKey && !composing) {
          e.preventDefault();
          doAnalyze();
          textarea.blur();   // 触发分析后收回（收起）移动端软键盘
        }
      });
    }

    /* ---- FUNC-05 字数统计 + 自适应高度 / FUNC-06 清除按钮可见性 ---- */
    charCount = document.getElementById('charCount');
    inputClear = document.getElementById('inputClear');

    if (textarea) {
      // 激活（聚焦）输入框时，对话框切换到完整模式（展开），不被吸顶折叠态遮挡。
      // 用 animate=false：聚焦瞬间即时展开、不播放高度过渡，避开 iOS「聚焦+过渡→光标不出现」的 bug。
      textarea.addEventListener('focus', function () {
        setDialogCollapsed(false, false);
        // 强制同步重排（force reflow）：iOS Safari 在「聚焦 + 键盘动画」期间不会主动绘制光标，
        // 需靠一次重排把光标提交到渲染树。原 DEBUG HUD 的 dbg() 写入 _dbgEl 恰好做了这件事、
        // 无意中掩盖了 bug；删 HUD 后重排消失、bug 重现。这里用显式重排取代它（不依赖调试工具）。
        void textarea.offsetHeight;
        // 空值（仅占位符）时回顶：手机屏小、占位符超 2 行会把首行光标顶出可视区，确保聚焦点到首行。
        if (!textarea.value) textarea.scrollTop = 0;
        // 开聚焦保护窗：此后 500ms 内滚动不触发失焦，避开移动端浏览器自动滚入视口。
        _suppressBlurUntil = (window.performance && performance.now)
          ? performance.now() + 500
          : Date.now() + 500;
        // 兜底：iOS Safari 偶发聚焦后光标不绘制（首帧未渲染）。下一帧重置光标位置强制重绘，
        // 不影响既有输入内容（清空末尾/末尾定位）。
        requestAnimationFrame(function () {
          try {
            const p = textarea.selectionStart != null ? textarea.selectionStart : textarea.value.length;
            textarea.setSelectionRange(p, p);
          } catch (e) { /* 某些环境不支持则忽略 */ }
        });
      });

      textarea.addEventListener('blur', function () {
        // 手动输入超过自适应最大行数时，离开输入框平滑回首行（与示例打字结束效果一致：露出第一行）。
        // 放在折叠判断【之前】：最常见的手动输入场景本就无结果卡，会被下方早返回跳过，故必须先行。
        if (textarea.scrollHeight > textarea.clientHeight) {
          textarea.scrollTo({ top: 0, behavior: 'smooth' });
        }

        // 输入框失焦时恢复到「折叠（输入条）」状态，与「折叠后聚焦 → 展开完整版」对称。
        // 仅在存在结果卡时才折叠：无结果卡时对话框本就保持完整版，不应切到输入条
        // （否则清除/分析等流程会把它误折叠，且空结果时无折叠意义）。
        const hasResultCard = result ? !result.hidden : false;
        if (!hasResultCard) return;
        // 分析周期内不折叠：点「开始分析」/示例会先让输入框失焦，但这是发起分析而非离开对话框，
        // 若此时折叠，随后结果重渲染 + 自动滚到结果会再展开，产生「简化版→完整版」闪动。
        if (analysisToggleLocked) return;
        // 焦点仍落在对话框内部（如点了「开始分析」按钮）→ 不折叠。
        const ae = document.activeElement;
        if (ae && glassCardEl && glassCardEl.contains(ae)) return;

        setDialogCollapsed(true);
      });

      textarea.addEventListener('input', function () {
        // FUNC-05 字数统计（与引擎口径一致：trim().length；单位随语言：字/chars）
        const trimLen = this.value.trim().length;
        if (charCount) charCount.textContent = trimLen + (window.I18N ? window.I18N.t('dp.charUnit') : ' 字');

        // FUNC-05 自适应高度：完整版最小高度恒为 2 行（约 51px），即使内容只有 1 行；
        // 内容超过 2 行（约 51px）后内部滚动（直搬源站 autoResize，折叠态由 CSS max-height 限 1 行）。
        // 注意：这里保持简洁、不做每次 input 的 transition 切换，避免打字时反复 getComputedStyle + 改内联样式带来性能开销。
        this.style.height = 'auto';                            // 先重置以拿到真实 scrollHeight
        const cs = getComputedStyle(this);
        const cssMaxH = parseFloat(cs.maxHeight) || 51;
        const lineH = parseFloat(cs.lineHeight) || (parseFloat(cs.fontSize) * 1.7);
        const contentH = this.scrollHeight;
        const minH = 2 * lineH;                                // 完整版最小 2 行
        const targetH = Math.min(Math.max(contentH, minH), cssMaxH);
        this.style.height = targetH + 'px';
        /* 滚动定位（修复手机端光标被占位符顶出可视区的 bug）：
           - 有内容且超过上限（约 2 行）→ 滚动到底，露出最新一行（与源站一致）；
           - 其余（空值含占位符超 2 行、内容未超）→ 回顶，确保首行光标可见。
           关键点：清空长内容后 contentH 变小、不再满足 > cssMaxH，必须显式回顶，
           否则 scrollTop 残留底部，手机屏小、占位符换行超 2 行时首行光标被推到可视区上方看不见。 */
        if (this.value && contentH > cssMaxH) {
          this.scrollTop = this.scrollHeight;
        } else {
          this.scrollTop = 0;
        }

        // FUNC-06 清除按钮可见性：仅当文本框为空时隐藏（折叠态也恢复显示，与源站一致）
        syncClearButton();
      });
    }

    /* ---------- 移动端软键盘遮挡修复 ----------
       （提前定义：供清除流程回焦后主动触发，并监听 visualViewport 事件自动触发）
       键盘弹起时（visualViewport 高度小于布局视口），若文本框聚焦，
       保证【输入框】滚到键盘之上的可视区域内，避免被键盘遮住（对话框底部如 CTA 允许被键盘遮挡）。
       关键：揭示滚动必须「延迟到键盘动画结束之后」再执行——聚焦/键盘出现的瞬间若页面
       发生滚动（哪怕即时 scrollTo），iOS Safari 会不渲染光标（"无光标" bug 的真正根因：
       原版没有这段滚动、光标正常；平板无键盘、此段不触发、光标正常；手机有键盘、触发即吞光标）。
       因此先让光标在输入位置（即便短暂位于键盘后方）渲染出来，键盘落定后再把输入框滚出键盘。
       滚动期间临时抑制 handleScroll 的失焦逻辑，防止滚动触发收键盘。 */
    const vv = window.visualViewport;
    // revealDialogAboveKeyboard 提升到 init 作用域（vv 块外），供清除流程回焦后主动调用；
    // 不支持 visualViewport 时保持 null，调用方用 if 判空。
    let revealDialogAboveKeyboard = null;
    if (vv) {
      let revealTimer = null;
      const doRevealScroll = () => {
        if (document.activeElement !== textarea) return;        // 已失焦，放弃
        // 仅以【输入框】为基准：对话框常比「导航栏→键盘」可用高度更高，若以整个对话框(glassCardEl)
        // 为基准会把整块顶上去、反而把顶部输入框推出视口上方。故只保证输入框（打字区）在键盘之上
        // 可见即可，对话框底部（如 CTA 按钮）被键盘遮挡是被允许的。
        const target = textarea;
        const rect = target.getBoundingClientRect();
        const visibleBottom = (vv.offsetTop || 0) + vv.height;
        const pad = 12;
        if (rect.bottom <= visibleBottom - pad) return;         // 已完整可见
        const delta = rect.bottom - (visibleBottom - pad);
        const now = (window.performance && performance.now) ? performance.now() : Date.now();
        // 失焦保护窗延长至 800ms，覆盖下方平滑滚动时长，避免滚动途中触发收键盘。
        _suppressBlurUntil = now + 800;
        // 平滑滚动（behavior:'smooth'）：对话框被键盘顶上去的过程带缓动，不再瞬间跳变。
        // 仍依赖上层 360ms 延迟——键盘落定、光标已绘制后才滚动，避开「聚焦瞬间滚动吞光标」。
        // 不支持 smooth 的浏览器会回退为即时滚动（同原行为），无回归。
        window.scrollTo({ top: window.scrollY + delta, behavior: 'smooth' });
      };
      revealDialogAboveKeyboard = () => {
        const gap = window.innerHeight - vv.height;
        if (gap < 120) return;                                  // 键盘未弹起
        if (document.activeElement !== textarea) return;
        // 键盘动画约 250-350ms；延迟到落定后再滚动，避免聚焦瞬间滚动吞掉光标
        if (revealTimer) clearTimeout(revealTimer);
        revealTimer = setTimeout(doRevealScroll, 360);
      };
      vv.addEventListener('resize', revealDialogAboveKeyboard);
      vv.addEventListener('scroll', revealDialogAboveKeyboard);
    }

    /* ---- FUNC-06 清除按钮：清空 + 收起结果卡 + 恢复对话卡 ---- */
    if (inputClear) {
      // 鼠标点按：在 blur 之前（pointerdown 早于 mousedown→blur→click）先置锁，
      // 使「点击清除」按钮导致的输入框失焦不会触发折叠——否则折叠会顺带把清除按钮自身
      // hidden 掉，click 事件随之不触发，文本得不到清除（与「开始分析」按钮一致，消除误折叠）。
      // 同时记录清除前输入框是否聚焦（供「示例球隐藏时」分情况回焦决策；
      // blur 发生在 mousedown 之后，故必须在此刻 pointerdown 记录）。
      let clearWasFocused = false;
      inputClear.addEventListener('pointerdown', () => {
        analysisToggleLocked = true;
        clearWasFocused = !!textarea && document.activeElement === textarea;
      });

      inputClear.addEventListener('click', function () {
        if (!textarea) return;

        analysisToggleLocked = true;            // 清除是明确的编辑动作：全程抑制吸顶折叠/展开，
                                                 // 避免「点清除时输入框失焦」「复位滚动补偿」触发折叠，弹回输入条

        stopTyping();                          // 终止可能的打字机（FUNC-17），避免填充被中断残留

        // 清除后回到「Define Problem 区块内 hero 居中」正常流态：与「只在有结果时才吸顶」一致——
        // 结果卡收起后 updateDialogSticky 会移除 .is-sticky，对话卡变回正常流。
        // Define Problem 只是页面众多区块之一，不能像完整版（单页）那样滚到 top:0（会回网站首页），
        // 应只滚回【本 Define Problem 区块顶部】，让对话卡回到其区块内 hero 居中位置。
        textarea.value = '';
        textarea.dispatchEvent(new Event('input'));   // 触发字数归零 + autoResize + 隐藏清除

        // 清除后是否回焦：不看设备，看「示例球是否隐藏」（css.scss 小屏 @media(max-width:1200px)
        // 使 .example-cards display:none）。
        //  - 示例球可见（大屏正常显示）→ 清除后【一定聚焦】；
        //  - 示例球隐藏（小屏）→ 按清除时输入框的聚焦态分情况：
        //      清除时聚焦 → 清除后也聚焦（用户正在输入、键盘已弹起，保持输入流）；
        //      清除时未聚焦 → 清除后不聚焦（用户可能要切换示例，移动端示例需点「?」打开浮层，
        //                       自动聚焦弹键盘会遮挡界面，妨碍示例切换）。
        const ballsEl = document.querySelector('.example-cards');
        const ballsHidden = ballsEl ? getComputedStyle(ballsEl).display === 'none' : true;
        const willFocus = !ballsHidden || clearWasFocused;

        // 结果卡统一即时收起（animate=false）：避免 600ms 过渡动画与滚动/聚焦重叠；
        // 若回焦（聚焦须同步 + 布局静止，iOS 硬约束），更不能有动画——恢复为全场景即时。
        resetResultCard(false);
        setDialogCollapsed(false); // 恢复完整对话卡
        dialogStyleLocked = false; // 解冻（与 FUNC-18 示例填充冻结协同；停止对页面的钉位）

        // 滚回本 Define Problem 区块顶部（而非网站首页）：使对话卡回到 hero 居中正常流态。
        // 目标 Y = 区块文档顶部 - 导航栏高度（让区块顶贴导航下方）。
        // 用 behavior:'auto'（即时）而非 smooth：smooth 滚动动画会与「聚焦+键盘」重叠，
        // iOS 在滚动动画进行中聚焦会不绘制光标（与「全新加载点按光标正常」相反——那时页面静止）。
        const solTop = blockEl
          ? (blockEl.getBoundingClientRect().top + window.scrollY)
          : 0;
        const navH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nav-h')) || 80;
        window.scrollTo({ top: Math.max(0, solTop - navH), behavior: 'auto' });

        // 锁定窗口结束后释放：结果卡已收起（resetResultCard 约 600ms 完成），
        // 对话卡保持完整版正常流（非吸顶），清除交互可见。
        setTimeout(() => { analysisToggleLocked = false; }, 650);

        const doFocus = () => {
          void textarea.offsetHeight;
          textarea.focus({ preventScroll: true });
          try { const p = textarea.selectionStart != null ? textarea.selectionStart : textarea.value.length; textarea.setSelectionRange(p, p); } catch (e) {}
          // 聚焦后主动触发「键盘弹起揭示滚动」：键盘已弹起（gap≥120）时把输入框推到键盘上方，
          // 与 visualViewport 的 resize/scroll 事件监听互为兜底（示例球隐藏 + 清除时聚焦的移动端场景）。
          if (revealDialogAboveKeyboard) revealDialogAboveKeyboard();
        };
        if (willFocus) {
          // 同步聚焦（含小屏）：iOS 仅在「用户手势栈内同步 focus」才可靠弹键盘；
          // 延迟 focus（650ms）会被 iOS 忽略、键盘不弹出（2026-08-26 实测结论），
          // 故不能采用「先恢复不聚焦再延迟聚焦」的方案。
          // 突兀感由键盘弹出动画自然掩盖；聚焦后由 revealDialogAboveKeyboard 推高输入框。
          doFocus();
        }
      });
    }

    /* ---- FUNC-18 示例卡片点击：填充打字机 + 冻结滚动（FUNC-19 滚动在 doAnalyze 内）---- */
    const overlay = $('#examplesOverlay');
    const exampleCards = $('.example-cards');
    const heroEl = $('.hero');
    function closeExamples() {
      if (!overlay || !exampleCards || overlay.hidden) return;
      overlay.hidden = true;
      if (heroEl) heroEl.appendChild(exampleCards);
    }

    // FUNC-18「?」按钮（#analyzeHelp）：小屏 → 弹出示例浮层覆盖层；大屏 → 高亮「优秀示例」球引起注意。
    // 浮层是 position:fixed 全屏层，已盖住页面，无需锁 body overflow（否则滚动条消失导致布局位移、对话框下移跳闪）。
    function openExamples() {
      if (!overlay || !exampleCards) return;
      // 兜底清除残留的点击反馈动画类：曾点击过的球进入浮层时不再重播「放大缩小」
      exampleCards.querySelectorAll('.is-pulsing').forEach((el) => el.classList.remove('is-pulsing'));
      // 把浮动球移入浮层，使其与浮层同栈（否则 stage 的 z-index:1 会把球压在浮层下方）
      overlay.appendChild(exampleCards);
      // 浮层是 position:fixed，不随页面滚动；但 .example-cards 携带跟随滚动的 --example-y 视差位移，
      // 小屏时球常处于 display:none、--example-y 已被 handleScroll 累积到较大值，
      // 若原样移入固定浮层会把球整体向下平移而走位/看不见。进入浮层即归零，回到基准位置。
      exampleCards.style.setProperty('--example-y', '0px');
      exampleCards.dataset.exY = '0px';
      overlay.hidden = false;
      // 示例球（重新）出现时，触发「优秀示例」的放大后缩小动画（cardPulse），引导注意推荐示例；
      // 播完移除类，避免下次打开时因残留重播（openExamples 开头亦有兜底清除）。
      if (goodCard) {
        void goodCard.offsetWidth;   // 强制 reflow，确保动画可重启
        goodCard.classList.add('is-pulsing');
        goodCard.addEventListener('animationend', function onOpenPulseEnd() {
          goodCard.classList.remove('is-pulsing');
          goodCard.removeEventListener('animationend', onOpenPulseEnd);
        });
      }
    }
    const helpBtn = $('#analyzeHelp');
    const closeBtn = $('#examplesClose');
    const goodCard = $('.example-card--good');
    const isSmallScreen = () => window.matchMedia('(max-width: 1200px)').matches;
    if (helpBtn) {
      // pointerdown 早于 blur：先置锁，使点击「?」导致的输入框失焦不触发折叠（与「开始分析」/清除/示例按钮一致）。
      let helpLockOwned = false;   // 标记是否由本按钮独占持有锁，避免误释放分析周期持有的锁
      helpBtn.addEventListener('pointerdown', () => {
        if (!analysisToggleLocked) helpLockOwned = true;
        analysisToggleLocked = true;
      });
      helpBtn.addEventListener('click', () => {
        if (isSmallScreen()) {
          openExamples();
        } else if (goodCard) {
          // 示例球未被隐藏（大屏）：若「优秀示例」球顶被固定菜单遮住（视口 top < 菜单高），
          // 让内容向下走、使球完整落到菜单下沿之下 —— 即页面向上滚。
          // 目标：球顶恰好 = 菜单高。滚动增量 = ballTop - navH（被遮住时为负 → 向上滚），
          // 平滑滚到位后再高亮。
          const ballTop = goodCard.getBoundingClientRect().top;
          if (ballTop < _navH) window.scrollBy({ top: ballTop - _navH, behavior: 'smooth' });
          goodCard.classList.remove('is-pulsing');
          void goodCard.offsetWidth;   // 重启动画
          goodCard.classList.add('is-pulsing');
          goodCard.addEventListener('animationend', function onGoodPulseEnd() {
            goodCard.classList.remove('is-pulsing');
            goodCard.removeEventListener('animationend', onGoodPulseEnd);
          });
        }
        // 失焦已发生（blur 早于 click），锁已拦截本次折叠。仅当本按钮独占持锁时释放，恢复滚动折叠能力；
        // 若锁由分析周期持有则不动（由 scrollToResult 复位），避免分析中途被折叠闪动。
        if (helpLockOwned) {
          helpLockOwned = false;
          setTimeout(() => { analysisToggleLocked = false; }, 650);
        }
      });
    }
    if (closeBtn) closeBtn.addEventListener('click', closeExamples);
    if (overlay) overlay.addEventListener('click', (e) => { if (e.target === overlay) closeExamples(); });

    // 把「填充示例 + 触发分析」抽成 applyExampleCard，供卡片点击与「空输入默认加载优秀示例」共用
    // opts.instant=true 用于语言切换「重新激活同一示例」：跳过打字机与脉冲动画，即时填充示例文本并走正常分析链路
    const applyExampleCard = (card, opts = {}) => {
      const instant = !!opts.instant;
      closeExamples();
      // 示例文本随语言：繁体界面填 data-text-tcn，简体填 data-text（引擎已支持简/繁输入，分数锁定一致），英文填 data-text-en
      const lang = window.I18N ? window.I18N.lang : 'en';
      const isChinese = (lang === 'scn' || lang === 'zh-tcn');
      const text = (lang === 'zh-tcn' && card.getAttribute('data-text-tcn'))
        ? card.getAttribute('data-text-tcn')
        : (isChinese
          ? card.getAttribute('data-text')
          : (card.getAttribute('data-text-en') || card.getAttribute('data-text')));
      if (textarea && text) {
        if (!instant) {
          // 点击反馈：放大后缩小动画（cardPulse 0.5s），播完立即移除类，
          // 避免类残留导致「下次打开示例浮层时曾点击过的球重播动画」
          card.classList.remove('is-pulsing');
          void card.offsetWidth;
          card.classList.add('is-pulsing');
          card.addEventListener('animationend', function onPulseEnd() {
            card.classList.remove('is-pulsing');
            card.removeEventListener('animationend', onPulseEnd);
          });
        }

        const wasCollapsed = isDialogCollapsed();
        const session = ++activeSession;
        showResultSkeleton();

        /* 冻结：置位功能3 已声明的 dialogStyleLocked（handleScroll 守卫由 Step 4 自补，§1.5）；
           不碰 <body> overflow，避免破坏 position:sticky 对话卡 */
        dialogStyleLocked = true;
        scrollFrozenY = window.scrollY;

        /* 折叠态下点击示例卡：立即恢复完整版，让「展开动画」与「打字效果」同时进行，
           而不是等打字结束再展开（原逻辑会先折叠展开再打字，视觉割裂）。 */
        if (wasCollapsed) setDialogCollapsed(false);

        if (instant) {
          // 语言切换重激活：即时填充新语言示例文本（不重播打字机），走正常分析链路重渲染结果卡
          textarea.value = text;
          if (typeof syncClearButton === 'function') syncClearButton();
          doAnalyze(null, session);
        } else {
          typeText(textarea, text, () => doAnalyze(null, session));
        }
      }
    };

    document.querySelectorAll('.example-card').forEach((card) => {
      card.addEventListener('pointerdown', () => { analysisToggleLocked = true; }); // 同按钮：预置锁防示例点击导致的失焦折叠闪动
      card.addEventListener('click', () => applyExampleCard(card));
    });

    // 空输入默认加载「优秀示例」：与点击「优秀示例」卡片效果完全一致
    runGoodExample = () => { if (goodCard) applyExampleCard(goodCard); };

    /* ---- FUNC-08 吸顶折叠：绑定 window 滚动（与 intro 区块一致的层叠滚动）---- */
    onScroll(handleScroll); // 接入统一滚动管理器（handleScroll 内部仍以 window._navScrolling 自守卫）
    window.addEventListener('resize', onResize);

    /* 先按导航栏实测高度写入吸顶偏移，再做首次滚动判定 */
    updateStickTopVar();
    updateExampleYBounds();      // 首屏计算示例球位移上下限（hero 高度/字体加载后 load 再校正）
    observeNavHeight();
    /* 字体/图片加载完成后导航栏高度可能变化，load 后再校正一次 */
    window.addEventListener('load', function () {
      updateStickTopVar();
      updateExampleYBounds();    // 字体/图片加载完成、hero 高度稳定后重算上下限
      _stickTop = null;
    });

    /* 首屏：若对话框默认是完整版（未折叠），空内容时浏览器会把 textarea 塌成 1 行高度；
       这里主动把高度设为 2 行下限，避免刚加载时完整版只有 1 行文本高度（autoResize 仅 input 触发，首屏不触发）。 */
    if (glassCardEl && !glassCardEl.classList.contains('is-collapsed')) {
      setTextareaFullHeight();
    }

    /* 初始化时计算一次，确保首屏（如位于 Hero）时背景/吸顶态正确（参考 intro-bg 的 hidden 逻辑） */
    handleScroll();

    /* 全局 Tooltip 关闭 */
    document.addEventListener('click', function (e) {
      if (!e.target.closest('.tooltip-container')) {
        document.querySelectorAll('.tooltip-container.active').forEach((c) => c.classList.remove('active'));
      }
    });

    /* ---- i18n 语言切换联动：用当前语言重算动态内容 ---- */
    document.addEventListener('i18n:changed', function () {
      /* 若已出结果卡，且当前输入框内容恰好是某个示例（任一种语言文案），则「重新激活同一示例」：
         用新语言示例文本填充并重新分析，结果卡与示例语言完全一致。
         采用「按文案匹配示例卡」的无状态判定，避免示例打字机派发的 input 事件误清状态。 */
      let matchedCard = null;
      if (result && !result.hidden && textarea) {
        const current = textarea.value.trim();
        if (current) {
          document.querySelectorAll('.example-card').forEach((card) => {
            const variants = [card.getAttribute('data-text'), card.getAttribute('data-text-tcn'), card.getAttribute('data-text-en')].filter(Boolean);
            if (variants.some((v) => v.trim() === current)) matchedCard = card;
          });
        }
      }
      if (matchedCard) {
        applyExampleCard(matchedCard);
      } else if (result && !result.hidden && lastResult && resultQuestions) {
        // 结果卡已渲染（非示例来源）：用当前语言重渲染 6 题文案（仅替换内容，不重播动画）
        resultQuestions.innerHTML = buildResultHTML(lastResult);
      }
      // 字数统计重显示（保持单位与当前语言一致）
      if (charCount && textarea) {
        charCount.textContent = textarea.value.trim().length + (window.I18N ? window.I18N.t('dp.charUnit') : ' 字');
      }
      // 示例分数徽标（基于中文 data-text 计算，语言无关，保险起见重算一次）
      applyExampleScores();
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

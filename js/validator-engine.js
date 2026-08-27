// =============================================================
// Problem Validator — M3 需求分析引擎（核心，纯函数，强复用）
// 来源：FRS-功能集成规格说明书.md → M3（FUNC-09 / FUNC-10 / FUNC-11）
// 1:1 还原附录 A 的 analyze 参考实现；零 DOM 依赖，可直接被 M4 复用。
// 运行：  node "github website/js/validator-engine.js"
// 退出码：全部断言通过 -> 0；任一失败 -> 1
// =============================================================

// ---------- 判定词表（与 FRS 附录 A 逐字一致，禁止私自增删不改单测） ----------
const USER_GROUP_PATTERNS = ["新用户","老用户","老年用户","年轻用户","企业用户","管理员","客户","游客","会员","学生","教师","医生","患者","消费者","买家","卖家","设计师","开发者","经理","员工","家长","儿童"];
const BEHAVIOR_PATTERNS = ["难以","无法","困难","麻烦","复杂","繁琐","太慢","耗时","困惑","不理解","找不到","不知道","忘记","错误","失败","放弃","退出","离开","投诉","痛点","回答?问题","问题","逐个"];
const SCENARIO_KEYWORDS = ["浏览","搜索","查看","购买","支付","结账","注册","登录","退出","上传","下载","填写","选择","比较","咨询","反馈","售后","使用","审核","任务","商品列表"];
const SOLUTION_PATTERNS = ["添加","增加","删除","移除","修改","优化","简化","改进","提升","增强","引入","采用","使用","利用","通过","借助","做","创建","建立","设置","配置","按钮","链接","表单","弹窗","页面","界面","功能","模块","系统","工具","AI","人工智能","自动化","智能化","推荐","提示","通知","提醒","放大","缩小","加大","减小","改大","改小","加粗","变色","高亮","居中","置顶","加阴影","加深","加间距","禁用","改成","重新设计","描边","加边框","左对齐","右对齐","置灰","变亮","调亮","合并","拆分","隐藏","展开","折叠","调大","调小","变粗"];
const PAIN_POINT_KEYWORDS = ["难以","困难","复杂","太慢","困惑","找不到","不知道"];

/* ---------- 繁体中文词表（引擎支持繁体输入的扩展词表，与简体词表语义一一对应） ----------
 * 仅收录与简体写法不同的词（繁简同形词不重复，如 搜索/使用/AI 等）；
 * 简体词表在前、繁体在后：简体文本命中简体词、繁体文本命中繁体词，互不干扰。 */
const USER_GROUP_PATTERNS_HANT = ["新用戶","老用戶","老年用戶","年輕用戶","企業用戶","管理員","客戶","遊客","會員","學生","教師","醫生","消費者","買家","賣家","設計師","開發者","經理","員工","家長","兒童"];
const BEHAVIOR_PATTERNS_HANT = ["難以","無法","困難","麻煩","複雜","繁瑣","耗時","忘記","錯誤","失敗","放棄","離開","投訴","痛點","回答?問題","問題","逐個"];
const SCENARIO_KEYWORDS_HANT = ["瀏覽","購買","結賬","註冊","登錄","上傳","下載","填寫","選擇","比較","諮詢","反饋","售後","審核","任務"];
const SOLUTION_PATTERNS_HANT = ["刪除","移除","優化","簡化","改進","增強","採用","通過","創建","設置","配置","按鈕","連結","表單","彈窗","頁面","模塊","系統","人工智能","自動化","智能化","推薦","縮小","減小","變色","置頂","加陰影","加間距","重新設計","描邊","加邊框","左對齊","右對齊","變亮","調亮","合併","隱藏","展開","摺疊","調大","調小","變粗"];
const PAIN_POINT_KEYWORDS_HANT = ["難以","困難","複雜"];

/* ---------- 英文判定词表（与中文词表语义对应，供英文输入分析复用同一套布尔判定公式） ----------
 * 设计要求：意思相对的中英文输入应命中「同类别」的判定，从而算出相同分数。
 * 词序即命中优先级；匹配用小写 + 词边界，避免「add→additional」「page→pageant」等误判。 */
const USER_GROUP_PATTERNS_EN = ["customers","students","teachers","doctors","patients","consumers","buyers","sellers","designers","developers","managers","employees","parents","children","seniors","elderly","elderly users","senior users","new users","returning users","young users","enterprise users","admin","administrator","members","visitors"];
const BEHAVIOR_PATTERNS_EN = ["difficulty","too difficult to ? read","hard to","difficult","hard","can't","cannot","unable to","unable","confused","confusing","slow","complicated","complex","pain point","problem","answer ? question","question","struggle","struggling","fail","failing","give up","quit","forget","forgetting","can't find","don't know","find it","takes too long","inconvenient"];
const SCENARIO_KEYWORDS_EN = ["browsing","searching","search","viewing","checkout","payment","pay","register","login","upload","download","fill in","filling","selecting","choose","comparing","consult","feedback","after-sales","after sales","using","review","task","ordering","orders","reading","buying","purchasing"];
const SOLUTION_PATTERNS_EN = ["add","create","delete","remove","modify","optimize","simplify","improve","enhance","introduce","adopt","use","using","through","by","build","set up","configure","button","link","form","popup","page","interface","feature","module","system","tool","AI","artificial intelligence","automation","smart","recommend","prompt","notify","remind","design","make","provide","enlarge","shrink","bold","highlight","center","shadow","disable","change to","redesign","outline","border","align left","align right","grey out","brighten","lighten","merge","split","hide","expand","collapse","make bigger","make smaller","make bolder"];
const PAIN_POINT_KEYWORDS_EN = ["hard","difficult","complicated","slow","confused","can't find"];

/* 语言判定：含中文→中文流程（繁体特有字→'zh-hant'，简体/中性→'zh'）；纯英文→英文流程；中英混合→优先中文。 */
function detectLang(text) {
  const trimmed = (text || '').trim();
  if (/[\u4e00-\u9fff]/.test(trimmed)) {
    // 繁体特有字检测（简体文本不会出现这些字形）→ 走繁体流程
    if (/[體戶瀏覽難讀說這裡為後發現點際讓們個處間題問還與設機權軟簡斷續補決議總產質轉換輸網確辦組織構務顧眾區圍號碼聯統爭論證顯優幫較僅須頭類應該種邊項級層歷師醫書會業務員獨綁約觀遠運風飛馬魚鳥車館編絕紅綠藍顏頻細繩筆開請評鍵詞價錢謝陸雞鴨龍龜樂學覺黨東國園圓團單張長門關電飯廠場對隊陽陰隨離響願額領預]/.test(trimmed)) return 'zh-hant';
    return 'zh';
  }
  if (/[a-zA-Z]/.test(trimmed)) return 'en';
  return 'zh';
}

/* 英文词匹配：小写 + 词边界（短语如 "hard to" 也按整体匹配），避免子串误判。
   大小写不敏感：含大写字母的词（如 AI）也统一小写化匹配（ai / AI 均命中），
   但依赖词边界——「wait」等单词内部的 "ai" 不是独立词、不命中。
   弹性短语：词条里的 "?" 表示「此处允许插入任意少量内容」，命中后返回去掉 "?" 的规范形式。
   例如 "answer ? question" 可命中 "answer user's question"、"answer questions of users" 等变体，
   behaviorFound 显示为 "answer question"。 */
function matchEnWord(text, patterns) {
  const lower = text.toLowerCase();
  for (const p of patterns) {
    if (p.indexOf('?') !== -1) {
      // 弹性短语：把 "?" 替换成「允许 0~24 个字符（跨词）」的宽松匹配；
      // 片段去掉首尾空格（中间间隔完全由 [\s\S]{0,24}? 覆盖，含空格/所有格等）；
      // 最后一个词容忍单复数（加可选 s），如 "answer ? question" 可命中 "answer questions of users"
      const parts = p.split('?').map((s) => s.trim().replace(/[.*+^${}()|[\]\\]/g, '\\$&'));
      const last = parts[parts.length - 1];
      const head = parts.slice(0, -1).join('[\\s\\S]{0,24}?');
      const re = new RegExp('\\b' + head + '[\\s\\S]{0,24}?' + last + 's?\\b');
      const norm = p.replace(/\?/g, '').replace(/\s+/g, ' ').trim(); // 去掉 "?" 得规范形式
      if (re.test(lower)) return norm;
      continue;
    }
    const escaped = p.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp('\\b' + escaped + '\\b').test(lower)) return p;
  }
  return null;
}

/* 在给定文本中匹配词表，返回命中词或 null；isEnglish 决定用边界正则还是 includes。 */
function matchFirst(text, patterns, isEnglish) {
  if (isEnglish) return matchEnWord(text, patterns);
  // 中文匹配：遍历全部词条，返回「文本中出现位置最早」的命中
  // （如「瀏覽商品列表」中「瀏覽」与「商品列表」都命中时取更靠前的「瀏覽」，
  //   避免较长名词场景词抢先于具体动作词）。
  let best = null, bestIdx = Infinity;
  const lower = text.toLowerCase();
  for (const p of patterns) {
    let idx = -1;
    if (p.indexOf('?') !== -1) {
      // 中文弹性短语：词条中「?」允许插入任意少量内容（与英文 matchEnWord 的 ? 语义一致），
      // 命中返回去掉「?」的规范形式，如「回答?问题」命中「回答用户问题」→ 返回「回答问题」。
      const parts = p.split('?').map((s) => s.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      const m = new RegExp(parts.join('[\\s\\S]{0,24}?')).exec(text);
      if (m) idx = m.index;
    } else if (/[a-zA-Z]/.test(p)) {
      // 含英文字母的词条（如 AI）：大小写不敏感 + 词边界（避免 wait 内部的 ai 误命中）
      const m = new RegExp('\\b' + p.toLowerCase() + '\\b').exec(lower);
      if (m) idx = m.index;
    } else {
      idx = text.indexOf(p);
    }
    if (idx !== -1 && idx < bestIdx) { bestIdx = idx; best = p; }
  }
  if (best === null) return null;
  if (best.indexOf('?') !== -1) return best.replace(/\?/g, '').replace(/\s+/g, ' ').trim();
  return best;
}

/* 英文方案词匹配：容忍常见词形变化（-s/-es/-ed/-d/-ing/-n/-en），
   如 enlarged/hidden/merging 等形态也能命中原型方案词。
   后缀白名单不含 -er（避免 use 误命中 user）；含大写字母的词（AI）保持大小写敏感。 */
function matchSolutionEnWord(text, patterns) {
  const lower = text.toLowerCase();
  for (const p of patterns) {
    // 词形后缀白名单：单复数 / 过去式 / 进行式 / 部分过去分词
    const SUFFIX = '(?:s|es|ed|d|ing|n|en)?';
    // 词干：对以 e 结尾的动词，容忍「去 e 加 ing」等（enlarge → enlarging），用 (?:e)? 表达；
    // 统一小写化（大小写不敏感，如 AI / ai 均命中），依赖词边界避免 wait 内部的 ai 误命中
    const stem = p.replace(/e$/, '').toLowerCase();
    const esc = stem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp('\\b' + esc + '(?:e)?' + SUFFIX + '\\b');
    if (re.test(lower)) return p;
  }
  return null;
}

// ---------- 痛点短语提取（HMW 与 Q2「行为/痛点」显示共用，保证中英逻辑一致） ----------
// 返回带上下文的完整痛点短语：中文取关键词后紧跟至多 2 字（如「难以」→「难以阅读」）；
// 英文用词形容忍定位实际变体（difficulty 命中 difficult）后追加紧跟 1 词、
// 若为介词（to/for/…/while）再补 1 词（如 hard → hard to read）；
// 关键词本身是短语（含空格，如 can't find）则不追加。
function buildPainPhrase(trimmed, keyword, isEnglish) {
  if (!isEnglish) {
    const idx = trimmed.indexOf(keyword);
    let ctx = trimmed.slice(idx + keyword.length).replace(/^[\s，。；！？、,.!?;:：\d]+/, '');
    for (const other of PAIN_POINT_KEYWORDS.concat(PAIN_POINT_KEYWORDS_HANT)) {
      if (other !== keyword && ctx.startsWith(other)) { ctx = ""; break; }
    }
    ctx = ctx.split(/[\s，。；！？、,.!?;:：]/)[0].slice(0, 2);
    return ctx ? keyword + ctx : keyword;
  }
  const lower = (trimmed || '').toLowerCase();
  const stem = keyword.replace(/e$/, '');
  const esc = stem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp('\\b' + esc + '(?:e)?(?:s|es|ed|d|ing|n|en|ies|y)?\\b');
  const m = re.exec(lower);
  if (!m) return keyword;
  let phrase = m[0];
  if (!keyword.includes(' ')) {
    let rest = lower.slice(m.index + m[0].length).match(/^\s*([\w'-]+)/);
    if (rest) {
      phrase += ' ' + rest[1];
      if (/^(to|for|with|in|on|at|of|from|by|during|while)$/.test(rest[1])) {
        const tail = lower.slice(m.index + m[0].length + rest[0].length).match(/^\s*([\w'-]+)/);
        if (tail) phrase += ' ' + tail[1];
      }
    }
  }
  return phrase;
}

// 判断行为命中词是否本身是痛点词（中文精确 in 简+繁痛点词表 / 英文词形容忍整词匹配）
function isPainKeyword(keyword, isEnglish) {
  if (!isEnglish) return PAIN_POINT_KEYWORDS.concat(PAIN_POINT_KEYWORDS_HANT).includes(keyword);
  const lower = keyword.toLowerCase();
  for (const p of PAIN_POINT_KEYWORDS_EN) {
    const stem = p.replace(/e$/, '');
    const esc = stem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp('^\\b' + esc + '(?:e)?(?:s|es|ed|d|ing|n|en|ies|y)?\\b$').test(lower)) return true;
  }
  return false;
}

// ---------- 场景短语提取（HMW 与 Q3「情境/场景」显示共用，保证中英逻辑一致） ----------
// 返回带上下文的完整场景短语：中文取关键词后紧跟内容，到「时/中/上/后/的/标点」等边界截断、
// 至多 4 字（如「浏览」→「浏览商品列表」）；英文用词形容忍定位实际变体后
// 追加紧跟至多 3 词（如 browsing → browsing the product list）。
function buildScenarioPhrase(trimmed, keyword, isEnglish) {
  if (!isEnglish) {
    const idx = trimmed.indexOf(keyword);
    let ctx = trimmed.slice(idx + keyword.length).replace(/^[\s，。；！？、,.!?;:：\d]+/, '');
    // 边界含简/繁「时/後/的」等（繁体场景常在「…時」结束，如「瀏覽商品列表時」）
    ctx = ctx.split(/[时时中上後後的，。；！？、,.!?;:：]/)[0].slice(0, 4);
    return ctx ? keyword + ctx : keyword;
  }
  const lower = (trimmed || '').toLowerCase();
  const stem = keyword.replace(/e$/, '');
  const esc = stem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp('\\b' + esc + '(?:e)?(?:s|es|ed|d|ing|n|en|ies|y)?\\b');
  const m = re.exec(lower);
  if (!m) return keyword;
  let phrase = m[0];
  const rest = lower.slice(m.index + m[0].length).match(/^\s*([\w'-]+(?:\s+[\w'-]+){0,2})/);
  if (rest) phrase += ' ' + rest[1];
  return phrase;
}

// ---------- FUNC-10 HMW 改写生成（可独立测试；支持中英，由 lang 决定措辞） ----------
function generateHMW(results, trimmed, lang) {
  if (!(results.canBeHMW)) return "";
  const isEn = (lang === 'en');

  let hmw = "";
  if (isEn) {
    hmw += "How might we ";
    hmw += (results.hasUserGroup && results.details.userGroupFound)
      ? `help ${results.details.userGroupFound}` : "help users";
    let pain = "achieve their goals more effectively";
    const lower = (trimmed || '').toLowerCase();
    for (const k of PAIN_POINT_KEYWORDS_EN) {
      // 词形容忍：difficulty/difficulties 也能命中 difficult（\bdifficult\b 匹配不了名词/复数形式）
      const stem = k.replace(/e$/, '');
      const esc = stem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (new RegExp('\\b' + esc + '(?:e)?(?:s|es|ed|d|ing|n|en|ies|y)?\\b').test(lower)) {
        pain = `solve the problem of ${buildPainPhrase(trimmed, k, true)}`;
        break;
      }
    }
    // 痛点（solve the problem of <痛点>）置于场景之前，结构为「help <群体> solve the problem of <痛点> while <场景>?」
    hmw += ` ${pain}`;
    if (results.details.scenarioFound) hmw += ` while ${results.details.scenarioFound}`;
    hmw += "?";
    return hmw;
  }

  const hant = (lang === 'zh-hant');   // 繁体流程：模板与默认文案用繁体字形
  hmw += "如何";
  hmw += (results.hasUserGroup && results.details.userGroupFound)
    ? (hant ? `幫助${results.details.userGroupFound}` : `帮助${results.details.userGroupFound}`)
    : (hant ? "幫助用戶" : "帮助用户");
  const scenarioPart = (results.details.scenarioFound)
    ? (hant ? `在${results.details.scenarioFound}時` : `在${results.details.scenarioFound}时`)
    : "";
  let pain = hant ? "更好地完成目標" : "更好地完成目标";
  for (const k of PAIN_POINT_KEYWORDS.concat(PAIN_POINT_KEYWORDS_HANT)) {
    if (trimmed.includes(k)) {
      // 痛点存在：把「解決…的問題」包住场景，结构为「帮助<群体>解決在<场景>時<痛点>的問題」
      pain = `${hant ? "解決" : "解决"}${scenarioPart}${buildPainPhrase(trimmed, k, false)}${hant ? "的問題" : "的问题"}`;
      break;
    }
  }
  // 无痛点词（兜底）：保持原结构「在<场景>時更好地完成目标」不变
  if (pain === (hant ? "更好地完成目標" : "更好地完成目标") && scenarioPart) {
    pain = `${scenarioPart}${pain}`;
  }
  hmw += `${pain}？`;
  return hmw;
}

// ---------- FUNC-09 分析引擎（纯函数，支持中英输入，判定公式一致） ----------
function analyze(text) {
  const results = {
    hasUserGroup: false, hasUserBehavior: false, hasScenario: false,
    hasSolution: false,
    standsWithoutSolution: false, canBeHMW: false,
    score: 0, hmwQuestion: "", details: {}
  };
  const trimmed = (text || '').trim();
  if (trimmed.length === 0) return { ...results, score: 0 };

  const lang = detectLang(trimmed);
  const isEnglish = (lang === 'en');

  /* 按语言选词表：英文用语义对应的英文词表；中文（简/繁）用简体+繁体合并词表
     （简体在前、繁体在后，各自命中对应字形，走同一套布尔判定公式）。 */
  const G = isEnglish
    ? { user: USER_GROUP_PATTERNS_EN, behavior: BEHAVIOR_PATTERNS_EN, scenario: SCENARIO_KEYWORDS_EN, solution: SOLUTION_PATTERNS_EN }
    : { user: USER_GROUP_PATTERNS.concat(USER_GROUP_PATTERNS_HANT), behavior: BEHAVIOR_PATTERNS.concat(BEHAVIOR_PATTERNS_HANT), scenario: SCENARIO_KEYWORDS.concat(SCENARIO_KEYWORDS_HANT), solution: SOLUTION_PATTERNS.concat(SOLUTION_PATTERNS_HANT) };

  const ug = matchFirst(trimmed, G.user, isEnglish);
  if (ug) { results.hasUserGroup = true; results.details.userGroupFound = ug; }

  const bh = matchFirst(trimmed, G.behavior, isEnglish);
  if (bh) {
    results.hasUserBehavior = true;
    results.details.behaviorFound = bh;
    // 命中的是痛点词时补充痛点上下文（与 HMW 保持一致，Q2 显示「难以阅读 / difficulty reading」）
    if (isPainKeyword(bh, isEnglish)) {
      results.details.behaviorFound = buildPainPhrase(trimmed, bh, isEnglish);
    }
  }

  const sc = matchFirst(trimmed, G.scenario, isEnglish);
  if (sc) {
    results.hasScenario = true;
    // 场景词补全上下文（Q3 显示与 HMW 共用），如「浏览」→「浏览商品列表」、browsing → browsing the product list
    results.details.scenarioFound = buildScenarioPhrase(trimmed, sc, isEnglish);
  }

  const foundSolutions = [];
  if (isEnglish) {
    for (const p of G.solution) if (matchSolutionEnWord(trimmed, [p])) { results.hasSolution = true; foundSolutions.push(p); }
    if (foundSolutions.length > 0) results.details.solutionFound = foundSolutions.join(", ");
  } else {
    const lowerTrim = trimmed.toLowerCase();
    for (const p of G.solution) {
      // 含英文字母词条（如 AI）：大小写不敏感 + 词边界（ai/AI 均命中，wait 内部 ai 不命中）；
      // 纯中文词条保持 includes 子串命中
      const hit = /[a-zA-Z]/.test(p)
        ? new RegExp('\\b' + p.toLowerCase() + '\\b').test(lowerTrim)
        : trimmed.includes(p);
      if (hit) { results.hasSolution = true; foundSolutions.push(p); }
    }
    if (foundSolutions.length > 0) results.details.solutionFound = foundSolutions.join("、");
  }

  results.standsWithoutSolution = results.hasUserGroup && results.hasUserBehavior && results.hasScenario;
  results.canBeHMW = results.hasUserBehavior && results.hasScenario;

  results.hmwQuestion = generateHMW(results, trimmed, lang);

  results.score = [
    results.hasUserGroup, results.hasUserBehavior, results.hasScenario,
    !results.hasSolution,
    results.standsWithoutSolution, results.canBeHMW
  ].filter(Boolean).length;
  return results;
}

// FUNC-11 示例分数预计算（引擎复用）
function precomputeExampleScores(exampleTexts) {
  const out = {};
  for (const t of exampleTexts) out[t] = analyze(t).score;
  return out;
}

// ---------- 导出（供 M4 等后续步骤复用） ----------
// 浏览器环境暴露（供 validator-orchestration.js 通过 ValidatorEngine.analyze 调用）
if (typeof window !== 'undefined') {
  window.ValidatorEngine = {
    analyze, generateHMW, precomputeExampleScores, detectLang,
    USER_GROUP_PATTERNS, BEHAVIOR_PATTERNS, SCENARIO_KEYWORDS,
    SOLUTION_PATTERNS, PAIN_POINT_KEYWORDS,
    USER_GROUP_PATTERNS_HANT, BEHAVIOR_PATTERNS_HANT, SCENARIO_KEYWORDS_HANT,
    SOLUTION_PATTERNS_HANT, PAIN_POINT_KEYWORDS_HANT,
    USER_GROUP_PATTERNS_EN, BEHAVIOR_PATTERNS_EN, SCENARIO_KEYWORDS_EN,
    SOLUTION_PATTERNS_EN, PAIN_POINT_KEYWORDS_EN
  };
}
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    analyze, generateHMW, precomputeExampleScores, detectLang,
    USER_GROUP_PATTERNS, BEHAVIOR_PATTERNS, SCENARIO_KEYWORDS,
    SOLUTION_PATTERNS, PAIN_POINT_KEYWORDS,
    USER_GROUP_PATTERNS_HANT, BEHAVIOR_PATTERNS_HANT, SCENARIO_KEYWORDS_HANT,
    SOLUTION_PATTERNS_HANT, PAIN_POINT_KEYWORDS_HANT,
    USER_GROUP_PATTERNS_EN, BEHAVIOR_PATTERNS_EN, SCENARIO_KEYWORDS_EN,
    SOLUTION_PATTERNS_EN, PAIN_POINT_KEYWORDS_EN
  };
}

// =============================================================
// 内置自测（仅在本文件被 node 直接执行时运行）
// 断言口径严格遵循 功能1 - M3 需求分析引擎.md §6 全部断言清单；
// 4 个 data-text 分数锁定 6/4/0/0；HMW 按 FRS 第 360 行「防脆断约定」
// 只断言结构，不逐字断言整句。
// =============================================================
if (typeof require !== "undefined" && require.main === module) {
  let pass = 0, fail = 0;
  const log = (ok, msg) => {
    if (ok) { pass++; console.log("  ✅ " + msg); }
    else { fail++; console.log("  ❌ " + msg); }
  };
  const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  console.log("\n[1] A. 空串短路");
  const e = analyze("");
  log(e.score === 0 && !e.hasUserGroup && !e.hasUserBehavior && !e.hasScenario &&
       !e.hasSolution && !e.canBeHMW && e.hmwQuestion === "", "空输入返回 score:0、字段全 false、hmwQuestion 空");

  // FUNC-11 锁定的 4 个 data-text（取自 github website/index.html 实际值）
  const good = "老年用户在浏览商品列表时，因为字体太小而难以阅读商品信息。";
  const avg = "老年用户觉得商品列表上的文字太小，难以看清，希望改大一些。";
  const bad = "添加一个AI聊天机器人功能，用来回答用户问题。";
  const off = "把标题放大";

  console.log("\n[2] B. FUNC-11 锁定分数（【锁】）");
  const g = analyze(good);
  log(g.score === 6, `优秀示例 score=6（实际 ${g.score}）`);
  log(analyze(avg).score === 5, `一般示例 score=5（含群体/痛点/场景+方案，实际 ${analyze(avg).score}）`);
  log(analyze(bad).score === 1, `较差示例 score=1（实际 ${analyze(bad).score}）`);
  log(analyze(off).score === 0, `不合格示例 score=0（实际 ${analyze(off).score}）`);
  log(analyze(off).hasSolution && analyze(off).details.solutionFound === "放大", "不合格示例 命中方案「放大」");

  console.log("\n[3] C. 优秀示例标志位");
  log(g.hasUserGroup && g.details.userGroupFound === "老年用户", `hasUserGroup 命中「老年用户」`);
  log(g.hasUserBehavior && g.details.behaviorFound === "难以阅读", `hasUserBehavior 命中「难以阅读」（痛点上下文）`);
  log(g.hasScenario && g.details.scenarioFound === "浏览商品列表", `hasScenario 命中「浏览商品列表」（场景上下文）`);
  log(g.hasSolution === false, `优秀示例未含方案词（!hasSolution 得分）`);
  log(g.standsWithoutSolution === (g.hasUserGroup && g.hasUserBehavior && g.hasScenario), `standsWithoutSolution = 三者皆真`);
  log(g.canBeHMW === (g.hasUserBehavior && g.hasScenario), `canBeHMW = 行为 && 场景`);

  console.log("\n[4] D. HMW（防脆断：只断言结构）");
  log(g.canBeHMW, "优秀示例 canBeHMW 为真");
  log(g.hmwQuestion.startsWith("如何帮助"), `以「如何帮助」开头`);
  log(g.hmwQuestion.includes("帮助老年用户"), `含群体段「帮助老年用户」`);
  log(g.hmwQuestion.endsWith("？"), `以「？」结尾`);
  log(analyze(bad).hmwQuestion === "" && analyze(off).hmwQuestion === "", "canBeHMW 为假时 hmwQuestion 为空串");

  console.log("\n[5] E. 较差示例（score=1，含行为/方案，缺群体与场景）");
  const badC = analyze(bad);
  log(badC.hasUserGroup === false && badC.hasScenario === false, "较差示例 未命中用户群体/场景");
  log(badC.hasUserBehavior && badC.details.behaviorFound === "回答问题", `较差示例 命中行为「回答问题」（弹性短语 回答?问题）`);
  log(badC.hasSolution && badC.details.solutionFound === "添加、功能、AI", `较差示例 命中方案「${badC.details.solutionFound}」`);
  log(badC.standsWithoutSolution === false && badC.canBeHMW === false, "较差示例 stand/hmw=假");

  console.log("\n[6] F. 一般示例（score=5，含群体/痛点/场景+方案，命中方案词「改大」）");
  const a = analyze(avg);
  log(a.hasUserGroup && a.hasUserBehavior && a.hasScenario, "命中用户群体+真实痛点（难以）+场景（商品列表）");
  log(a.details.behaviorFound === "难以看清", "一般示例 行为补全「难以看清」（痛点上下文）");
  log(a.details.scenarioFound === "商品列表", "一般示例 场景命中「商品列表」");
  log(a.hasSolution && a.details.solutionFound === "改大", "命中方案「改大」（含解决方案，!hasSolution 不得分）");
  log(a.standsWithoutSolution === true && a.canBeHMW === true, "三者皆真 → standsWithoutSolution/canBeHMW 均为 true");

  console.log("\n[7] G. AI 大小写不敏感 + 词边界（【锁】）");
  log(analyze("AI").hasSolution === true, "大写「AI」命中方案");
  log(analyze("ai").hasSolution === true, "小写「ai」同样命中方案（不区分大小写）");
  log(analyze("wait").hasSolution === false, "「wait」不命中「ai」（词边界：wait 内部 ai 非独立词）");
  log(analyze("ai chatbot").hasSolution === true, "独立词「ai」命中（词边界）");
  log(analyze("添加一个ai聊天机器人功能").hasSolution && analyze("添加一个ai聊天机器人功能").details.solutionFound.includes("AI"), "中文小写「ai」命中方案（solutionFound 含 AI）");
  log(analyze("老年用户覺得商品难用").hasUserBehavior === false, "繁体「覺得」为主观认知，不命中行为");
  log(analyze("老年用户觉得商品难用").hasUserBehavior === false, "简体「觉得」为主观认知，不命中行为");
  log(analyze("老年用户觉得商品难用，难以找到按钮").hasUserBehavior === true, "含真实痛点「找不到」则命中行为");
  log(analyze("I want a better design.").hasUserBehavior === false, "英文「want」为主观意愿，不命中行为");
  log(analyze("Users feel frustrated with the app.").hasUserBehavior === false, "英文「feel/frustrated」为主观感受，不命中行为");

  console.log("\n[8] H. 多命中 solutionFound 连接符（【锁】）");
  const m = analyze("添加按钮");
  log(m.hasSolution && m.details.solutionFound === "添加、按钮", `solutionFound 连接为「${m.details.solutionFound}」`);

  console.log("\n[9] I. 纯函数 / 确定性 / 可序列化（【锁】）");
  log(eq(analyze(good), analyze(good)), "同输入两次结果深度一致");
  log(JSON.stringify(analyze(good)) !== "" && (() => { try { JSON.parse(JSON.stringify(analyze(good))); return true; } catch { return false; } })(), "analyze 结果可 JSON.stringify 无损序列化");

  console.log("\n[10] J. 界面改动词 → 方案识别");
  // 对页面/界面/元素的具体改动应判定为含解决方案（把标题放大/加粗/高亮/居中/置顶/加阴影/改成…）
  const uiCases = ["把标题放大","把标题加粗","把文字高亮","把内容居中","把菜单置顶","给标题加阴影","改成红色","把按钮禁用","把字体缩小","把颜色加深"];
  let uiOk = true;
  uiCases.forEach((t) => { const r = analyze(t); if (!r.hasSolution) uiOk = false; });
  log(uiOk, "10 类界面改动词均命中方案");
  log(analyze("把标题放大").hasSolution && analyze("把标题放大").score === 0, "把标题放大 → 含方案且 score=0（纯方案）");
  log(analyze("把标题加粗").hasSolution, "把标题加粗 → 含方案");
  log(analyze("把内容居中").hasSolution, "把内容居中 → 含方案");
  log(analyze("改成红色").hasSolution, "改成红色 → 含方案");
  // 英文界面改动词同样命中
  log(analyze("Enlarge the title.").hasSolution, "Enlarge the title. → 含方案");
  log(analyze("Make it bold.").hasSolution, "Make it bold. → 含方案");
  log(analyze("Center the content.").hasSolution, "Center the content. → 含方案");

  console.log("\n[11] K. 英文输入分析（与中文同义输入分数一致）");
  // 与中文 data-text 同义的英文 data-text-en（取自 index.html 实际值）
  const goodEn = "Elderly users have difficulty reading product information while browsing the product list because the font is too small.";
  const avgEn  = "Elderly users find the text too difficult to read while browsing the product list and want it enlarged.";
  const badEn  = "Add an AI chatbot feature to answer user's question.";
  const offEn  = "Enlarge the title.";
  const gEn = analyze(goodEn), aEn = analyze(avgEn), bEn = analyze(badEn), oEn = analyze(offEn);
  const badCn = analyze(bad), offCn = analyze(off);
  log(detectLang(goodEn) === 'en' && detectLang(good) === 'zh', "detectLang 正确识别中英");
  log(gEn.score === g.score, `优秀示例 中英分数一致 ${g.score}/${gEn.score}`);
  log(aEn.score === a.score, `一般示例 中英分数一致 ${a.score}/${aEn.score}`);
  log(bEn.score === badCn.score, `较差示例 中英分数一致 ${badCn.score}/${bEn.score}`);
  log(oEn.score === offCn.score, `不合格示例 中英分数一致 ${offCn.score}/${oEn.score}`);
  log(gEn.canBeHMW === g.canBeHMW && gEn.standsWithoutSolution === g.standsWithoutSolution, "优秀示例 布尔判定与中文一致");
  log(gEn.hasSolution === false, "优秀示例 英文未命中方案");
  log(aEn.hasScenario === true && aEn.details.scenarioFound === "browsing the product list", "一般示例 英文命中场景「browsing the product list」");
  log(aEn.hasSolution && aEn.details.solutionFound === "enlarge", "一般示例 英文命中方案「enlarge」（enlarged 词形命中）");
  log(aEn.details.behaviorFound === "too difficult to read", "一般示例 英文命中行为「too difficult to read」");
  log(bEn.hasSolution && bEn.details.solutionFound === "add, feature, AI", "较差示例 英文命中方案「add, feature, AI」");
  log(bEn.hasUserBehavior && bEn.details.behaviorFound === "answer question", "较差示例 英文命中行为「answer question」");
  log(analyze("The bot answers questions of users.").details.behaviorFound === "answer question", "弹性短语 answer...question(s) 命中复数/插入语变体");
  log(gEn.hmwQuestion.startsWith("How might we help ") && gEn.hmwQuestion.endsWith("?"), `英文 HMW 生成「${gEn.hmwQuestion}」`);
  log(gEn.hmwQuestion.includes("browsing"), "英文 HMW 含场景段 browsing");
  log(gEn.hmwQuestion.includes("difficulty reading"), "英文 HMW 痛点含动词上下文 difficulty reading");
  log(gEn.hmwQuestion === "How might we help elderly solve the problem of difficulty reading while browsing the product list?", `英文 HMW 精确结构「${gEn.hmwQuestion}」`);

  console.log("\n[12] L. 繁体输入分析（引擎支持繁体，与中英同分锁定）");
  // 与 data-text 同义的繁体 data-text-tcn（取自 index.html 实际值）
  const goodH = "老年用戶在瀏覽商品列表時，因為字體太小而難以閱讀商品信息。";
  const avgH  = "老年用戶覺得商品列表上的文字太小，難以看清，希望改大一些。";
  const badH  = "添加一個 AI 聊天機器人功能，用來回答用戶問題。";
  const offH  = "把標題放大";
  const gH = analyze(goodH), aH = analyze(avgH), bH = analyze(badH), oH = analyze(offH);
  log(detectLang(goodH) === 'zh-hant' && detectLang(good) === 'zh', "detectLang 正确识别繁体 zh-hant / 简体 zh");
  log(gH.score === 6 && gH.score === g.score, `优秀繁体 score=6（与简体一致 ${g.score}）`);
  log(aH.score === 5 && aH.score === a.score, `一般繁体 score=5（与简体一致 ${a.score}）`);
  log(bH.score === 1 && bH.score === badCn.score, `较差繁体 score=1（与简体一致 ${badCn.score}）`);
  log(oH.score === 0 && oH.score === offCn.score, `不合格繁体 score=0（与简体一致 ${offCn.score}）`);
  log(gH.details.userGroupFound === "老年用戶", `繁体命中群体「老年用戶」`);
  log(gH.details.behaviorFound === "難以閱讀", `繁体行为补全「難以閱讀」（痛点上下文）`);
  log(gH.details.scenarioFound === "瀏覽商品列表", `繁体场景补全「瀏覽商品列表」`);
  log(aH.details.behaviorFound === "難以看清", "一般繁体 行为补全「難以看清」");
  log(aH.details.scenarioFound === "商品列表", "一般繁体 场景命中「商品列表」");
  log(aH.hasSolution && aH.details.solutionFound === "改大", "一般繁体命中方案「改大」");
  log(bH.hasUserBehavior && bH.details.behaviorFound === "回答問題", "较差繁体 命中行为「回答問題」（弹性短语）");
  log(bH.hasSolution && bH.details.solutionFound === "添加、功能、AI", "较差繁体命中方案「添加、功能、AI」");
  log(gH.hmwQuestion === "如何幫助老年用戶解決在瀏覽商品列表時難以閱讀的問題？", `繁体 HMW 生成「${gH.hmwQuestion}」`);
  log(bH.hmwQuestion === "" && oH.hmwQuestion === "", "canBeHMW 为假时繁体 hmwQuestion 为空串");

  console.log(`\n==== 结果：通过 ${pass} / 失败 ${fail} ====`);
  process.exit(fail === 0 ? 0 : 1);
}

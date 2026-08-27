


// 禁用浏览器滚动位置自动恢复：本站点为滚动驱动的全屏层叠布局，刷新后若浏览器
// 把上次的 scrollY 恢复回来，会导致「可见内容为 Home、导航却高亮 Define Problem」的错位。
// 改为 manual，刷新一律从顶部开始，由 updateActiveNav() 重新计算当前区块。
if ('scrollRestoration' in history) {
  history.scrollRestoration = 'manual';
}

var LoadingManager = (function() {
    var imgCount = 0;
    var imgLoaded = 0;
    var bgCount = 0;
    var bgLoaded = 0;
    var failedImages = [];
    var onCompleteCallback = null;
    var onProgressCallback = null;
    var timeoutId = null;
    var isComplete = false;
    var TIMEOUT = 15000;

    function trackImages() {
        var images = document.getElementsByTagName('img');
        imgCount = images.length;

        if (imgCount === 0) {
            checkAllLoaded();
            return;
        }

        for (var i = 0; i < images.length; i++) {
            var img = images[i];
            if (img.complete) {
                imgLoaded++;
                checkAllLoaded();
            } else {
                img.addEventListener('load', function() {
                    imgLoaded++;
                    updateProgress();
                    checkAllLoaded();
                }, { once: true });
                img.addEventListener('error', function() {
                    imgLoaded++;
                    failedImages.push(this.src);
                    console.warn('Image load failed:', this.src);
                    updateProgress();
                    checkAllLoaded();
                }, { once: true });
            }
        }
    }

    // 收集某元素（可含伪元素）背景图中的 URL，去重后写入 bgImages
    function collectBgUrls(bgImages, el, pseudo) {
        var style = window.getComputedStyle(el, pseudo || null);
        var bgImage = style && style.backgroundImage;

        if (bgImage && bgImage !== 'none') {
            var urls = bgImage.match(/url\(["']?([^"']+)["']?\)/g);
            if (urls) {
                urls.forEach(function(url) {
                    try {
                        var src = url.match(/url\(["']?([^"']+)["']?\)/)[1];
                        if (bgImages.indexOf(src) === -1 && !src.startsWith('data:')) {
                            bgImages.push(src);
                        }
                    } catch (e) {
                        console.warn('Failed to parse background image URL:', url);
                    }
                });
            }
        }
    }

    function trackBackgroundImages() {
        var bgImages = [];
        var elements = document.querySelectorAll('*');

        // 同时追踪元素自身与 ::before / ::after 伪元素上的背景图
        // （如 .define-problem::before 的 bg_validator.jpg、KV 前后封面的 cover.jpg/back_cover.jpg）
        elements.forEach(function(el) {
            collectBgUrls(bgImages, el);
            collectBgUrls(bgImages, el, '::before');
            collectBgUrls(bgImages, el, '::after');
        });

        bgCount = bgImages.length;

        if (bgCount === 0) {
            checkAllLoaded();
            return;
        }

        bgImages.forEach(function(src) {
            var img = new Image();
            img.onload = function() {
                bgLoaded++;
                updateProgress();
                checkAllLoaded();
            };
            img.onerror = function() {
                bgLoaded++;
                failedImages.push(src);
                console.warn('Background image load failed:', src);
                updateProgress();
                checkAllLoaded();
            };
            img.src = src;
        });
    }

    function updateProgress() {
        var total = imgCount + bgCount;
        var loaded = imgLoaded + bgLoaded;
        var progress = total > 0 ? Math.round((loaded / total) * 100) : 100;

        if (onProgressCallback) {
            onProgressCallback(progress);
        }

        console.log('Loading progress:', progress + '% (' + loaded + '/' + total + ')');
    }

    function checkAllLoaded() {
        if (isComplete) return;

        if (imgLoaded >= imgCount && bgLoaded >= bgCount) {
            isComplete = true;
            finishLoading();
        }
    }

    function finishLoading() {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }

        if (failedImages.length > 0) {
            console.warn('Some images failed to load:', failedImages.length);
        }

        console.log('All images loaded, initializing...');

        if (onCompleteCallback) {
            onCompleteCallback(failedImages);
        }
    }

    function forceFinish() {
        if (isComplete) return;

        isComplete = true;
        console.warn('Image loading timeout, forcing completion');
        finishLoading();
    }

    return {
        start: function(onComplete, onProgress) {
            onCompleteCallback = onComplete;
            onProgressCallback = onProgress;

            trackImages();
            trackBackgroundImages();

            timeoutId = setTimeout(forceFinish, TIMEOUT);

            if (imgCount === 0 && bgCount === 0) {
                setTimeout(finishLoading, 100);
            }
        },

        abort: function() {
            isComplete = true;
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
        },

        getOverallProgress: function() {
            var total = imgCount + bgCount;
            var loaded = imgLoaded + bgLoaded;
            return total > 0 ? (loaded / total) * 100 : 100;
        },

        getFailedImages: function() {
            return failedImages;
        },

        isLoadingComplete: function() {
            return isComplete;
        }
    };
})();

var initializationQueue = [];

function queueInitialization(fn) {
    initializationQueue.push(fn);
}

function executeInitialization() {
    console.log('Executing initialization queue...');

    initializationQueue.forEach(function(fn) {
        try {
            fn();
        } catch (e) {
            console.error('Initialization function error:', e);
        }
    });

    initializationQueue = [];
}

    /*加视觉差内容要修改的地方 1/3 */
    var contentObj = ["top","define-problem","intro","pre1","works_graphic","pre2","works_photo","experience","bottom"];


    var contentNum = contentObj.length;
    for(var i=1; i<=contentNum;i++){
        eval("var posControl"+i+"= $('#posControl"+i+"');");
        /*var posControl2 = $('#posControl2');*/

        eval("var content"+i+"= $('."+contentObj[i-1]+"');");
        /*var content1 = $('.top');*/
    }



    function initialVar(){

        screenHeight = $(window).height();
        screenWidth = $(window).width();
    }


    function initialPos(){

        /*preHeight = screenHeight /2;*/

        /*加视觉差内容要修改的地方 2/3 */
        content1.css({'height':screenHeight});
        /* Define Problem(.define-problem / content2) 不钉死高度：随内容自然增长，
           整页随内容滚动（参考 content3/intro 的自然高度 + 页面滚动模型），
           避免结果卡展开超过 100vh 时内容溢出到下一区块。 */
        content3.css({});
        content4.css({'height':screenHeight});
        content5.css({});
        content6.css({'height':screenHeight});
        content7.css({});
        content8.css({});
        content9.css({'height':screenHeight});




    }

    initialVar();


$(document).ready(function() {
    initialVar();
    initialPos();
    // 刷新后强制从顶部开始（配合 history.scrollRestoration='manual'），
    // 确保可见内容与导航高亮都对齐到 Home
    window.scrollTo(0, 0);
    queueInitialization(function() {
        jsVcenter();
    });
});


$(window).resize(function(){
    initialVar();
    initialPos();
    jsVcenter();

});

/* 统一滚动监听管理器：全站仅注册一个 window scroll 监听器，各模块通过 onScroll(cb) 订阅。
   nav 程序化滚动期间（window._navScrolling=true）统一抑制非 always 订阅者，避免示例球 /
   吸顶折叠 / active 判定在平滑滚动中途竞争 DOM。paLayer 故意注册为 always:true，因为其
   动态定位依赖每帧 scroll→paLayerMove 反馈（见 smoothScrollToTarget 注释），不可冻结。 */
var _scrollSubs = [];
function onScroll(cb, opts) {
    _scrollSubs.push({ cb: cb, always: !!(opts && opts.always) });
}
$(window).on('scroll', function () {
    var navScrolling = !!window._navScrolling;
    for (var i = 0; i < _scrollSubs.length; i++) {
        if (navScrolling && !_scrollSubs[i].always) continue;
        _scrollSubs[i].cb();
    }
});

onScroll(function () {
    parallax();
    paLayer();
}, { always: true }); // paLayer 持续运行，不在 nav 滚动期间冻结








function jsVcenter() {


/*    function basic(objectWidth,objectHeight){


        if(screenHeight > 600) {
            var amountTop = (screenHeight - objectHeight) / 2 /10 - 25;
            var amountLeft = (screenWidth - objectWidth) / 2 /10 - 10;
            console.log('screenHeight_up100:'+screenHeight);
        } else {
            amountTop =(screenHeight - objectHeight) / 2  ;
            amountLeft =(screenWidth - objectWidth) / 2 + 5;

        }

        $(this).css('top', amountTop +'rem');
        $(this).css('left', amountLeft +'rem');
    }*/


    $('.jsVcenter').each(function(){

        var objectHeight = $(this).height();
        var amount =(screenHeight - objectHeight) / 2 / 10 ;
        $(this).css({'padding-top':amount +'rem'});
    });

    $('.jsVcenter_up150').each(function(){

        var objectHeight = $(this).height();
        if(screenHeight > 600) {
            var amount = (screenHeight - objectHeight) / 2 /10 - 15;
            console.log('screenHeight_up100:'+screenHeight);
        } else {
                amount =(screenHeight - objectHeight) / 2  ;

            }

        $(this).css('padding-top', amount +'rem');
    });



    $('.jsVcenter_down130').each(function(){
        console.log('jsVcenter_down1000000000000000000000000000');
        var objectHeight = $(this).height();
        var amount = (screenHeight - objectHeight) / 2 / 10 + 13;
        $(this).css('padding-top', amount +'rem');

    });


}


function parallax() {
    var scroll = $(window).scrollTop();
    console.log('parallax scroll:'+scroll);

    $('.parallax-bg-up').each(function() {

        var Pos = $(this).offset().top;
        var distanceFromBottom = Pos - scroll - screenHeight;

        if (Pos > screenHeight && Pos) {
            $(this).css('--parallax-offset-up', (( -distanceFromBottom  ) * 0.1) + 'px');

        } else {
            $(this).css('--parallax-offset-up', (( -scroll ) * 0.5) + 'px');

        }


    });
    $('.parallax-bg-down').each(function() {
        var Pos = $(this).offset().top;
        var distanceFromTop = Pos - scroll - screenHeight + 1100;

        if (Pos > screenHeight && Pos) {
            $(this).css('--parallax-offset-down', (( -distanceFromTop  ) * 0.1) + 'px');

        } else {
            $(this).css('--parallax-offset-down', (( scroll ) * 0.5) + 'px');

        }


    })

}


function paLayer(){

    var scroll = $(window).scrollTop();


    for (var i = 1; i <= contentNum; i++) {
        eval("var content"+i+"Pos = posControl"+i+".offset().top;");
        /*var content2Pos = posControl2.offset().top;*/

        eval("var content"+i+"atTop = content"+i+"Pos - scroll ;");
        /*var content2atTop = content2Pos - scroll ;*/

        eval("var content"+i+"Height = content"+i+".height()");
        /*var content1Height = content1.height();*/

        eval("var content"+i+"PosBottom = content"+i+"Pos + content"+i+"Height;");
        /*var content2PosBottom = content2Pos + content2Height;*/
    }

    /* intro 内部元素（lightCircle/intro1_PC/titleVI/screens…）的竖直/水平位置由 settingTop/Left/Right
       按绝对 scroll 计算（原设计假设 content2=Define Problem=100vh）。结果卡展开使 content2 变高、intro 整体下移后，
       这些元素相对 intro 区块顶的位置就错位了（与用内联 margin-top 定位的元素不一致）。
       这里把 scroll 平移到「intro 进入视口的基准位置」：scrollEff = scroll - content3Pos + 2*screenHeight，
       使 intro 内部定位与 content2 实际高度解耦，结果与内联 margin-top 元素重新对齐。 */
    var scrollEff = scroll - content3Pos + 2 * screenHeight;

    // Store content positions in window for navigation menu to use
    window._contentPositions = {
        posControl1: content1Pos,
        posControl2: content2Pos,
        posControl4: content4Pos || 0,
        posControl5: content5Pos || 0,
        posControl6: content6Pos || 0,
        posControl9: content9Pos || 0
    };
    window._contentHeights = {
        posControl1: content1Height,
        posControl2: content2Height,
        posControl4: content4Height || 0,
        posControl5: content5Height || 0,
        posControl6: content6Height || 0,
        posControl9: content9Height || 0
    };

    /*通过最后一个元素的位置确定内容总长度*/
    var last = $('.screens_guideline');
    var lastPos = last.offset().top;
    var lastHeight = last.height();
    /* Define Problem(content2) 现随内容自然增长：当 result 卡展开使 content2 很高时，
       content3Height 可能变负或过小 → 不强行覆盖 intro 高度，改用 intro 自然高度，
       避免 intro 塌陷/与下一区块重叠（参考 content3 本身即为自然高度）。 */
    var content3Height = lastPos + lastHeight + screenHeight * 0.1 - content2Height  - content1Height;
    console.log('content3HeightHHHHHHHHHHHHHHHHHHHHHHHHHHH:' + lastPos);
    var content3atBottom = lastPos + lastHeight - scroll ;

    if (content3Height > screenHeight * 0.5) {
      content3.css({'height':content3Height});
    } else {
      content3Height = content3.height();   // 兜底：用 intro 自然高度供层叠逻辑使用
    }

    var content2atBottom = content2Pos + content2Height - scroll ;
    var meet = content2PosBottom - content3Pos;


    console.log(content2atTop+':content2atTop');
    console.log(meet+':meet');
    console.log(content2Pos+':content2Pos');
    console.log(content3Pos+':content3Pos');

    var objMoveV = ["lightCircle","intro1_PC","intro1_PC_shadow",
        "intro1_mobile","intro1_mobile_shadow","vi","vi_shadow",
        "screens_sellerPro","screens_sellerPro_shadow","book1","screens_guideline","logo_pattern1","logo_pattern2"];
    var objMoveH = ["titleGraphic","titleVI","titleMedia","titleGuideline"];
    var objMove = objMoveV.concat(objMoveH);
    console.log('objMoveeeeeeeeeeeeeeeeeeeeeeeeee:' + objMove);

    for (var m = 0; m < objMove.length; m++) {

        /*声明上下移动对象的位置并初始化*/
        window[objMoveV[m]+"Top"] = 0;
        /*var lightCircleTop;*/

        /*声明从左到右移动对象的位置并初始化*/
        window[objMoveH[m]+"Left"] = 0;
        /*var titleGraphicLeft;*/

        /*声明从右到左移动对象的位置并初始化*/
        window[objMoveH[m]+"Right"] = 0;
        /*var titleVIRight;*/

        /*声明所有移动对象*/
        window[objMove[m]] = $('.'+ objMove[m]);
        /* var lightCircle = $('.lightCircle');*/



    }



    function settingTop(object, top, origin, speed, max){

        // 用 scrollEff（已平移到 intro 进入视口的基准），而非绝对 scroll，
        // 使 intro 内部元素定位与 Define Problem 实际高度解耦（见上方 scrollEff 说明）
        top = screenHeight * origin - scrollEff * speed;

        object.css({'top':top});
        console.log(object+'Topppppppppppppppppp speed:' + speed+" top" + top);

    }

    function settingLeft(object, left, origin, speed, max){
        // 同 settingTop：用 scrollEff（intro 基准），与 Define Problem 高度解耦
        left = screenWidth * origin + scrollEff * speed;
        var maxLeft = screenWidth * max;
        if(left > maxLeft){
            return;
        }
        object.css({'margin-left': left});
    }

    function settingRight(object, right, origin, speed, max){
        // 同 settingTop：用 scrollEff（intro 基准），与 Define Problem 高度解耦
        right = screenWidth * origin + scrollEff * speed;
        var maxRight = screenWidth * max;
        if(right > maxRight){
            return;
        }
        object.css({'margin-right': right,'display':'block', 'float':'right'});

    }

    // 手机版专用：相对视口的视差。小屏下 scrollEff 过大，settingLeft 会因 left>maxLeft 提前 return，
    // 导致标题静止在右侧；改为按元素中心相对视口中心的进度 p∈[-1,1] 计算 margin-left，
    // 使标题在穿过视口时产生水平漂移，且不依赖绝对 scrollEff，任意屏宽都有可见视差。
    function paLayerTitleMobile(object, originFrac, travelFrac, dir){
        var el = object[0];
        if (!el) return;
        var rect = el.getBoundingClientRect();
        var vh = window.innerHeight || screenHeight;
        var centerY = rect.top + rect.height / 2;
        var p = (vh / 2 - centerY) / vh;        // 元素由下往上穿过视口时 p 由负到正
        p = Math.max(-1, Math.min(1, p));
        var W = window.innerWidth || screenWidth;
        var left = originFrac * W + dir * p * travelFrac * W;
        left = Math.max(0, Math.min(left, W * 0.75));
        object.css({'margin-left': left});
    }


    /*function animateH(object, left, origin, speed, max){
        left = screenWidth * origin + scroll * speed;
        var maxLeft = left / screenWidth;

        /!*向右运动时*!/
        if(speed >0 && maxLeft > max){
            return;
        }

        /!*向左运动时*!/
        if(speed <0 && maxLeft < max){
            return;
        }
        object.css({'margin-left': left});

    }*/

    /*screens_sellerPro.css({'max-width':screenWidth*1.5});
    screens_sellerPro_shadow.css({'max-width':screenWidth*1.5});
    screens_guideline.css({'max-width':screenWidth*1.5});*/

    settingTop(lightCircle, lightCircleTop, 1, 0.7);
    settingRight(titleGraphic,titleGraphicRight,-0.2,0.2,0.05);
    settingTop(intro1_PC, intro1_PCTop, 1.6, 0.35);
    settingTop(intro1_PC_shadow, intro1_PC_shadowTop, 1.3, 0.38);
    // intro1_PCBottom = PC 图底部相对 intro 区块顶的 Y 坐标，用于作为手机样机的锚点
    var intro1_PCBottom = intro1_PC.offset().top + intro1_PC.height();
	
    // 手机样机(intro1_mobile)竖直视差定位：
    //   第3参 origin=-0.4 → intro 刚进视口(scrollEff=0)时 top=-0.4×屏高（起点在区块顶上方 40% 屏高处）
    //   第4参 speed=-0.35 → 随向下滚动 top 增大，手机样机随滚动往下走（与 PC 的 +speed 反向，形成交错视差）
    //   第5参 intro1_PCBottom 意图作为下限/锚点，但 settingTop 当前未使用 max 参数（死参数，仅占位）
    settingTop(intro1_mobile, intro1_mobileTop,-0.6,-0.35,intro1_PCBottom);
	
    // 手机样机阴影(intro1_mobile_shadow)同理，speed 更小(-0.12)移动更慢，第5参同为死参数
    settingTop(intro1_mobile_shadow, intro1_mobile_shadowTop,-0.3,-0.08,intro1_PCBottom);
	
    // titleVI/titleMedia/titleGuideline：桌面端用 scrollEff 视差；手机端改用相对视口视差（见 paLayerTitleMobile）
    if (window.innerWidth <= 768) {
      paLayerTitleMobile(titleVI, 0.1, 0.35, 1);
      paLayerTitleMobile(titleMedia, 0.2, 0.4, 1);
      paLayerTitleMobile(titleGuideline, 0.25, 0.45, -1);
    } else {
      settingLeft(titleVI, titleVILeft, 0.1, 0.2, 0.8);
      settingLeft(titleMedia, titleMediaLeft, 0.2, 0.2, 0.75);
      settingLeft(titleGuideline, titleGuidelineLeft, -0.35, 0.25, 0.8);
    }
    settingTop(book1,book1Top,1.5,0.25);
    settingTop(screens_sellerPro, screens_sellerProTop, 1.8, 0.35);
    settingTop(screens_sellerPro_shadow, screens_sellerPro_shadowTop, 2.5, 0.5);
    settingTop(screens_guideline,screens_guidelineTop,2,0.348);


    if(content2atTop < 0 &&  content2atTop > -content2Height ) {
        /*content2内容的top到达窗口top，并且开始向上滚动的时候，
        下层的content3内容的top也开始从窗口bottom向上滚动，
        这时控制content2内容滚动的是滚动条，控制content3内容滚动的是"content2Height  - content2_out * 0.5"*/

        /*INTRO部分不需要调用paLayerMove*/
        /*paLayerMove(2,-1);*/

    }

    function moveCondition(x){
        var y=x+1;
        var condition = "content"+x+"atTop <= -content"+x+"Height &&  content"+y+"atTop > -content"+y+"Height";
        /*content2atTop <= -content2Height &&  content3atTop > -content3Height
         content2内容的bottom到达窗口top，这时content3内容的top也到达了窗口的top,
         即content2内容的bottom与content3内容的top相遇了，
         这时content3内容继续向上滚动，content4内容开始同样的流程*/

        return eval(condition);
    }

    function moveConditionDown(x){
        var y=x+1;
        var condition = "content"+x+"atTop <= -content"+x+"Height &&  content"+y+"atTop > -content"+y+"Height";
        /*
        content2atTop <= -content2Height &&  content3atTop > -content3Height
         content2内容的bottom到达窗口top，这时content3内容的top也到达了窗口的top,
         即content2内容的bottom与content3内容的top相遇了，
         这时content3内容继续向上滚动，content4内容开始同样的流程*/

        return eval(condition);
    }

    function paLayerMove(x,z){
        eval("console.log('---------layer"+x+" top reach top----------')");

        var y=x+1;
        eval("var content"+x+"_out =  content"+x+"PosBottom - scroll ;");
        eval("var content"+y+"Top = content"+x+"Height  - content"+x+"_out * 0.5;");
        eval("posControl"+y+".css({'top': content"+y+"Top ,'z-index':"+z+"});");

        /* console.log('---------layer2222222222222 reach top----------');

         var content2_out =  content2PosBottom  -  scroll ;
         var content3Top = content2Height  - content2_out * 0.5;
         posControl3.css({'top': content3Top ,'z-index':-1});*/
    }


    if(content3atBottom < (screenHeight * 1.5)) {
        /*paLayerMove(3,-2);*/
        if(screenWidth<=1400){
            settingTop(logo_pattern1,logo_pattern1Top,1.3,0.3);
                if(screenWidth<=1024) {
                    settingTop(logo_pattern1,logo_pattern1Top,1.8,0.3);
                }

            }
        else{
            settingTop(logo_pattern1,logo_pattern1Top,1.2,0.3);
        }

    }

    if(moveCondition(3)) {
        /*paLayerMove(4,-2);*/
        if(screenWidth<=1400){
             settingTop(logo_pattern2,logo_pattern2Top,1.35,0.25);
                if(screenWidth<=1024) {
                    settingTop(logo_pattern2,logo_pattern2Top,1.45,0.2);
                }
        }
        else{
            settingTop(logo_pattern2,logo_pattern2Top,1.25,0.26);
        }

    }

    if(moveCondition(4)) {
        paLayerMove(5,-2);

    }
    if(moveCondition(5)) {
        /*paLayerMove(6,-2);*/

    }

    if(moveCondition(6)) {
        paLayerMove(7,-2);

    }

    var introBg = $('.intro-bg');
    if (content3atBottom < screenHeight) {
        introBg.addClass('hidden');
    } else {
        introBg.removeClass('hidden');
    }

    /*加视觉差内容要修改的地方 3/3 */

}


/* Navigation Menu - Smooth Scroll & Active State Management */
$(document).ready(function() {
    var navItems = $('.nav-item');
    var scrollTimer = null;
    var isAnimating = false;
    var currentActiveIndex = 0; // 保存当前 active 索引

    /**
     * 当菜单水平溢出时，渐进式调整菜单项的水平位置
     * 规则：
     * - 第1项：仅确保当前激活项完全可见
     * - 第2项起（正向/往后切）：让激活项靠左，为后面菜单留空间，上一项至少50%可见
     * - 倒数第2项起（反向/往前切）：让激活项靠右，为前面菜单留空间，下一项至少50%可见
     * 仅在 scrollWidth > clientWidth 时执行，桌面端无影响
     * @param activeItem 当前激活的菜单项
     * @param oldIndex 切换前的菜单索引（用于判断方向）
     */
    function scrollNavMenuToActive(activeItem, oldIndex) {
        var nav = $('.nav-menu')[0];
        if (!nav) return;

        // 仅当菜单有水平溢出时才需要调整（屏幕宽度 < 菜单总宽度）
        if (nav.scrollWidth <= nav.clientWidth) return;

        var navRect = nav.getBoundingClientRect();
        var itemRect = activeItem[0].getBoundingClientRect();
        var itemLeft = itemRect.left - navRect.left;
        var itemRight = itemRect.right - navRect.left;
        var safeMargin = 8;
        // 手机端右侧被固定语言切换按钮占据，计算可见右边界时扣除其宽度（含 1.6rem 间距）
        var langSwitchWidth = 0;
        var langSwitch = document.querySelector('.lang-switch');
        if (langSwitch && window.innerWidth <= 768) {
            langSwitchWidth = langSwitch.getBoundingClientRect().width + parseFloat(getComputedStyle(document.documentElement).fontSize) * 1.6;
        }
        var maxScroll = nav.scrollWidth - nav.clientWidth;
        var allItems = $('.nav-item');
        var currentIndex = allItems.index(activeItem[0]);
        var targetScrollLeft = nav.scrollLeft;
        var needScroll = false;

        // 第一步（最高优先级）：确保当前激活项完全可见
        if (itemLeft < safeMargin) {
            targetScrollLeft = nav.scrollLeft + (itemLeft - safeMargin);
            needScroll = true;
        } else if (itemRight > nav.clientWidth - langSwitchWidth - safeMargin) {
            targetScrollLeft = nav.scrollLeft + (itemRight - nav.clientWidth + langSwitchWidth + safeMargin);
            needScroll = true;
        }
        // 第二步：从第2项起，根据方向渐进式跟随
        else if (currentIndex >= 1) {
            var direction = (typeof oldIndex === 'number') ? (currentIndex - oldIndex) : 0;

            if (direction > 0) {
                // 正向（往后切）：让激活项靠左，为后面菜单留空间
                var desiredLeft = nav.scrollLeft + (itemLeft - safeMargin);
                // 限制：上一项至少50%可见
                if (currentIndex > 0) {
                    var prevRect = allItems[currentIndex - 1].getBoundingClientRect();
                    var prevRight = prevRect.right - navRect.left;
                    var prevW = prevRect.width;
                    var maxForPrev = nav.scrollLeft + prevRight - prevW / 2;
                    desiredLeft = Math.min(desiredLeft, maxForPrev);
                }
                targetScrollLeft = Math.max(0, Math.min(desiredLeft, maxScroll));
                needScroll = Math.abs(targetScrollLeft - nav.scrollLeft) > 1;
            } else if (direction < 0) {
                // 反向（往前切）：让激活项靠右，为前面菜单留空间
                var desiredRight = nav.scrollLeft + (itemRight - (nav.clientWidth - langSwitchWidth - safeMargin));
                // 限制：下一项至少50%可见
                if (currentIndex < allItems.length - 1) {
                    var nextRect = allItems[currentIndex + 1].getBoundingClientRect();
                    var nextLeft = nextRect.left - navRect.left;
                    var nextW = nextRect.width;
                    var minForNext = nav.scrollLeft + nextLeft + nextW / 2 - (nav.clientWidth - langSwitchWidth);
                    desiredRight = Math.max(desiredRight, minForNext);
                }
                targetScrollLeft = Math.max(0, Math.min(desiredRight, maxScroll));
                needScroll = Math.abs(targetScrollLeft - nav.scrollLeft) > 1;
            }
            // direction === 0（初始加载/同项）：不调整
        }

        if (!needScroll) return;
        targetScrollLeft = Math.max(0, Math.min(targetScrollLeft, maxScroll));
        nav.scrollLeft = targetScrollLeft;
    }

    // data-target 到真正滚动目标（posControl 容器）的映射
    // 原则：永远滚动到 posControl 容器的顶部，而不是内容元素（内容元素可能有背景视差 translateY）
    // Home → posControl1, Intro → posControl3(.intro 父容器), Design → posControl5(.works_graphic 父容器)
    // Photography → posControl7(.works_photo 父容器), Contact → posControl9(.bottom 父容器)
    var targetMap = {
        'posControl1':  'posControl1',
        'define-problem':     'posControl2',
        'intro':        'posControl3',
        'works_graphic':'posControl5',
        'works_photo':  'posControl7',
        'bottom':       'posControl9'
    };

    // Smooth scroll on nav item click
    navItems.on('click', function(e) {
        e.preventDefault();
        var targetId = $(this).attr('data-target');
        var containerId = targetMap[targetId] || targetId;
        var targetElement = $('#' + containerId);

        if (targetElement.length) {
            // Set active state immediately on click
            navItems.removeClass('active');
            $(this).addClass('active');
            var oldIndex = currentActiveIndex;
            currentActiveIndex = navItems.index(this);

            // 点击后立即将 active 菜单项滚动到可见区域（移动端水平滑动场景）
            scrollNavMenuToActive($(this), oldIndex);

            isAnimating = true;

            // 动态读取导航栏实际视觉高度（响应式断点下高度可能变化）
            var navHeight = $('.nav-menu').outerHeight();

            // 内容顶部对齐导航栏上方（无偏移）：define-problem 保持 offset=0，由 .hero 的
            // padding-top: var(--nav-h) 把正文推到导航栏正下方，满足"对齐导航栏上方"的要求。
            var noOffsetMenus = ['intro', 'define-problem', 'bottom'];
            var offsetHeight = (noOffsetMenus.indexOf(targetId) !== -1) ? 0 : navHeight;

            // 使用 requestAnimationFrame 实现动态目标滚动
            // 解决层叠滚动机制下目标位置动态变化的问题：
            // - 单次动画，无多次 animate 的停顿和抖动
            // - 每帧动态计算目标，自动适应 paLayerMove 导致的 posControl 位置变化
            // - 不冻结 paLayer，让 scroll 事件自然触发 paLayerMove
            // - Home 目标在顶部时，smoothScrollToTarget 内部会将负值钳制为 0
            // 导航到 Define the Problem：「恢复完整版」与「返回顶部」同步进行——
            //   点击即 forceRestoreDialog() 把对话框展开/解除淡出（此时区块可能尚未进入视口，故用 force 无视 active 守卫），
            //   随后平滑滚动把区块带回视口；期间示例球每帧跟随，到顶时已为完整版，不再有「滚到顶才弹回」的突兀感。
            //   收敛后 navDone 仍调 reconcileDialogState() 兜底重算示例球位置（冗余但确保最终态正确）。
            if (targetId === 'define-problem' && window.ValidatorOrchestration && typeof window.ValidatorOrchestration.forceRestoreDialog === 'function') {
              window.ValidatorOrchestration.forceRestoreDialog();
            }
            var navDone = function () {
              if (targetId === 'define-problem' && window.ValidatorOrchestration && typeof window.ValidatorOrchestration.reconcileDialogState === 'function') {
                window.ValidatorOrchestration.reconcileDialogState();
              }
            };
            smoothScrollToTarget(targetElement, offsetHeight, navDone);
        }
    });

    // requestAnimationFrame 动态目标滚动
    // 核心原理：每帧重新读取 targetElement.offset().top 作为当前目标
    // 上一帧设置的 scrollTop 触发 scroll 事件 → paLayer() 运行 → paLayerMove 更新 posControl 的 top
    // 下一帧读取的 offset().top 已反映更新后的位置，目标动态跟随
    function smoothScrollToTarget(targetElement, offset, onDone) {
        window._navScrolling = true; // 标记程序化滚动开始，冻结示例球/吸顶折叠/active 判定（paLayer 不受影响）
        var startScroll = $(window).scrollTop();
        var startTime = null;
        var duration = 400;

        function easeOutCubic(t) {
            return 1 - Math.pow(1 - t, 3);
        }

        function frame(timestamp) {
            if (!startTime) startTime = timestamp;
            var elapsed = timestamp - startTime;
            var progress = Math.min(elapsed / duration, 1);
            var eased = easeOutCubic(progress);

            // 每帧重新读取目标位置（已反映上一帧 scroll 事件中 paLayer 的更新）
            var currentTarget = targetElement.offset().top - offset;
            // 钳制为非负值：Home 目标在页面顶部时，offset 会导致负值
            if (currentTarget < 0) currentTarget = 0;

            // 从起点插值到当前目标
            var newScroll = startScroll + (currentTarget - startScroll) * eased;
            $(window).scrollTop(newScroll);
            // 每帧同步示例球：导航期间 onScroll 被冻结，须直接重算，保持与页面同步滚动、避免收敛后大跳变
            if (window.ValidatorOrchestration && typeof window.ValidatorOrchestration.updateExampleCards === 'function') {
                window.ValidatorOrchestration.updateExampleCards();
            }
            // 设置 scrollTop 会触发 scroll 事件 → paLayer 更新 posControl → 下一帧读取新位置

            if (progress < 1) {
                requestAnimationFrame(frame);
            } else {
                // 动画完成，先立即设一次目标
                var finalTarget = targetElement.offset().top - offset;
                if (finalTarget < 0) finalTarget = 0;
                $(window).scrollTop(finalTarget);
                // 下一帧再做最终精修：确保 scroll→paLayer 链完全收敛后再定位一次
                requestAnimationFrame(function() {
                    completeNavScroll(targetElement, offset, onDone);
                });
            }
        }

        requestAnimationFrame(frame);
    }

    // 完成导航滚动后的统一处理 + 最终精修
    // 使用 getBoundingClientRect 直接检查视觉位置，用差值迭代修正
    // 不依赖 offset().top（受 posControl 动态 top 和 paLayer 时序影响）
    function completeNavScroll(targetElement, offset, onDone) {
        refinePosition(targetElement, offset, 0, onDone);
    }

    function refinePosition(targetElement, offset, depth, onDone) {
        if (depth >= 5) {
            // 最多迭代 5 次，防止无限循环
            isAnimating = false;
            updateActiveNav();
            window._navScrolling = false; // 程序化滚动结束，恢复示例球/吸顶折叠/active 判定
            if (typeof onDone === 'function') onDone();
            return;
        }

        // 直接检查 targetElement 的视觉顶部位置
        var rect = targetElement[0].getBoundingClientRect();
        var visualTop = rect.top;
        var diff = visualTop - offset;
        var currentScroll = $(window).scrollTop();

        // 页面已在顶部，但目标仍在期望位置上方（offset > rectTop），
        // scrollTop 无法为负数，无法再向上修正，视为收敛
        if (diff < 0 && currentScroll === 0) {
            isAnimating = false;
            updateActiveNav();
            window._navScrolling = false; // 程序化滚动结束，恢复示例球/吸顶折叠/active 判定
            if (typeof onDone === 'function') onDone();
            return;
        }

        if (Math.abs(diff) > 1) {
            // 视觉偏差 > 1px，用差值修正 scrollTop
            // diff > 0: 元素在期望位置下方，需要增加 scrollTop（向下滚）
            // diff < 0: 元素在期望位置上方，需要减少 scrollTop（向上滚）
            var newScroll = currentScroll + diff;
            if (newScroll < 0) newScroll = 0;
            $(window).scrollTop(newScroll);

            // 设置 scrollTop 触发 scroll → paLayer → 可能改变 posControl 位置
            // 下一帧重新检查
            requestAnimationFrame(function() {
                refinePosition(targetElement, offset, depth + 1, onDone);
            });
        } else {
            // 收敛，偏差 < 1px
            isAnimating = false;
            updateActiveNav();
            window._navScrolling = false; // 程序化滚动结束，恢复示例球/吸顶折叠/active 判定
            if (typeof onDone === 'function') onDone();
        }
    }

    // Update active nav item based on scroll position
    function updateActiveNav() {
        var scrollPos = $(window).scrollTop();
        var windowHeight = $(window).height();

        // Don't update active state during programmatic animation
        if (isAnimating) return;

        // Correct mapping: posControl IDs to nav item indices
        // posControl1 → Home(0), posControl2 → Validator(1), posControl3 → Intro(2),
        // posControl5 → Design(3), posControl7 → Photography(4), posControl9 → Contact(5)
        var sections = [
            { selector: '#posControl1', index: 0 },  // Home
            { selector: '#posControl2', index: 1 },  // Validator
            { selector: '#posControl3', index: 2 },  // Intro
            { selector: '#posControl5', index: 3 },  // Design
            { selector: '#posControl7', index: 4 },  // Photography
            { selector: '#posControl9', index: 5 }   // Contact
        ];

        // Find which section is most visible
        var activeIndex = -1;
        var maxVisibleScore = -1;
        
        for (var i = 0; i < sections.length; i++) {
            var $el = $(sections[i].selector);
            if (!$el.length) continue;
            
            // Get position directly from DOM
            var top = $el.offset().top;
            var height = $el.outerHeight();
            var bottom = top + height;
            
            // Calculate visibility score
            var visibleTop = Math.max(scrollPos, top);
            var visibleBottom = Math.min(scrollPos + windowHeight, bottom);
            var visibleHeight = Math.max(0, visibleBottom - visibleTop);
            
            // Score based on visibility and proximity to viewport center
            var sectionCenter = top + height / 2;
            var viewportCenter = scrollPos + windowHeight / 2;
            var centerDistance = Math.abs(sectionCenter - viewportCenter);
            
            // Prefer sections that are closer to viewport center
            var score = visibleHeight - centerDistance * 0.3;
            
            if (score > maxVisibleScore && visibleHeight > 0) {
                maxVisibleScore = score;
                activeIndex = sections[i].index;
            }
        }

        // Only update if we found a new active element
        if (activeIndex >= 0 && activeIndex !== currentActiveIndex) {
            var oldIndex = currentActiveIndex;
            navItems.removeClass('active');
            $(navItems[activeIndex]).addClass('active');
            currentActiveIndex = activeIndex;

            // 滚动触发的 active 变更后，将 active 菜单项滚动到可见区域
            // （仅在菜单水平溢出时执行，桌面端无影响）
            scrollNavMenuToActive($(navItems[activeIndex]), oldIndex);
        }
    }

    // Update nav menu background based on scroll position
    function updateNavBackground() {
        var scrollPos = $(window).scrollTop();
        if (scrollPos > 10) { // ← 滚动超过 n(px) 才触发；改小:> 10 — 滚动一点点就出现，改大：> 200 — 滚动较多才出现。
            $('.nav-menu').addClass('scrolled');
        } else {
            $('.nav-menu').removeClass('scrolled');
        }
    }

    // 通过统一滚动管理器订阅；nav 程序化滚动期间由管理器统一抑制（updateActiveNav 自身也有 isAnimating 守卫）。
    // 但 updateNavBackground 仅按 scrollPos 切换 .scrolled 背景、不参与 DOM 竞争，故标记为 always:true，
    // 确保点击 home 等程序化滚动回到顶部时，背景也能随滚动及时消失。
    var ticking = false;
    onScroll(function () {
        if (!ticking) {
            requestAnimationFrame(function() {
                updateActiveNav();
                updateNavBackground();
                ticking = false;
            });
            ticking = true;
        }
    }, { always: true });

    // Initialize on page load
    setTimeout(function() {
        updateActiveNav();
        updateNavBackground();
    }, 100); // Delay to allow paLayer to calculate initial positions

    // 二次保险：window.load 后再校准一次。配合 history.scrollRestoration='manual'
    // 与 window.scrollTo(0,0)，确保刷新后（含浏览器恢复/加载器延迟场景）导航高亮
    // 与可见区块始终一致，不会出现「可见 Home 但高亮 Define Problem」的错位。
    $(window).on('load', function() {
        window.scrollTo(0, 0);
        updateActiveNav();
        updateNavBackground();
    });
});




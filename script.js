/**
 * Chart Learning App - Logic
 * ローソク足1本ずつめくり + 価格キャリブレーション + リアルタイム損益計算
 */

document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('chartCanvas');
    const ctx = canvas.getContext('2d');
    const fileInput = document.getElementById('chartUpload');
    const imageInput = document.getElementById('imageUpload');
    const nextBtn = document.getElementById('nextDayBtn');
    const prevBtn = document.getElementById('prevDayBtn');
    const autoPlayBtn = document.getElementById('autoPlayBtn');
    const autoRewindBtn = document.getElementById('autoRewindBtn');
    const messageEl = document.getElementById('overlay-message');

    // Make overlay message clickable (use imageInput so mobile devices work too)
    if (messageEl && (imageInput || fileInput)) {
        messageEl.addEventListener('click', () => {
            (imageInput || fileInput).click();
        });
    }

    const sellInput = document.getElementById('sellPos');
    const buyInput = document.getElementById('buyPos');
    const priceInput = document.getElementById('currentPrice');
    const techniqueSelect = document.getElementById('techniqueTag');
    const currentStepEl = document.getElementById('currentStep');
    const historyList = document.getElementById('historyList');

    const stepDecBtn = document.getElementById('stepDec');
    const stepIncBtn = document.getElementById('stepInc');
    const stepSizeInput = document.getElementById('stepSizeInput');
    const speedDecBtn = document.getElementById('speedDecBtn');
    const speedIncBtn = document.getElementById('speedIncBtn');
    const speedValueInput = document.getElementById('speedValueInput');

    // PL display elements
    const unrealizedPLEl = document.getElementById('unrealizedPL');
    const realizedPLEl = document.getElementById('realizedPL');
    const totalPLEl = document.getElementById('totalPL');
    const avgSellPriceEl = document.getElementById('avgSellPriceDisplay');
    const avgBuyPriceEl = document.getElementById('avgBuyPriceDisplay');
    const sellEntryRow = document.getElementById('sellEntryRow');
    const buyEntryRow = document.getElementById('buyEntryRow');
    const sellUnrealizedPLEl = document.getElementById('sellUnrealizedPL');
    const buyUnrealizedPLEl = document.getElementById('buyUnrealizedPL');
    const sellPLRow = document.getElementById('sellPLRow');
    const buyPLRow = document.getElementById('buyPLRow');

    const zoomOutBtn = document.getElementById('zoomOut');
    const zoomInBtn = document.getElementById('zoomIn');
    const zoomLevelInput = document.getElementById('zoomLevelInput');
    const resetCurrentBtn = document.getElementById('resetCurrentBtn');
    const loopFolderBtn = document.getElementById('loopFolderBtn');
    const loopImageBtn = document.getElementById('loopImageBtn');
    const maskResetBtn = document.getElementById('maskResetBtn');
    const maskRevealBtn = document.getElementById('maskRevealBtn');

    // Candle width calibration
    const calibrateBtn = document.getElementById('calibrateBtn');
    const calibrateStatus = document.getElementById('calibrateStatus');

    // Price calibration
    const priceCalibrateBtn = document.getElementById('priceCalibrateBtn');
    const priceCalibrateStatus = document.getElementById('priceCalibrateStatus');
    const priceReadModeToggle = document.getElementById('priceReadModeToggle');

    // Image navigation elements
    const imageNavArea = document.getElementById('imageNavArea');
    const prevImageBtn = document.getElementById('prevImageBtn');
    const nextImageBtn = document.getElementById('nextImageBtn');
    const imageIndexLabel = document.getElementById('imageIndexLabel');

    // App State
    let appState = {
        image: null,
        visibleWidth: 0,
        totalWidth: 0,
        height: 0,
        stepSize: 23,
        currentStep: 0,
        maxSteps: 0,
        history: [],
        isFinished: false,
        scale: 1.0,

        // PL State
        avgSellPrice: 0,  // 売りの平均建値
        avgBuyPrice: 0,    // 買いの平均建値
        accRealizedPL: 0,  // 累計確定損益
        prevSellPos: 0,    // 前回ステップの売りポジション数
        prevBuyPos: 0,     // 前回ステップの買いポジション数

        // Candle Calibration State
        isCalibrating: false,
        calibrationClicks: [],
        candleWidth: null,

        // Price Calibration State
        isPriceCalibrating: false,
        priceCalibrationStep: 0,
        priceCalPoints: [],
        priceCalibrated: false,

        // Price read mode
        priceReadMode: false,

        // Mouse tracking
        mouseX: -1,
        mouseY: -1,
        showCrosshair: false,

        // Paint State
        paintColor: null,
        strokes: [],
        autoPlayRestartTimer: null,
        loadToken: 0,
        paintTool: 'pencil',
        paintFill: false,
        movingStroke: null,
        currentStroke: null,
        isPainting: false,

        // Animation
        animating: false,
        animationFrameId: null,
        autoPlayInterval: null,
        autoRewindInterval: null,
        autoPlaySpeed: 600,

        // Dragging State
        isDraggingMask: false,
        wasDraggingMask: false,

        // Multi-image (folder) state
        imageFiles: [],
        imageFileIndex: 0,

        // Loop mode: null | 'folder' | 'image'
        loopMode: null,

        // Cached offscreen source canvas & rAF flag
        sourceCanvas: null,
        sourceCtx: null,
        drawPending: false,
    };

    // ==========================================
    //  EVENT LISTENERS
    // ==========================================
    if (fileInput) {
        fileInput.addEventListener('change', handleFolderUpload);
        // Android/Mobile Chrome doesn't support webkitdirectory
        fileInput.addEventListener('click', (e) => {
            if (!('webkitdirectory' in document.createElement('input')) || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
                console.log("Folder upload might not be supported on this device. Using single/multiple image selection fallback.");
            }
        });
    }
    // Disable context menu on canvas to avoid interference with clicks/touches
    if (canvas) {
        canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    }
    if (imageInput) imageInput.addEventListener('change', handleImageFileSelect);
    if (nextBtn) nextBtn.addEventListener('click', handleNextDay);
    if (prevBtn) prevBtn.addEventListener('click', handlePrevDay);
    if (autoPlayBtn) autoPlayBtn.addEventListener('click', toggleAutoPlay);
    if (autoRewindBtn) autoRewindBtn.addEventListener('click', toggleAutoRewind);
    if (resetCurrentBtn) resetCurrentBtn.addEventListener('click', resetCurrentImage);
    if (calibrateBtn) calibrateBtn.addEventListener('click', startCalibration);
    if (maskResetBtn) maskResetBtn.addEventListener('click', handleMaskReset);
    if (maskRevealBtn) maskRevealBtn.addEventListener('click', handleMaskReveal);
    if (priceCalibrateBtn) priceCalibrateBtn.addEventListener('click', startPriceCalibration);
    if (priceReadModeToggle) priceReadModeToggle.addEventListener('change', (e) => {
        appState.priceReadMode = e.target.checked;
        updateCursorStyle();
        drawCanvas();
    });

    // === PAINT EVENT LISTENERS ===
    const colorBtns = document.querySelectorAll('.color-btn');
    colorBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const target = e.currentTarget;
            const wasActive = target.classList.contains('active');
            colorBtns.forEach(b => b.classList.remove('active'));
            if (wasActive) {
                appState.paintColor = null; // 再クリックでペイントオフ
            } else {
                target.classList.add('active');
                appState.paintColor = target.dataset.color || null;
            }
            updateCursorStyle();
        });
    });
    // ツールボタン (鉛筆/線/四角/丸/塗りつぶし/文字/移動)
    const toolBtns = document.querySelectorAll('.tool-btn');
    toolBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tool = btn.dataset.tool;
            if (tool === 'fill') {
                appState.paintFill = !appState.paintFill;
                btn.classList.toggle('active', appState.paintFill);
                btn.setAttribute('aria-pressed', String(appState.paintFill));
                return;
            }
            appState.paintTool = tool;
            toolBtns.forEach(b => {
                if (b.dataset.tool !== 'fill') {
                    b.classList.toggle('active', b === btn);
                    b.setAttribute('aria-pressed', String(b === btn));
                }
            });
        });
    });
    const clearPaintBtn = document.getElementById('clearPaintBtn');
    if (clearPaintBtn) {
        clearPaintBtn.addEventListener('click', () => {
            appState.strokes = [];
            drawCanvas();
        });
    }

    // === REAL-TIME P&L UPDATE on input changes ===
    if (priceInput) priceInput.addEventListener('input', () => updatePLDisplay());
    if (sellInput) sellInput.addEventListener('input', () => updatePLDisplay());
    if (buyInput) buyInput.addEventListener('input', () => updatePLDisplay());

    const sellDecBtn = document.getElementById('sellDec');
    const sellIncBtn = document.getElementById('sellInc');
    const buyDecBtn = document.getElementById('buyDec');
    const buyIncBtn = document.getElementById('buyInc');

    function adjustPosition(inputEl, delta) {
        if (!inputEl) return;
        let val = parseInt(inputEl.value) || 0;
        val += delta;
        if (val < 0) val = 0;
        inputEl.value = val;
        updatePLDisplay();
    }

    if (sellDecBtn) sellDecBtn.addEventListener('click', () => adjustPosition(sellInput, -100));
    if (sellIncBtn) sellIncBtn.addEventListener('click', () => adjustPosition(sellInput, 100));
    if (buyDecBtn) buyDecBtn.addEventListener('click', () => adjustPosition(buyInput, -100));
    if (buyIncBtn) buyIncBtn.addEventListener('click', () => adjustPosition(buyInput, 100));

    // Step Control
    if (stepDecBtn) stepDecBtn.addEventListener('click', () => adjustStep(-1));
    if (stepIncBtn) stepIncBtn.addEventListener('click', () => adjustStep(1));
    if (stepSizeInput) stepSizeInput.addEventListener('change', (e) => {
        let val = parseInt(e.target.value);
        if (val < 1) val = 1;
        appState.stepSize = val;
        drawCanvas();
    });

    function adjustSpeed(delta) {
        let val = appState.autoPlaySpeed / 1000 + delta;
        val = Math.max(0.1, Math.min(2.0, Math.round(val * 10) / 10));

        if (speedValueInput) speedValueInput.value = val.toFixed(1);
        appState.autoPlaySpeed = Math.round(val * 1000);

        // 再生中なら新しいスピードでタイマーを再起動
        if (appState.autoPlayInterval) {
            stopAutoPlay();
            startAutoPlay(true);
        } else if (appState.autoRewindInterval) {
            stopAutoRewind();
            startAutoRewind(true);
        }
    }

    if (speedDecBtn) speedDecBtn.addEventListener('click', () => adjustSpeed(0.1));
    if (speedIncBtn) speedIncBtn.addEventListener('click', () => adjustSpeed(-0.1));
    if (speedValueInput) {
        speedValueInput.addEventListener('change', (e) => {
            let val = parseFloat(e.target.value);
            if (isNaN(val)) val = 0.6;
            val = Math.max(0.1, Math.min(2.0, Math.round(val * 10) / 10));
            e.target.value = val.toFixed(1);
            appState.autoPlaySpeed = Math.round(val * 1000);

            // 再生中なら新しいスピードでタイマーを再起動
            if (appState.autoPlayInterval) {
                stopAutoPlay();
                startAutoPlay(true);
            } else if (appState.autoRewindInterval) {
                stopAutoRewind();
                startAutoRewind(true);
            }
        });
    }

    // Zoom Control
    if (zoomOutBtn) zoomOutBtn.addEventListener('click', () => handleZoom(-0.1));
    if (zoomInBtn) zoomInBtn.addEventListener('click', () => handleZoom(0.1));
    if (zoomLevelInput) {
        zoomLevelInput.addEventListener('change', (e) => {
            let val = parseInt(e.target.value);
            if (isNaN(val)) val = Math.round((appState.scale || 1.0) * 100);
            val = Math.max(20, Math.min(500, val));
            e.target.value = val;
            appState.scale = val / 100;
            if (appState.image) drawCanvas();
        });
    }

    // Image navigation buttons
    if (prevImageBtn) prevImageBtn.addEventListener('click', () => navigateImage(-1));
    if (nextImageBtn) nextImageBtn.addEventListener('click', () => navigateImage(1));

    // Loop buttons
    if (loopFolderBtn) loopFolderBtn.addEventListener('click', () => toggleLoopMode('folder'));
    if (loopImageBtn) loopImageBtn.addEventListener('click', () => toggleLoopMode('image'));

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON'].includes(e.target.tagName)) return;
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
            if (appState.strokes.length) { e.preventDefault(); appState.strokes.pop(); drawCanvas(); }
            return;
        }

        if (e.key === 'ArrowRight' || e.key === ' ') {
            if (appState.image && !appState.isFinished && !appState.isCalibrating && !appState.isPriceCalibrating && nextBtn && !nextBtn.disabled) {
                e.preventDefault();
                handleNextDay();
            }
        }
        if (e.key === 'ArrowLeft') {
            if (appState.image && !appState.isFinished && appState.currentStep > 0) {
                e.preventDefault();
                handlePrevDay();
            }
        }
        if (e.key === 'Escape') {
            if (appState.isCalibrating) cancelCandleCalibration();
            if (appState.isPriceCalibrating) cancelPriceCalibration();
        }
    });

    window.addEventListener('resize', () => {
        if (appState.image) drawCanvas();
    });

    // Canvas event handlers
    canvas.addEventListener('click', handleCanvasClick);
    canvas.addEventListener('mousemove', handleCanvasMouseMove);
    canvas.addEventListener('mousedown', handleCanvasMouseDown);
    window.addEventListener('mouseup', handleCanvasMouseUp);
    canvas.addEventListener('mouseleave', handleCanvasMouseLeave);

    // Touch support for mobile
    canvas.addEventListener('touchstart', handleCanvasMouseDown, { passive: false });
    canvas.addEventListener('touchmove', handleCanvasMouseMove, { passive: false });
    window.addEventListener('touchend', handleCanvasMouseUp);
    canvas.addEventListener('touchcancel', handleCanvasMouseLeave);

    // ==========================================
    //  SWIPE GESTURE (スマホ左右スワイプ操作)
    // ==========================================
    let swipeStartX = 0;
    let swipeStartY = 0;
    let swipeStartTime = 0;
    let swipeIsDragging = false; // マスクドラッグ中はスワイプ無効

    canvas.addEventListener('touchstart', (e) => {
        if (e.touches.length !== 1) return;
        swipeStartX = e.touches[0].clientX;
        swipeStartY = e.touches[0].clientY;
        swipeStartTime = Date.now();
        swipeIsDragging = false;
    }, { passive: true });

    canvas.addEventListener('touchmove', (e) => {
        // マスクドラッグ中はスワイプ判定しない
        if (appState.isDraggingMask) {
            swipeIsDragging = true;
        }
    }, { passive: true });

    canvas.addEventListener('touchend', (e) => {
        if (swipeIsDragging) return; // マスクドラッグ後はスワイプ無視
        if (!appState.image) return;
        if (e.changedTouches.length !== 1) return;
        if (appState.isCalibrating || appState.isPriceCalibrating) return;

        const dx = e.changedTouches[0].clientX - swipeStartX;
        const dy = e.changedTouches[0].clientY - swipeStartY;
        const dt = Date.now() - swipeStartTime;

        // 水平方向に30px以上 & 縦より横が大きく & 0.5秒以内
        const isHorizontalSwipe = Math.abs(dx) > 30 && Math.abs(dx) > Math.abs(dy) * 1.5 && dt < 500;

        if (isHorizontalSwipe) {
            if (dx < 0) {
                // 左スワイプ: 次の日
                if (!appState.isFinished && nextBtn && !nextBtn.disabled) {
                    handleNextDay();
                }
            } else {
                // 右スワイプ: 前の日
                if (appState.currentStep > 0 && prevBtn && !prevBtn.disabled) {
                    handlePrevDay();
                }
            }
        }
    }, { passive: true });

    // ==========================================
    //  COORDINATE HELPERS
    // ==========================================
    function screenToImageCoords(e) {
        let clientX = e.clientX;
        let clientY = e.clientY;
        if (e.touches && e.touches.length > 0) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else if (e.changedTouches && e.changedTouches.length > 0) {
            clientX = e.changedTouches[0].clientX;
            clientY = e.changedTouches[0].clientY;
        }

        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const imgX = (clientX - rect.left) * scaleX / (appState.scale || 1.0);
        const imgY = (clientY - rect.top) * scaleY / (appState.scale || 1.0);
        return { x: imgX, y: imgY };
    }

    // ==========================================
    //  MOUSE TRACKING
    // ==========================================
    function requestDrawCanvas() {
        if (appState.drawPending) return;
        appState.drawPending = true;
        requestAnimationFrame(() => {
            appState.drawPending = false;
            drawCanvas();
        });
    }

    function syncMaskState() {
        const minVisible = appState.stepSize * 2;
        const rawSteps = (appState.visibleWidth - minVisible) / appState.stepSize;
        appState.currentStep = Math.max(0, Math.floor(rawSteps));
        if (currentStepEl) currentStepEl.textContent = appState.currentStep;

        if (prevBtn) prevBtn.disabled = appState.visibleWidth <= minVisible;
        if (nextBtn) nextBtn.disabled = appState.visibleWidth >= appState.totalWidth;

        if (appState.visibleWidth >= appState.totalWidth) {
            appState.visibleWidth = appState.totalWidth;
            finishGame();
        } else {
            appState.isFinished = false;
            if (autoPlayBtn) autoPlayBtn.disabled = false;
        }
    }

    function handleCanvasMouseMove(e) {
        if (!appState.image) return;
        const coords = screenToImageCoords(e);
        appState.mouseX = coords.x;
        appState.mouseY = coords.y;

        // --- Dragging Logic ---
        if (appState.isDraggingMask) {
            if (e.cancelable) e.preventDefault();
            let newWidth = coords.x;
            if (newWidth < 0) newWidth = 0;
            if (newWidth > appState.totalWidth) newWidth = appState.totalWidth;

            appState.visibleWidth = newWidth;
            appState.wasDraggingMask = true; // Mark as dragged
            syncMaskState();
            requestDrawCanvas();
            return; // Skip other hover checks (crosshair etc.) during drag
        }

        // --- Cursor Hover Logic ---
        const scale = appState.scale || 1.0;
        const threshold = 15 / scale;

        // 移動ツール: 選択した図形をドラッグ移動
        if (appState.movingStroke) {
            if (e.cancelable) e.preventDefault();
            const m = appState.movingStroke;
            const dx = coords.x - m.last.x, dy = coords.y - m.last.y;
            m.stroke.points.forEach(p => { p.x += dx; p.y += dy; });
            m.last = { x: coords.x, y: coords.y };
            requestDrawCanvas();
            return;
        }

        // If paint mode is active, handle drawing
        if (appState.isPainting && appState.currentStroke) {
            if (e.cancelable) e.preventDefault();
            const cs = appState.currentStroke;
            if (cs.type === 'pen') {
                cs.points.push({ x: coords.x, y: coords.y });
            } else {
                cs.points[1] = { x: coords.x, y: coords.y };
            }
            requestDrawCanvas();
            return; // skip other hover logic while drawing
        }

        // If mouse is near the edge of the mask
        if (Math.abs(coords.x - appState.visibleWidth) < threshold) {
            canvas.style.cursor = 'ew-resize';
        } else {
            // Revert to default or crosshair
            updateCursorStyle();
        }

        if (appState.priceReadMode || appState.isPriceCalibrating || appState.isCalibrating) {
            appState.showCrosshair = true;
            requestDrawCanvas();
        }
    }

    function handleCanvasMouseDown(e) {
        if (!appState.image) return;
        appState.wasDraggingMask = false; // Reset drag status
        const coords = screenToImageCoords(e);
        const scale = appState.scale || 1.0;
        // 閾値を少し大きくしてタッチしやすくする
        const threshold = (e.touches ? 30 : 15) / scale;

        // Start dragging if close to the edge
        if (Math.abs(coords.x - appState.visibleWidth) < threshold) {
            appState.isDraggingMask = true;
            canvas.style.cursor = 'ew-resize';
            if (e.cancelable) e.preventDefault(); // Prevent text selection
            return;
        }

        // Handle painting
        if (appState.paintColor) {
            const tool = appState.paintTool;
            if (e.cancelable) e.preventDefault();
            if (tool === 'text') {
                const txt = window.prompt('テキストを入力');
                if (txt) {
                    appState.strokes.push({ type: 'text', color: appState.paintColor, text: txt, points: [{ x: coords.x, y: coords.y }] });
                    drawCanvas();
                }
                return;
            }
            if (tool === 'move') {
                const hit = findStrokeAt(coords.x, coords.y, 12 / scale);
                if (hit) appState.movingStroke = { stroke: hit, last: { x: coords.x, y: coords.y } };
                return;
            }
            appState.isPainting = true;
            appState.currentStroke = {
                type: tool === 'pencil' ? 'pen' : tool,
                fill: appState.paintFill,
                color: appState.paintColor,
                points: [{ x: coords.x, y: coords.y }]
            };
        }
    }

    function handleCanvasMouseUp(e) {
        if (appState.movingStroke) {
            appState.movingStroke = null;
            drawCanvas();
        }
        if (appState.isDraggingMask) {
            appState.isDraggingMask = false;
            syncMaskState();
            updateCursorStyle(); // Revert cursor
            drawCanvas();
        }
        if (appState.isPainting) {
            appState.isPainting = false;
            if (appState.currentStroke) {
                const cs = appState.currentStroke;
                if (cs.type === 'pen' || cs.points.length >= 2) appState.strokes.push(cs);
                appState.currentStroke = null;
            }
            updateCursorStyle();
            drawCanvas();
        }
    }

    function handleCanvasMouseLeave() {
        appState.movingStroke = null;
        appState.showCrosshair = false;
        appState.mouseX = -1;
        appState.mouseY = -1;
        if (appState.isPainting) {
            appState.isPainting = false;
            if (appState.currentStroke) {
                const cs = appState.currentStroke;
                if (cs.type === 'pen' || cs.points.length >= 2) appState.strokes.push(cs);
                appState.currentStroke = null;
            }
        }
        if (appState.priceReadMode || appState.isPriceCalibrating || appState.isCalibrating || appState.paintColor) {
            drawCanvas();
        }
    }

    // ==========================================
    //  CANVAS CLICK ROUTER
    // ==========================================
    function handleCanvasClick(e) {
        if (appState.wasDraggingMask) {
            appState.wasDraggingMask = false;
            return;
        }

        const coords = screenToImageCoords(e);

        if (appState.isCalibrating) {
            handleCandleCalibrationClick(coords);
            return;
        }
        if (appState.isPriceCalibrating) {
            handlePriceCalibrationClick(coords);
            return;
        }
        if (appState.priceReadMode && appState.priceCalibrated && !appState.isFinished) {
            handlePriceReadClick(coords);
            return;
        }
    }

    // ==========================================
    //  CANDLE WIDTH CALIBRATION
    // ==========================================
    function handleCandleCalibrationClick(coords) {
        appState.calibrationClicks.push(coords.x);

        if (appState.calibrationClicks.length === 1) {
            if (calibrateStatus) {
                calibrateStatus.textContent = '✅ 1本目OK！次のローソク足の中心をクリック';
                calibrateStatus.className = 'calibrate-status step1';
            }
            drawCanvas();
        } else if (appState.calibrationClicks.length >= 2) {
            const x1 = appState.calibrationClicks[0];
            const x2 = appState.calibrationClicks[1];
            const candleWidth = Math.abs(x2 - x1);

            if (candleWidth < 3) {
                if (calibrateStatus) {
                    calibrateStatus.textContent = '⚠️ 幅が小さすぎます。もう一度やり直してください';
                    calibrateStatus.className = 'calibrate-status error';
                }
                appState.calibrationClicks = [];
                return;
            }

            appState.candleWidth = candleWidth;
            appState.stepSize = Math.round(candleWidth);
            if (stepSizeInput) stepSizeInput.value = appState.stepSize;

            appState.isCalibrating = false;
            appState.calibrationClicks = [];
            updateCursorStyle();

            if (calibrateBtn) {
                calibrateBtn.textContent = '📏 再計測';
                calibrateBtn.classList.remove('calibrating');
            }
            if (calibrateStatus) {
                calibrateStatus.textContent = `✅ ローソク足幅: ${appState.stepSize}px に設定完了！`;
                calibrateStatus.className = 'calibrate-status success';
            }

            const initialVisible = appState.stepSize * 2;
            appState.maxSteps = Math.floor((appState.totalWidth - initialVisible) / appState.stepSize);
            drawCanvas();
        }
    }

    function startCalibration() {
        if (!appState.image) { alert('先に画像をアップロードしてください'); return; }
        if (appState.isPriceCalibrating) cancelPriceCalibration();
        if (appState.isCalibrating) { cancelCandleCalibration(); return; }

        appState.isCalibrating = true;
        appState.calibrationClicks = [];
        canvas.style.cursor = 'crosshair';

        if (calibrateBtn) {
            calibrateBtn.textContent = '❌ キャンセル';
            calibrateBtn.classList.add('calibrating');
        }
        if (calibrateStatus) {
            calibrateStatus.textContent = '👆 隣り合うローソク足の中心を2本クリックしてください';
            calibrateStatus.className = 'calibrate-status active';
        }
        drawCanvas();
    }

    function cancelCandleCalibration() {
        appState.isCalibrating = false;
        appState.calibrationClicks = [];
        updateCursorStyle();
        if (calibrateBtn) {
            calibrateBtn.textContent = appState.candleWidth ? '📏 再計測' : '📏 ローソク足幅を計測';
            calibrateBtn.classList.remove('calibrating');
        }
        if (calibrateStatus) {
            calibrateStatus.textContent = appState.candleWidth ? `✅ ローソク足幅: ${appState.stepSize}px` : '';
            calibrateStatus.className = appState.candleWidth ? 'calibrate-status success' : 'calibrate-status';
        }
        drawCanvas();
    }

    // ==========================================
    //  PRICE AXIS CALIBRATION
    // ==========================================
    function startPriceCalibration() {
        if (!appState.image) { alert('先に画像をアップロードしてください'); return; }
        if (appState.isCalibrating) cancelCandleCalibration();
        if (appState.isPriceCalibrating) { cancelPriceCalibration(); return; }

        appState.isPriceCalibrating = true;
        appState.priceCalibrationStep = 1;
        appState.priceCalPoints = [];
        canvas.style.cursor = 'crosshair';

        if (priceCalibrateBtn) {
            priceCalibrateBtn.textContent = '❌ キャンセル';
            priceCalibrateBtn.classList.add('calibrating');
        }
        if (priceCalibrateStatus) {
            priceCalibrateStatus.textContent = '👆 1つ目の基準価格の位置をチャート上でクリック';
            priceCalibrateStatus.className = 'calibrate-status active';
        }
        drawCanvas();
    }

    function cancelPriceCalibration() {
        appState.isPriceCalibrating = false;
        appState.priceCalibrationStep = 0;
        appState.priceCalPoints = [];
        updateCursorStyle();
        if (priceCalibrateBtn) {
            priceCalibrateBtn.textContent = appState.priceCalibrated ? '💰 再計測' : '💰 価格軸を設定';
            priceCalibrateBtn.classList.remove('calibrating');
        }
        if (priceCalibrateStatus) {
            priceCalibrateStatus.textContent = appState.priceCalibrated ? '✅ 価格軸設定済み' : '';
            priceCalibrateStatus.className = appState.priceCalibrated ? 'calibrate-status success' : 'calibrate-status';
        }
        drawCanvas();
    }

    function handlePriceCalibrationClick(coords) {
        if (appState.priceCalibrationStep === 1) {
            const priceStr = prompt('この位置の価格を入力してください (例: 1000):');
            if (priceStr === null || priceStr.trim() === '') return;
            const price = parseFloat(priceStr.replace(/,/g, ''));
            if (isNaN(price)) { alert('有効な数値を入力してください'); return; }

            appState.priceCalPoints.push({ y: coords.y, price: price });
            appState.priceCalibrationStep = 2;

            if (priceCalibrateStatus) {
                priceCalibrateStatus.textContent = `✅ 1点目: ¥${price.toLocaleString()} | 👆 2つ目の基準価格をクリック`;
                priceCalibrateStatus.className = 'calibrate-status step1';
            }
            drawCanvas();

        } else if (appState.priceCalibrationStep === 2) {
            const priceStr = prompt('この位置の価格を入力してください (例: 2000):');
            if (priceStr === null || priceStr.trim() === '') return;
            const price = parseFloat(priceStr.replace(/,/g, ''));
            if (isNaN(price)) { alert('有効な数値を入力してください'); return; }

            appState.priceCalPoints.push({ y: coords.y, price: price });

            const dy = Math.abs(appState.priceCalPoints[0].y - appState.priceCalPoints[1].y);
            if (dy < 5) {
                alert('2つの点が近すぎます。Y座標が異なる位置をクリックしてください');
                appState.priceCalPoints.pop();
                return;
            }

            // Calibration complete!
            appState.isPriceCalibrating = false;
            appState.priceCalibrationStep = 0;
            appState.priceCalibrated = true;
            appState.priceReadMode = true;
            updateCursorStyle();

            if (priceCalibrateBtn) {
                priceCalibrateBtn.textContent = '💰 再計測';
                priceCalibrateBtn.classList.remove('calibrating');
            }
            if (priceCalibrateStatus) {
                const p1 = appState.priceCalPoints[0];
                const p2 = appState.priceCalPoints[1];
                priceCalibrateStatus.textContent = `✅ 設定完了！ ¥${p1.price.toLocaleString()} ↔ ¥${p2.price.toLocaleString()}`;
                priceCalibrateStatus.className = 'calibrate-status success';
            }
            if (priceReadModeToggle) {
                priceReadModeToggle.checked = true;
                priceReadModeToggle.disabled = false;
            }
            drawCanvas();
        }
    }

    // ==========================================
    //  PRICE READING FROM CLICK
    // ==========================================
    function yToPrice(imageY) {
        if (!appState.priceCalibrated || appState.priceCalPoints.length < 2) return null;
        const p1 = appState.priceCalPoints[0];
        const p2 = appState.priceCalPoints[1];
        const price = p1.price + (imageY - p1.y) * (p2.price - p1.price) / (p2.y - p1.y);
        return Math.round(price);
    }

    function handlePriceReadClick(coords) {
        const price = yToPrice(coords.y);
        if (price === null) return;

        if (priceInput) {
            priceInput.value = price;
            priceInput.classList.add('price-flash');
            setTimeout(() => priceInput.classList.remove('price-flash'), 500);
        }
        // Immediately update P&L with new price
        updatePLDisplay();
        drawCanvas();
    }

    function updateCursorStyle() {
        if (appState.paintColor || appState.isCalibrating || appState.isPriceCalibrating || appState.priceReadMode) {
            canvas.style.cursor = 'crosshair';
            canvas.style.touchAction = 'none'; // 操作モード時はスクロールをロック
        } else {
            canvas.style.cursor = 'default';
            canvas.style.touchAction = 'pan-x pan-y'; // 通常時はスクロール可能
        }
    }

    // ==========================================
    //  ZOOM
    // ==========================================
    function handleZoom(delta) {
        if (!appState.image) return;
        let newScale = appState.scale + delta;
        newScale = Math.max(0.2, Math.min(5.0, newScale));
        appState.scale = newScale;
        if (zoomLevelInput) zoomLevelInput.value = Math.round(newScale * 100);
        drawCanvas();
    }

    function adjustStep(delta) {
        let newVal = appState.stepSize + delta;
        if (newVal < 1) newVal = 1;
        appState.stepSize = newVal;
        if (stepSizeInput) stepSizeInput.value = newVal;
        drawCanvas();
    }

    // ==========================================
    //  IMAGE UPLOAD & INIT
    // ==========================================
    function cancelSlideAnimation() {
        if (appState.animationFrameId) {
            cancelAnimationFrame(appState.animationFrameId);
            appState.animationFrameId = null;
        }
        appState.animating = false;
    }

    function handleFolderUpload(e) {
        const files = Array.from(e.target.files).filter(f => f.type.startsWith('image/'));
        e.target.value = '';
        if (files.length === 0) return;

        // Sort by path or filename logically
        files.sort((a, b) => {
            const pathA = a.webkitRelativePath || a.name;
            const pathB = b.webkitRelativePath || b.name;
            return pathA.localeCompare(pathB, undefined, { numeric: true });
        });

        appState.imageFiles = files;
        appState.imageFileIndex = 0;
        updateImageNavUI();
        loadImageAt(0);
    }

    // 画像ファイルを個別選択した場合（複数可）
    function handleImageFileSelect(e) {
        const files = Array.from(e.target.files).filter(f => f.type.startsWith('image/'));
        e.target.value = '';
        if (files.length === 0) return;

        files.sort((a, b) => {
            const pathA = a.webkitRelativePath || a.name;
            const pathB = b.webkitRelativePath || b.name;
            return pathA.localeCompare(pathB, undefined, { numeric: true });
        });

        appState.imageFiles = files;
        appState.imageFileIndex = 0;
        updateImageNavUI();
        loadImageAt(0);
    }

    function loadImageAt(index) {
        const files = appState.imageFiles;
        if (index < 0 || index >= files.length) return;
        const token = ++appState.loadToken;
        loadImageFile(files[index], img => {
            if (token !== appState.loadToken) return; // 古い読み込みは破棄
            initGame(img);
        });
    }

    // File から Image を読み込む (ObjectURL 使用・失敗時はエラー通知)
    function loadImageFile(file, onLoaded, onFail) {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => { URL.revokeObjectURL(url); onLoaded(img); };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            console.error('画像の読み込みに失敗しました:', file && file.name);
            if (onFail) onFail(); else alert('画像を読み込めませんでした: ' + (file && file.name));
        };
        img.src = url;
    }

    function navigateImage(delta) {
        const newIndex = appState.imageFileIndex + delta;
        if (newIndex < 0 || newIndex >= appState.imageFiles.length) return;
        cancelSlideAnimation();
        stopAutoPlay();
        stopAutoRewind();
        appState.imageFileIndex = newIndex;
        updateImageNavUI();
        loadImageAt(newIndex);
    }

    function updateImageNavUI() {
        const total = appState.imageFiles.length;
        const idx = appState.imageFileIndex;
        if (imageNavArea) imageNavArea.classList.toggle('visible', total > 0);
        if (imageIndexLabel) imageIndexLabel.textContent = `${idx + 1} / ${total}`;
        if (prevImageBtn) prevImageBtn.disabled = idx <= 0;
        if (nextImageBtn) nextImageBtn.disabled = idx >= total - 1;
    }

    function initGame(img, keepAutoPlay = false) {
        cancelSlideAnimation();
        appState.image = img;
        appState.totalWidth = img.width;
        appState.height = img.height;
        appState.sourceCanvas = null;
        appState.sourceCtx = null;

        appState.stepSize = (stepSizeInput && parseInt(stepSizeInput.value)) || 23;
        const initialVisible = appState.stepSize * 2;
        appState.visibleWidth = initialVisible;
        appState.currentStep = 0;
        appState.maxSteps = Math.floor((img.width - initialVisible) / appState.stepSize);

        appState.history = [];
        appState.isFinished = false;
        appState.scale = 0.7;
        appState.candleWidth = null;
        appState.isCalibrating = false;
        appState.calibrationClicks = [];
        appState.isPriceCalibrating = false;
        appState.priceCalibrationStep = 0;
        appState.priceCalPoints = [];
        appState.priceCalibrated = false;
        appState.priceReadMode = false;
        appState.showCrosshair = false;
        if (zoomLevelInput) zoomLevelInput.value = 70;

        // Reset PL
        appState.avgSellPrice = 0;
        appState.avgBuyPrice = 0;
        appState.accRealizedPL = 0;
        appState.prevSellPos = 0;
        appState.prevBuyPos = 0;

        // Reset Paint State
        appState.strokes = [];
        appState.currentStroke = null;
        appState.isPainting = false;

        // Reset UI inputs
        if (sellInput) sellInput.value = 0;
        if (buyInput) buyInput.value = 0;
        if (priceInput) priceInput.value = "";
        if (techniqueSelect) techniqueSelect.value = "";
        if (historyList) historyList.innerHTML = "";

        if (nextBtn) nextBtn.disabled = false;
        if (prevBtn) prevBtn.disabled = true;
        if (autoPlayBtn) {
            autoPlayBtn.disabled = false;
            if (!keepAutoPlay) {
                stopAutoPlay();
            } else if (appState.autoPlayInterval) {
                autoPlayBtn.textContent = '停止';
                autoPlayBtn.classList.add('playing');
            }
        }
        if (autoRewindBtn) {
            autoRewindBtn.disabled = false;
            stopAutoRewind();
        }
        if (messageEl) messageEl.style.display = 'none';
        canvas.parentElement.classList.add('has-image');

        if (calibrateBtn) {
            calibrateBtn.textContent = '📏 ローソク足幅を計測';
            calibrateBtn.classList.remove('calibrating');
            calibrateBtn.disabled = false;
        }
        if (calibrateStatus) {
            calibrateStatus.textContent = '💡 最初にローソク足の幅を計測すると、1本ずつ正確にめくれます';
            calibrateStatus.className = 'calibrate-status hint';
        }
        if (priceCalibrateBtn) {
            priceCalibrateBtn.textContent = '💰 価格軸を設定';
            priceCalibrateBtn.classList.remove('calibrating');
            priceCalibrateBtn.disabled = false;
        }
        if (priceCalibrateStatus) {
            priceCalibrateStatus.textContent = '💡 価格軸を設定すると、クリックで株価を自動読み取りできます';
            priceCalibrateStatus.className = 'calibrate-status hint';
        }
        if (priceReadModeToggle) {
            priceReadModeToggle.checked = false;
            priceReadModeToggle.disabled = true;
        }
        if (resetCurrentBtn) resetCurrentBtn.disabled = false;
        if (loopFolderBtn) loopFolderBtn.disabled = false;
        if (loopImageBtn) loopImageBtn.disabled = false;
        if (maskResetBtn) maskResetBtn.disabled = false;
        if (maskRevealBtn) maskRevealBtn.disabled = false;

        canvas.style.cursor = 'default';

        // 新しい画像読み込み時にスクロール位置を左端にリセット
        const container = canvas.parentElement;
        if (container) {
            container.scrollLeft = 0;
            container.scrollTop = 0;
        }

        updatePLDisplay();
        drawCanvas();
    }

    // めくったカウントのみ0にリセット（マスク・ペイント・P&L・履歴は維持）
    function resetCurrentImage() {
        if (!appState.image) return;
        appState.currentStep = 0;
        if (currentStepEl) currentStepEl.textContent = 0;
    }

    // ==========================================
    //  MASK JUMP BUTTONS - マスクを左端 / 右端に瞬時移動
    // ==========================================
    function handleMaskReset() {
        if (!appState.image) return;
        cancelSlideAnimation();
        stopAutoPlay();
        stopAutoRewind();
        // マスクを最小位置（初期位置）に戻す
        const minVisible = appState.stepSize * 2;
        appState.visibleWidth = minVisible;
        appState.currentStep = 0;
        appState.isFinished = false;
        if (currentStepEl) currentStepEl.textContent = 0;
        if (prevBtn) prevBtn.disabled = true;
        if (nextBtn) nextBtn.disabled = false;
        if (autoPlayBtn) autoPlayBtn.disabled = false;
        drawCanvas();
        autoScrollToCurrentPosition(true);
    }

    function handleMaskReveal() {
        const container = canvas.parentElement;
        if (!appState.image || !container) return;

        // アニメーションを即キャンセル
        if (appState.animationFrameId) {
            cancelAnimationFrame(appState.animationFrameId);
            appState.animationFrameId = null;
        }
        appState.animating = false;
        stopAutoPlay();
        stopAutoRewind();
        
        const scale = appState.scale || 1.0;
        // 現在の表示エリア（コンテナ）の右端にあたる画像上のX座標を計算
        // モバイルブラウザでの誤差を考慮して算出
        const scrollLeft = container.scrollLeft;
        const viewportWidth = container.clientWidth;
        let viewportRightX = (scrollLeft + viewportWidth) / scale;
        
        // 画像の右端を超えないように調整
        if (viewportRightX > appState.totalWidth) {
            viewportRightX = appState.totalWidth;
        }

        // マスクを表示範囲の右端に移動
        appState.visibleWidth = viewportRightX;

        // 移動後の位置に合わせてステップ数を再計算
        const minVisible = appState.stepSize * 2;
        const rawSteps = (appState.visibleWidth - minVisible) / appState.stepSize;
        appState.currentStep = Math.max(0, Math.floor(rawSteps));
        if (currentStepEl) currentStepEl.textContent = appState.currentStep;

        // ボタン状態の更新
        if (prevBtn) prevBtn.disabled = appState.visibleWidth <= minVisible;
        if (nextBtn) nextBtn.disabled = appState.visibleWidth >= appState.totalWidth;

        // 完全に右端まで達した場合は完了状態にする
        if (appState.visibleWidth >= appState.totalWidth) {
            finishGame();
        } else {
            appState.isFinished = false;
        }

        drawCanvas();
        // スクロール位置を同期（特にモバイルでの安定性のため）
        autoScrollToCurrentPosition(true);
    }

    // ==========================================
    //  P&L CALCULATION
    // ==========================================

    /**
     * ポジション変更時にP&Lを計算（「次の日」ボタン押下時に呼び出し）
     * - ポジション追加 → 加重平均で建値を更新
     * - ポジション縮小 → 差分を確定損益に加算
     */
    function commitPositionChanges(newSell, newBuy, price) {
        if (price <= 0) return;

        // === BUY SIDE ===
        if (newBuy > appState.prevBuyPos) {
            // 買い増し: 加重平均で建値を更新
            const added = newBuy - appState.prevBuyPos;
            const totalVal = (appState.avgBuyPrice * appState.prevBuyPos) + (price * added);
            appState.avgBuyPrice = totalVal / newBuy;
        } else if (newBuy < appState.prevBuyPos) {
            // 買い減少: 確定損益を計算
            const closed = appState.prevBuyPos - newBuy;
            const profit = closed * (price - appState.avgBuyPrice);
            appState.accRealizedPL += profit;
        }
        if (newBuy === 0) appState.avgBuyPrice = 0;

        // === SELL SIDE ===
        if (newSell > appState.prevSellPos) {
            // 売り増し: 加重平均で建値を更新
            const added = newSell - appState.prevSellPos;
            const totalVal = (appState.avgSellPrice * appState.prevSellPos) + (price * added);
            appState.avgSellPrice = totalVal / newSell;
        } else if (newSell < appState.prevSellPos) {
            // 売り減少: 確定損益を計算
            const closed = appState.prevSellPos - newSell;
            const profit = closed * (appState.avgSellPrice - price);
            appState.accRealizedPL += profit;
        }
        if (newSell === 0) appState.avgSellPrice = 0;
    }

    /**
     * リアルタイムP&L表示を更新
     * - 現在の入力値から含み損益を計算
     * - 建値情報を表示
     * - 合計損益を表示
     */
    function updatePLDisplay() {
        const currentPrice = parseFloat(priceInput?.value) || 0;
        const currentSell = parseInt(sellInput?.value) || 0;
        const currentBuy = parseInt(buyInput?.value) || 0;

        // --- 建値表示 ---
        // 売りの建値（既にポジションがある場合 or 新規エントリーの場合）
        let effectiveSellAvg = appState.avgSellPrice;
        let effectiveBuyAvg = appState.avgBuyPrice;
        let effectiveSellPos = appState.prevSellPos;
        let effectiveBuyPos = appState.prevBuyPos;

        // 新規追加分のプレビュー（まだcommitされていない分）
        if (currentSell > appState.prevSellPos && currentPrice > 0) {
            const added = currentSell - appState.prevSellPos;
            const totalVal = (appState.avgSellPrice * appState.prevSellPos) + (currentPrice * added);
            effectiveSellAvg = totalVal / currentSell;
            effectiveSellPos = currentSell;
        } else if (currentSell < appState.prevSellPos) {
            effectiveSellPos = currentSell;
        }

        if (currentBuy > appState.prevBuyPos && currentPrice > 0) {
            const added = currentBuy - appState.prevBuyPos;
            const totalVal = (appState.avgBuyPrice * appState.prevBuyPos) + (currentPrice * added);
            effectiveBuyAvg = totalVal / currentBuy;
            effectiveBuyPos = currentBuy;
        } else if (currentBuy < appState.prevBuyPos) {
            effectiveBuyPos = currentBuy;
        }

        // 売り建値の表示
        if (sellEntryRow) {
            if (effectiveSellPos > 0 && effectiveSellAvg > 0) {
                sellEntryRow.style.display = 'flex';
                if (avgSellPriceEl) avgSellPriceEl.textContent = `¥${Math.round(effectiveSellAvg).toLocaleString()} × ${effectiveSellPos}`;
            } else {
                sellEntryRow.style.display = 'none';
            }
        }

        // 買い建値の表示
        if (buyEntryRow) {
            if (effectiveBuyPos > 0 && effectiveBuyAvg > 0) {
                buyEntryRow.style.display = 'flex';
                if (avgBuyPriceEl) avgBuyPriceEl.textContent = `¥${Math.round(effectiveBuyAvg).toLocaleString()} × ${effectiveBuyPos}`;
            } else {
                buyEntryRow.style.display = 'none';
            }
        }

        // --- 含み損益の計算 ---
        let sellUnrealized = 0;
        let buyUnrealized = 0;
        let previewRealizedPL = 0;

        if (currentPrice > 0) {
            // 買いの含み損益: (現在価格 - 買い建値) × 保有数
            if (effectiveBuyPos > 0 && effectiveBuyAvg > 0) {
                buyUnrealized = (currentPrice - effectiveBuyAvg) * effectiveBuyPos;
            }

            // 売りの含み損益: (売り建値 - 現在価格) × 保有数
            if (effectiveSellPos > 0 && effectiveSellAvg > 0) {
                sellUnrealized = (effectiveSellAvg - currentPrice) * effectiveSellPos;
            }

            // ポジション縮小のプレビュー確定損益
            if (currentBuy < appState.prevBuyPos && appState.avgBuyPrice > 0) {
                const closed = appState.prevBuyPos - currentBuy;
                previewRealizedPL += closed * (currentPrice - appState.avgBuyPrice);
            }
            if (currentSell < appState.prevSellPos && appState.avgSellPrice > 0) {
                const closed = appState.prevSellPos - currentSell;
                previewRealizedPL += closed * (appState.avgSellPrice - currentPrice);
            }
        }

        const totalUnrealized = sellUnrealized + buyUnrealized;
        const totalRealized = appState.accRealizedPL + previewRealizedPL;
        const totalPL = totalUnrealized + totalRealized;

        // --- 個別含み損益の表示 ---
        if (sellPLRow) {
            if (effectiveSellPos > 0 && currentPrice > 0) {
                sellPLRow.style.display = 'flex';
                if (sellUnrealizedPLEl) {
                    sellUnrealizedPLEl.textContent = formatNumber(sellUnrealized);
                    applyPLClass(sellUnrealizedPLEl, sellUnrealized);
                }
            } else {
                sellPLRow.style.display = 'none';
            }
        }

        if (buyPLRow) {
            if (effectiveBuyPos > 0 && currentPrice > 0) {
                buyPLRow.style.display = 'flex';
                if (buyUnrealizedPLEl) {
                    buyUnrealizedPLEl.textContent = formatNumber(buyUnrealized);
                    applyPLClass(buyUnrealizedPLEl, buyUnrealized);
                }
            } else {
                buyPLRow.style.display = 'none';
            }
        }

        // --- メイン損益表示 ---
        if (unrealizedPLEl) {
            unrealizedPLEl.textContent = formatNumber(totalUnrealized);
            applyPLClass(unrealizedPLEl, totalUnrealized);
        }
        if (realizedPLEl) {
            realizedPLEl.textContent = formatNumber(totalRealized);
            applyPLClass(realizedPLEl, totalRealized);
        }
        if (totalPLEl) {
            totalPLEl.textContent = formatNumber(totalPL);
            applyPLClass(totalPLEl, totalPL);
        }

        // ステップ数
        if (currentStepEl) currentStepEl.textContent = appState.currentStep;
    }

    function formatNumber(val) {
        const rounded = Math.round(val);
        const sign = rounded > 0 ? '+' : '';
        return sign + rounded.toLocaleString();
    }

    function applyPLClass(el, val) {
        el.classList.remove('pl-plus', 'pl-minus', 'pl-zero');
        if (val > 0) el.classList.add('pl-plus');
        else if (val < 0) el.classList.add('pl-minus');
        else el.classList.add('pl-zero');
    }

    // ==========================================
    //  DRAW CANVAS
    // ==========================================
    function drawCanvas() {
        if (!appState.image) return;

        const scale = appState.scale || 1.0;
        const targetWidth = Math.round(appState.image.width * scale);
        const targetHeight = Math.round(appState.image.height * scale);

        let resized = false;
        if (canvas.width !== targetWidth) {
            canvas.width = targetWidth;
            resized = true;
        }
        if (canvas.height !== targetHeight) {
            canvas.height = targetHeight;
            resized = true;
        }

        if (!resized) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }

        ctx.save();
        ctx.scale(scale, scale);

        ctx.drawImage(appState.image, 0, 0);

        if (!appState.isFinished) {
            const isLightTheme = document.body.classList.contains('light-theme');
            const maskColor = isLightTheme ? 'rgba(45, 20, 90, 1.0)' : 'rgba(30, 10, 60, 1.0)';
            ctx.fillStyle = maskColor;

            ctx.fillRect(
                appState.visibleWidth, 0,
                appState.totalWidth - appState.visibleWidth, appState.height
            );

            // Cutting Edge line
            ctx.shadowColor = '#4CAF50';
            ctx.shadowBlur = 8;
            ctx.strokeStyle = '#4CAF50';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.moveTo(appState.visibleWidth, 0);
            ctx.lineTo(appState.visibleWidth, appState.height);
            ctx.stroke();
            ctx.shadowBlur = 0;

            // Day label
            if (appState.currentStep > 0) {
                const stepLabel = `Day ${appState.currentStep}`;
                ctx.font = 'bold 12px "Helvetica Neue", Arial, sans-serif';
                ctx.textAlign = 'right';
                ctx.textBaseline = 'top';
                ctx.fillStyle = 'rgba(76, 175, 80, 0.9)';
                const labelWidth = ctx.measureText(stepLabel).width + 12;
                const pillX = appState.visibleWidth - labelWidth - 4;
                ctx.beginPath();
                roundRect(ctx, pillX, 6, labelWidth + 4, 22, 4);
                ctx.fill();
                ctx.fillStyle = '#fff';
                ctx.fillText(stepLabel, appState.visibleWidth - 6, 10);
            }

            // Price label on green line (when calibrated)
            if (appState.priceCalibrated) {
                const currentPriceVal = parseFloat(priceInput?.value) || 0;
                if (currentPriceVal > 0) {
                    const priceLabel = `￥${currentPriceVal.toLocaleString()}`;
                    ctx.font = 'bold 13px "Helvetica Neue", Arial, sans-serif';
                    const pw = ctx.measureText(priceLabel).width;
                    const px = Math.max(4, appState.visibleWidth - pw - 12);
                    const py = appState.height - 32;
                    ctx.fillStyle = 'rgba(16, 185, 129, 0.9)';
                    ctx.textAlign = 'left';
                    ctx.textBaseline = 'top';
                    roundRect(ctx, px - 4, py - 2, pw + 12, 20, 4);
                    ctx.fill();
                    ctx.fillStyle = '#fff';
                    ctx.fillText(priceLabel, px, py);
                }
            }

            // Candle calibration markers
            if (appState.isCalibrating && appState.calibrationClicks.length > 0) {
                drawCandleCalibrationMarkers();
            }

            // Price calibration markers
            if (appState.priceCalPoints.length > 0 && (appState.isPriceCalibrating || appState.priceCalibrated)) {
                drawPriceCalibrationMarkers();
            }

            // Paint strokes predict lines
            drawPaintStrokes();

            // Crosshair + price tooltip (hide crosshair if painting)
            if (appState.showCrosshair && appState.mouseX >= 0 && appState.mouseY >= 0 && !appState.paintColor) {
                drawCrosshair();
            }
        } else {
            drawResults();
        }

        ctx.restore();
    }

    // ==========================================
    //  AUTO SCROLL - 緑のラインが常に画面内に見えるようスクロール追従
    // ==========================================
    function autoScrollToCurrentPosition(instant = false) {
        const container = canvas.parentElement;
        if (!container || !appState.image) return;

        const scale = appState.scale || 1.0;
        const edgePositionPx = appState.visibleWidth * scale;
        const containerWidth = container.clientWidth;

        // 緑のラインをコンテナの右端から少し手前（30%の位置）に表示
        const targetScroll = edgePositionPx - containerWidth * 0.7;

        // スクロール位置の乖離が大きい場合に追従 (左右両方向)
        if (instant) {
            container.scrollLeft = Math.max(0, targetScroll);
        } else if (Math.abs(container.scrollLeft - targetScroll) > 5) {
            container.scrollTo({
                left: Math.max(0, targetScroll),
                behavior: 'smooth'
            });
        }
    }

    function drawPaintStrokes() {
        const allStrokes = [...appState.strokes];
        if (appState.currentStroke) {
            allStrokes.push(appState.currentStroke);
        }

        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';

        allStrokes.forEach(stroke => {
            if (!stroke.points || stroke.points.length === 0) return;
            const type = stroke.type || 'pen';
            const lw = stroke.color === '#ffffff' ? 8 : 4;

            if (type === 'text') {
                ctx.font = 'bold 24px "Noto Sans JP", sans-serif';
                ctx.textBaseline = 'top';
                ctx.fillStyle = stroke.color;
                ctx.fillText(stroke.text, stroke.points[0].x, stroke.points[0].y);
                return;
            }

            ctx.beginPath();
            if (type === 'pen') {
                if (stroke.points.length === 1) {
                    ctx.fillStyle = stroke.color;
                    ctx.arc(stroke.points[0].x, stroke.points[0].y, 2, 0, Math.PI * 2);
                    ctx.fill();
                    return;
                }
                ctx.strokeStyle = stroke.color;
                ctx.lineWidth = lw;
                ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
                for (let i = 1; i < stroke.points.length; i++) {
                    ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
                }
                ctx.stroke();
                return;
            }

            if (stroke.points.length < 2) return;
            const a = stroke.points[0], b = stroke.points[1];
            ctx.strokeStyle = stroke.color;
            ctx.fillStyle = stroke.color;
            ctx.lineWidth = lw;
            if (type === 'line') {
                ctx.moveTo(a.x, a.y);
                ctx.lineTo(b.x, b.y);
                ctx.stroke();
            } else if (type === 'rect') {
                ctx.rect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y));
                if (stroke.fill) { ctx.globalAlpha = 0.35; ctx.fill(); ctx.globalAlpha = 1; }
                ctx.stroke();
            } else if (type === 'circle') {
                ctx.ellipse((a.x + b.x) / 2, (a.y + b.y) / 2, Math.abs(b.x - a.x) / 2, Math.abs(b.y - a.y) / 2, 0, 0, Math.PI * 2);
                if (stroke.fill) { ctx.globalAlpha = 0.35; ctx.fill(); ctx.globalAlpha = 1; }
                ctx.stroke();
            }
        });
    }

    // 指定座標にある描画オブジェクト(上に描いたもの優先)を探す
    function findStrokeAt(x, y, tol) {
        const distSeg = (p, a, b) => {
            const dx = b.x - a.x, dy = b.y - a.y;
            const l2 = dx * dx + dy * dy;
            let t = l2 ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2 : 0;
            t = Math.max(0, Math.min(1, t));
            return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
        };
        const pt = { x, y };
        for (let i = appState.strokes.length - 1; i >= 0; i--) {
            const s = appState.strokes[i];
            const pts = s.points;
            if (!pts || !pts.length) continue;
            const type = s.type || 'pen';
            if (type === 'text') {
                ctx.font = 'bold 24px "Noto Sans JP", sans-serif';
                const w = ctx.measureText(s.text).width;
                if (x >= pts[0].x - tol && x <= pts[0].x + w + tol && y >= pts[0].y - tol && y <= pts[0].y + 28 + tol) return s;
            } else if (type === 'rect' || type === 'circle') {
                if (pts.length < 2) continue;
                const minX = Math.min(pts[0].x, pts[1].x) - tol, maxX = Math.max(pts[0].x, pts[1].x) + tol;
                const minY = Math.min(pts[0].y, pts[1].y) - tol, maxY = Math.max(pts[0].y, pts[1].y) + tol;
                if (x >= minX && x <= maxX && y >= minY && y <= maxY) return s;
            } else {
                if (pts.length === 1 && Math.hypot(x - pts[0].x, y - pts[0].y) <= tol) return s;
                for (let k = 1; k < pts.length; k++) {
                    if (distSeg(pt, pts[k - 1], pts[k]) <= tol) return s;
                }
            }
        }
        return null;
    }
    // ==========================================
    //  DRAWING HELPERS
    // ==========================================
    function roundRect(ctx, x, y, width, height, radius) {
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
    }

    function drawCandleCalibrationMarkers() {
        appState.calibrationClicks.forEach((x, i) => {
            ctx.strokeStyle = '#ff6b35';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, appState.height);
            ctx.stroke();
            ctx.setLineDash([]);

            ctx.fillStyle = '#ff6b35';
            ctx.beginPath();
            ctx.arc(x, appState.height / 2, 8, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 10px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(String(i + 1), x, appState.height / 2);
        });

        if (appState.calibrationClicks.length === 2) {
            const x1 = Math.min(...appState.calibrationClicks);
            const x2 = Math.max(...appState.calibrationClicks);
            const midY = appState.height / 2 - 30;

            ctx.strokeStyle = '#ff6b35';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(x1, midY);
            ctx.lineTo(x2, midY);
            ctx.stroke();

            const dist = Math.round(x2 - x1);
            ctx.fillStyle = '#ff6b35';
            ctx.font = 'bold 14px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.fillText(`${dist}px`, (x1 + x2) / 2, midY - 5);
        }
    }

    function drawPriceCalibrationMarkers() {
        appState.priceCalPoints.forEach((pt) => {
            ctx.strokeStyle = '#8b5cf6';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(0, pt.y);
            ctx.lineTo(appState.visibleWidth, pt.y);
            ctx.stroke();
            ctx.setLineDash([]);

            const labelText = `¥${pt.price.toLocaleString()}`;
            ctx.font = 'bold 12px Arial';
            const tw = ctx.measureText(labelText).width;

            ctx.fillStyle = 'rgba(139, 92, 246, 0.85)';
            roundRect(ctx, 4, pt.y - 20, tw + 12, 18, 3);
            ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'bottom';
            ctx.fillText(labelText, 10, pt.y - 5);
        });
    }

    function drawCrosshair() {
        const mx = appState.mouseX;
        const my = appState.mouseY;
        if (mx > appState.visibleWidth) return;

        ctx.strokeStyle = 'rgba(139, 92, 246, 0.5)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(0, my);
        ctx.lineTo(appState.visibleWidth, my);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(mx, 0);
        ctx.lineTo(mx, appState.height);
        ctx.stroke();
        ctx.setLineDash([]);

        if (appState.priceCalibrated) {
            const price = yToPrice(my);
            if (price !== null) {
                const labelText = `¥${price.toLocaleString()}`;
                ctx.font = 'bold 13px Arial';
                const tw = ctx.measureText(labelText).width;
                const tooltipX = Math.min(mx + 12, appState.visibleWidth - tw - 20);
                const tooltipY = Math.max(my - 28, 4);

                ctx.fillStyle = 'rgba(30, 30, 50, 0.85)';
                roundRect(ctx, tooltipX, tooltipY, tw + 16, 24, 6);
                ctx.fill();
                ctx.strokeStyle = 'rgba(139, 92, 246, 0.6)';
                ctx.lineWidth = 1;
                roundRect(ctx, tooltipX, tooltipY, tw + 16, 24, 6);
                ctx.stroke();

                ctx.fillStyle = '#e2e8f0';
                ctx.textAlign = 'left';
                ctx.textBaseline = 'top';
                ctx.fillText(labelText, tooltipX + 8, tooltipY + 5);
            }
        }

        ctx.fillStyle = 'rgba(139, 92, 246, 0.8)';
        ctx.beginPath();
        ctx.arc(mx, my, 3, 0, Math.PI * 2);
        ctx.fill();
    }

    // ==========================================
    //  GAME LOGIC
    // ==========================================
    function handleNextDay() {
        if (appState.image && (appState.isFinished || appState.visibleWidth >= appState.totalWidth)) {
            // すでに全表示なら、次の画像を読み込んで停止（自動再生はしない）
            goToNextImageInAutoPlay(false);
            return;
        }
        if (appState.animating) return;

        const currentSell = parseInt(sellInput.value) || 0;
        const currentBuy = parseInt(buyInput.value) || 0;
        const currentPrice = parseFloat(priceInput.value) || 0;

        // Commit P&L changes
        if (currentPrice > 0) {
            commitPositionChanges(currentSell, currentBuy, currentPrice);
        }

        // Record History
        const entry = {
            step: appState.currentStep + 1,
            xPos: appState.visibleWidth,
            sell: currentSell,
            buy: currentBuy,
            price: currentPrice,
            technique: techniqueSelect ? techniqueSelect.value : "",
            avgSellPrice: appState.avgSellPrice,
            avgBuyPrice: appState.avgBuyPrice,
            realizedPL: appState.accRealizedPL
        };
        appState.history.push(entry);
        addHistoryItem(entry);

        // Update previous positions for next turn
        appState.prevSellPos = currentSell;
        appState.prevBuyPos = currentBuy;

        if (prevBtn) prevBtn.disabled = false;

        // もし自動もどりが動いていたら停止
        stopAutoRewind();

        // Advance
        const targetWidth = appState.visibleWidth + appState.stepSize;
        appState.currentStep++;

        animateSlide(appState.visibleWidth, Math.min(targetWidth, appState.totalWidth));
    }

    function handlePrevDay() {
        const minVisible = appState.stepSize * 2;
        if (appState.visibleWidth <= minVisible) return;

        // 進行中のスライドアニメーションがあれば即座にキャンセル
        cancelSlideAnimation();

        // 自動めくりが動いていたら停止
        stopAutoPlay();

        // めくり完了状態から戻る場合は完了フラグを解除
        if (appState.isFinished) {
            appState.isFinished = false;
            if (nextBtn) nextBtn.disabled = false;
            if (autoPlayBtn) autoPlayBtn.disabled = false;
        }

        // Pop last history entry and restore state
        appState.history.pop();
        if (historyList && historyList.firstChild) {
            historyList.removeChild(historyList.firstChild);
        }

        if (appState.currentStep > 0) {
            appState.currentStep--;
        }

        appState.visibleWidth -= appState.stepSize;
        if (appState.visibleWidth <= minVisible) {
            appState.visibleWidth = minVisible;
        }

        // Restore PL state from the last remaining history entry
        if (appState.history.length > 0) {
            const prev = appState.history[appState.history.length - 1];
            appState.prevSellPos = prev.sell;
            appState.prevBuyPos = prev.buy;
            appState.avgSellPrice = prev.avgSellPrice || 0;
            appState.avgBuyPrice = prev.avgBuyPrice || 0;
            appState.accRealizedPL = prev.realizedPL || 0;
            if (sellInput) sellInput.value = prev.sell;
            if (buyInput) buyInput.value = prev.buy;
            if (priceInput) priceInput.value = prev.price || "";
        } else {
            appState.prevSellPos = 0;
            appState.prevBuyPos = 0;
            appState.avgSellPrice = 0;
            appState.avgBuyPrice = 0;
            appState.accRealizedPL = 0;
            if (sellInput) sellInput.value = 0;
            if (buyInput) buyInput.value = 0;
            if (priceInput) priceInput.value = "";
        }

        updatePLDisplay();
        drawCanvas();
        autoScrollToCurrentPosition(true);

        if (appState.visibleWidth <= minVisible) {
            if (prevBtn) prevBtn.disabled = true;
            stopAutoRewind();
        }
    }


    function animateSlide(fromWidth, toWidth) {
        appState.animating = true;
        const duration = 200;
        const startTime = performance.now();

        function step(timestamp) {
            if (!appState.animating) return; // 外部からキャンセルされた場合は即中断

            const elapsed = timestamp - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);

            appState.visibleWidth = fromWidth + (toWidth - fromWidth) * eased;
            drawCanvas();
            autoScrollToCurrentPosition(true);

            if (progress < 1) {
                appState.animationFrameId = requestAnimationFrame(step);
            } else {
                appState.animationFrameId = null;
                appState.visibleWidth = toWidth;
                appState.animating = false;

                if (appState.visibleWidth >= appState.totalWidth) {
                    appState.visibleWidth = appState.totalWidth;
                    finishGame();
                }

                updatePLDisplay();
                drawCanvas();
                autoScrollToCurrentPosition(true);

                // 価格キャリブレーション済みなら緑ラインのローソク価格を自動検出
                if (appState.priceCalibrated) {
                    detectAndSetCandlePrice();
                }
            }
        }

        appState.animationFrameId = requestAnimationFrame(step);
    }

    function finishGame() {
        appState.isFinished = true;
        if (nextBtn) nextBtn.disabled = true;
        
        // 次の画像がある、またはループモードなら自動めくりボタンは有効なままにする
        const hasNext = appState.imageFileIndex + 1 < appState.imageFiles.length;
        const isLoop = appState.loopMode === 'folder' || appState.loopMode === 'image';
        
        if (autoPlayBtn) {
            if (hasNext || isLoop) {
                autoPlayBtn.disabled = false;
            } else {
                autoPlayBtn.disabled = true;
            }
        }
        
        drawCanvas();
    }

    // ==========================================
    //  AUTO PLAY / AUTO REWIND
    // ==========================================
    // 画リピ/全リピ時の再開タイマー (停止操作で確実にキャンセルできるよう保持する)
    function scheduleAutoPlayRestart() {
        clearTimeout(appState.autoPlayRestartTimer);
        appState.autoPlayRestartTimer = setTimeout(() => {
            appState.autoPlayRestartTimer = null;
            startAutoPlay();
        }, 300);
    }

    function toggleAutoPlay() {
        if (appState.autoPlayInterval || appState.autoPlayRestartTimer) {
            stopAutoPlay();
        } else {
            startAutoPlay();
        }
    }

    function toggleAutoRewind() {
        if (appState.autoRewindInterval) {
            stopAutoRewind();
        } else {
            startAutoRewind();
        }
    }

    function startAutoPlay(skipFirst = false) {
        if (!appState.image) return;

        // すでに完了状態の場合は、次の画像へ進んで再生を開始する
        if (appState.isFinished || appState.visibleWidth >= appState.totalWidth) {
            goToNextImageInAutoPlay(true);
            return;
        }

        stopAutoRewind();

        // 最初の1回を即時実行
        if (!skipFirst) handleNextDay();

        appState.autoPlayInterval = setInterval(() => {
            // 1枚のめくりが最後まで到達したら
            if (appState.isFinished || appState.visibleWidth >= appState.totalWidth) {
                goToNextImageInAutoPlay(true);
                return;
            }
            handleNextDay();
        }, appState.autoPlaySpeed);
        if (autoPlayBtn) {
            autoPlayBtn.textContent = '停止';
            autoPlayBtn.classList.add('playing');
        }
    }

    /**
     * 自動再生中や手動の「次の画像へ」で、次の画像へ切り替える内部共通ロジック
     * @param {boolean} continueAutoPlay - 次の画像を読み込んだ後に自動再生を続けるかどうか
     */
    function goToNextImageInAutoPlay(continueAutoPlay = true) {
        // タイマーを一旦停止（多重実行を防ぐ）
        if (appState.autoPlayInterval) {
            clearInterval(appState.autoPlayInterval);
            appState.autoPlayInterval = null;
        }

        // === 画リピ（現在の画像を繰り返し）モード ===
        if (appState.loopMode === 'image' && appState.image) {
            initGame(appState.image, continueAutoPlay);
            appState.visibleWidth = appState.stepSize * 2;
            if (continueAutoPlay) {
                scheduleAutoPlayRestart();
            } else {
                stopAutoPlay();
            }
            return;
        }

        // === 全リピ（フォルダ内全画像を順番に繰り返し）または通常進行 ===
        const nextIndex = appState.imageFileIndex + 1 < appState.imageFiles.length
            ? appState.imageFileIndex + 1
            : (appState.loopMode === 'folder' ? 0 : -1);

        if (nextIndex >= 0 && appState.imageFiles.length > 0) {
            if (nextIndex === appState.imageFileIndex && appState.image) {
                // 同じ画像の場合は再読み込みせずに初期化 (1枚しかない場合など)
                initGame(appState.image, continueAutoPlay);
                appState.visibleWidth = appState.stepSize * 2;
                if (continueAutoPlay) {
                    scheduleAutoPlayRestart();
                } else {
                    stopAutoPlay();
                }
            } else {
                appState.imageFileIndex = nextIndex;
                updateImageNavUI();
                const file = appState.imageFiles[nextIndex];
                const token = ++appState.loadToken;
                loadImageFile(file, img => {
                    if (token !== appState.loadToken) return;
                    initGame(img, continueAutoPlay);
                    if (continueAutoPlay) {
                        scheduleAutoPlayRestart();
                    } else {
                        stopAutoPlay();
                    }
                }, () => {
                    stopAutoPlay();
                    alert('画像を読み込めなかったため自動再生を停止しました: ' + (file && file.name));
                });
            }
        } else {
            stopAutoPlay();
        }
    }

    function stopAutoPlay() {
        if (appState.autoPlayRestartTimer) {
            clearTimeout(appState.autoPlayRestartTimer);
            appState.autoPlayRestartTimer = null;
        }
        if (appState.autoPlayInterval) {
            clearInterval(appState.autoPlayInterval);
            appState.autoPlayInterval = null;
        }
        if (autoPlayBtn) {
            autoPlayBtn.textContent = 'めくり';
            autoPlayBtn.classList.remove('playing');
        }
    }

    function startAutoRewind(skipFirst = false) {
        const minVisible = appState.stepSize * 2;
        if (!appState.image || appState.visibleWidth <= minVisible) return;

        stopAutoPlay();

        // 最初の1回を即時実行
        if (!skipFirst) handlePrevDay();

        appState.autoRewindInterval = setInterval(() => {
            if (appState.visibleWidth <= minVisible) {
                stopAutoRewind();
                return;
            }
            handlePrevDay();
        }, appState.autoPlaySpeed);

        if (autoRewindBtn) {
            autoRewindBtn.textContent = '停止';
            autoRewindBtn.classList.add('playing');
        }
    }

    function stopAutoRewind() {
        if (appState.autoRewindInterval) {
            clearInterval(appState.autoRewindInterval);
            appState.autoRewindInterval = null;
        }
        if (autoRewindBtn) {
            autoRewindBtn.textContent = 'もどり';
            autoRewindBtn.classList.remove('playing');
        }
    }

    // ループモードのトグル（排他制御）
    function toggleLoopMode(mode) {
        if (appState.loopMode === mode) {
            // 同じボタンをもう一度 → OFF
            appState.loopMode = null;
        } else {
            appState.loopMode = mode;
        }
        // ボタン表示を更新
        if (loopFolderBtn) loopFolderBtn.classList.toggle('loop-active', appState.loopMode === 'folder');
        if (loopImageBtn) loopImageBtn.classList.toggle('loop-active', appState.loopMode === 'image');

        // 完了状態中にループモードを切り替えた場合、「めくり」ボタンの有効状態を同期
        if (appState.image && appState.isFinished && autoPlayBtn) {
            const hasNext = appState.imageFileIndex + 1 < appState.imageFiles.length;
            const isLoop = appState.loopMode === 'folder' || appState.loopMode === 'image';
            autoPlayBtn.disabled = !(hasNext || isLoop);
        }
    }

    // ==========================================
    //  HISTORY
    // ==========================================
    function addHistoryItem(entry) {
        if (!historyList) return;
        const li = document.createElement('li');
        const priceStr = entry.price ? `¥${entry.price.toLocaleString()}` : '';

        const stepSpan = document.createElement('span');
        stepSpan.className = 'step-info';
        stepSpan.textContent = `Day ${entry.step}`;

        const priceSpan = document.createElement('span');
        priceSpan.className = 'price-info';
        priceSpan.textContent = priceStr;

        const sellSpan = document.createElement('span');
        sellSpan.className = 'pos-info sell-pos';
        sellSpan.textContent = String(entry.sell);

        const sepSpan = document.createElement('span');
        sepSpan.className = 'pos-sep';
        sepSpan.textContent = '-';

        const buySpan = document.createElement('span');
        buySpan.className = 'pos-info buy-pos';
        buySpan.textContent = String(entry.buy);

        const techSpan = document.createElement('span');
        techSpan.className = 'tech-info';
        techSpan.textContent = entry.technique ? `[${entry.technique}]` : '';

        li.append(stepSpan, priceSpan, sellSpan, sepSpan, buySpan, techSpan);
        historyList.insertBefore(li, historyList.firstChild);
    }

    // ==========================================
    //  RESULTS OVERLAY
    // ==========================================
    function drawResults() {
        ctx.drawImage(appState.image, 0, 0);

        ctx.font = "bold 14px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";

        const initialVisible = appState.stepSize * 2;

        appState.history.forEach((entry, index) => {
            const xPos = typeof entry.xPos === 'number'
                ? entry.xPos
                : (initialVisible + (index * appState.stepSize));

            const isLightTheme = document.body.classList.contains('light-theme');
            ctx.strokeStyle = isLightTheme ? "rgba(0, 0, 0, 0.3)" : "rgba(255, 255, 255, 0.3)";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(xPos, 0);
            ctx.lineTo(xPos, appState.height);
            ctx.stroke();

            const feedback = verifyConsistency(entry, index > 0 ? appState.history[index - 1] : null);
            const prev = index > 0 ? appState.history[index - 1] : { sell: 0, buy: 0 };

            if (entry.sell !== prev.sell || entry.buy !== prev.buy || entry.technique) {
                const yPos = 50 + (index % 5) * 40;

                let boxColor = "rgba(0, 0, 0, 0.7)";
                if (feedback && feedback.isConsistent === false) {
                    boxColor = "rgba(200, 50, 50, 0.85)";
                } else if (feedback && feedback.isConsistent === true) {
                    boxColor = "rgba(50, 150, 50, 0.85)";
                }

                const text = `${entry.sell}-${entry.buy}`;
                const tech = entry.technique || "";
                const msg = (feedback && feedback.message) ? feedback.message : "";
                const width = Math.max(
                    ctx.measureText(text).width,
                    ctx.measureText(tech).width,
                    ctx.measureText(msg).width
                ) + 20;

                const boxHeight = msg ? 75 : (tech ? 55 : 35);
                ctx.fillStyle = boxColor;
                ctx.fillRect(xPos - width / 2, yPos - 35, width, boxHeight);

                ctx.fillStyle = "#fff";
                ctx.fillText(text, xPos, yPos);

                if (tech) {
                    ctx.fillStyle = "#ffdd55";
                    ctx.fillText(tech, xPos, yPos + 20);
                }
                if (msg) {
                    ctx.font = "bold 11px Arial";
                    ctx.fillStyle = "#fecaca";
                    ctx.fillText(msg, xPos, yPos + 38);
                    ctx.font = "bold 14px Arial";
                }
            }
        });
    }

    function verifyConsistency(current, prev) {
        if (!current.technique) return null;
        const tech = current.technique;
        const sell = current.sell;
        const buy = current.buy;
        const prevSell = prev ? prev.sell : 0;
        const prevBuy = prev ? prev.buy : 0;
        const sellAdded = sell > prevSell;
        const buyAdded = buy > prevBuy;

        if (tech === "下半身" || tech === "逆N大") {
            if (sellAdded && buy <= prevBuy) return { isConsistent: true };
            if (buyAdded) return { isConsistent: false, message: "下半身は売り局面です" };
            if (sell > buy) return { isConsistent: true };
            return { isConsistent: false };
        }
        if (tech === "逆下半身" || tech === "N大" || tech === "下半身の逆") {
            if (buyAdded && sell <= prevSell) return { isConsistent: true };
            if (sellAdded) return { isConsistent: false, message: "逆下半身は買い局面です" };
            if (buy > sell) return { isConsistent: true };
            return { isConsistent: false };
        }
        if (tech === "もの別れ") {
            if (sell > buy && sellAdded) return { isConsistent: true };
            if (buy > sell && buyAdded) return { isConsistent: true };
            return { isConsistent: true };
        }
        return null;
    }

    // ==========================================
    //  AUTO PRICE DETECTION
    // ==========================================
    function getSourceCtx() {
        if (!appState.image) return null;
        if (!appState.sourceCanvas || appState.sourceCanvas.width !== appState.image.width || appState.sourceCanvas.height !== appState.image.height) {
            appState.sourceCanvas = document.createElement('canvas');
            appState.sourceCanvas.width = appState.image.width;
            appState.sourceCanvas.height = appState.image.height;
            appState.sourceCtx = appState.sourceCanvas.getContext('2d', { willReadFrequently: true });
            appState.sourceCtx.drawImage(appState.image, 0, 0);
        }
        return appState.sourceCtx;
    }

    function detectAndSetCandlePrice() {
        if (!appState.image || !appState.priceCalibrated) return;

        const sourceCtx = getSourceCtx();
        if (!sourceCtx) return;

        // Target X: Center of newly revealed candle area [visibleWidth - stepSize, visibleWidth]
        const targetX = Math.floor(appState.visibleWidth - (appState.stepSize / 2));
        if (targetX < 0 || targetX >= appState.totalWidth) return;

        const searchRadius = 15;
        const stripX = Math.max(0, targetX - searchRadius);
        const stripRight = Math.min(appState.totalWidth, targetX + searchRadius + 1);
        const stripW = stripRight - stripX;
        if (stripW <= 0 || appState.height <= 0) return;

        // Read the entire vertical strip once
        const stripData = sourceCtx.getImageData(stripX, 0, stripW, appState.height).data;
        const centerRelX = targetX - stripX;

        // Estimate background RGB along targetX using quantized color histogram (most frequent color bucket)
        const buckets = new Map();
        let dominantBucket = null;
        let maxCount = 0;

        for (let y = 0; y < appState.height; y++) {
            const idx = (y * stripW + centerRelX) * 4;
            const r = stripData[idx];
            const g = stripData[idx + 1];
            const b = stripData[idx + 2];
            const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
            let entry = buckets.get(key);
            if (!entry) {
                entry = { count: 0, sumR: 0, sumG: 0, sumB: 0 };
                buckets.set(key, entry);
            }
            entry.count++;
            entry.sumR += r;
            entry.sumG += g;
            entry.sumB += b;
            if (entry.count > maxCount) {
                maxCount = entry.count;
                dominantBucket = entry;
            }
        }

        const bgR = dominantBucket ? dominantBucket.sumR / dominantBucket.count : 255;
        const bgG = dominantBucket ? dominantBucket.sumG / dominantBucket.count : 255;
        const bgB = dominantBucket ? dominantBucket.sumB / dominantBucket.count : 255;

        function isBackgroundPixel(r, g, b) {
            return Math.abs(r - bgR) < 35 && Math.abs(g - bgG) < 35 && Math.abs(b - bgB) < 35;
        }

        let segments = [];
        let currentSegment = null;

        // Ignore top 5% and bottom 5% (headers/date axis)
        const yMin = Math.floor(appState.height * 0.05);
        const yMax = Math.ceil(appState.height * 0.95);

        for (let y = yMin; y < yMax; y++) {
            const idx = (y * stripW + centerRelX) * 4;
            const r = stripData[idx];
            const g = stripData[idx + 1];
            const b = stripData[idx + 2];

            if (!isBackgroundPixel(r, g, b)) {
                if (!currentSegment) {
                    currentSegment = { startY: y, endY: y, sumR: r, sumG: g, sumB: b, count: 1 };
                } else {
                    currentSegment.endY = y;
                    currentSegment.sumR += r;
                    currentSegment.sumG += g;
                    currentSegment.sumB += b;
                    currentSegment.count++;
                }
            } else if (currentSegment) {
                if (currentSegment.endY - currentSegment.startY > 2) {
                    segments.push(currentSegment);
                }
                currentSegment = null;
            }
        }
        if (currentSegment && (currentSegment.endY - currentSegment.startY > 2)) {
            segments.push(currentSegment);
        }

        if (segments.length === 0) return;

        let candidate = null;
        let maxLen = 0;

        for (const seg of segments) {
            const len = seg.endY - seg.startY;
            const avgR = seg.sumR / seg.count;
            const avgG = seg.sumG / seg.count;
            const avgB = seg.sumB / seg.count;
            const isRed = (avgR > avgG + 25 && avgR > avgB + 25);

            if (len > maxLen) {
                maxLen = len;
                candidate = seg;
                candidate.isRed = isRed;
            }
        }

        if (candidate && maxLen > 5) {
            const bodyTopY = findBodyYInStrip(stripData, stripW, centerRelX, candidate.startY, candidate.endY, true, isBackgroundPixel);
            const bodyBottomY = findBodyYInStrip(stripData, stripW, centerRelX, candidate.startY, candidate.endY, false, isBackgroundPixel);

            const closeY = candidate.isRed ? bodyTopY : bodyBottomY;

            const price = yToPrice(closeY);
            if (price !== null) {
                if (priceInput) {
                    priceInput.value = price;
                    priceInput.classList.add('price-flash');
                    setTimeout(() => priceInput.classList.remove('price-flash'), 500);
                }
                updatePLDisplay();
            }
        }
    }

    function findBodyYInStrip(stripData, stripW, centerRelX, startY, endY, findTop, isBackgroundPixel) {
        const threshold = 3;
        const len = endY - startY;
        if (len < 5) return findTop ? startY : endY;

        if (findTop) {
            for (let y = startY; y <= endY; y++) {
                if (measureWidthInStrip(stripData, stripW, centerRelX, y, isBackgroundPixel) >= threshold) return y;
            }
            return startY;
        } else {
            for (let y = endY; y >= startY; y--) {
                if (measureWidthInStrip(stripData, stripW, centerRelX, y, isBackgroundPixel) >= threshold) return y;
            }
            return endY;
        }
    }

    function measureWidthInStrip(stripData, stripW, centerRelX, y, isBackgroundPixel) {
        const rowOffset = y * stripW;

        let leftCount = 0;
        for (let i = centerRelX; i >= 0; i--) {
            const idx = (rowOffset + i) * 4;
            if (isBackgroundPixel(stripData[idx], stripData[idx + 1], stripData[idx + 2])) break;
            leftCount++;
        }

        let rightCount = 0;
        for (let i = centerRelX + 1; i < stripW; i++) {
            const idx = (rowOffset + i) * 4;
            if (isBackgroundPixel(stripData[idx], stripData[idx + 1], stripData[idx + 2])) break;
            rightCount++;
        }

        return leftCount + rightCount;
    }
});

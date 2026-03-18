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
    const finishBtn = document.getElementById('finishBtn');
    const resetBtn = document.getElementById('resetBtn');
    const messageEl = document.getElementById('overlay-message');

    // Make overlay message clickable
    if (messageEl && fileInput) {
        messageEl.addEventListener('click', () => {
            fileInput.click();
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
    const autoCalibrateBtn = document.getElementById('autoCalibrateBtn');
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
    if (finishBtn) finishBtn.addEventListener('click', handleFinish);
    if (resetBtn) resetBtn.addEventListener('click', resetApp);
    if (resetCurrentBtn) resetCurrentBtn.addEventListener('click', resetCurrentImage);
    if (calibrateBtn) calibrateBtn.addEventListener('click', startCalibration);
    if (maskResetBtn) maskResetBtn.addEventListener('click', handleMaskReset);
    if (maskRevealBtn) maskRevealBtn.addEventListener('click', handleMaskReveal);
    if (priceCalibrateBtn) priceCalibrateBtn.addEventListener('click', startPriceCalibration);
    if (autoCalibrateBtn) autoCalibrateBtn.addEventListener('click', handleAutoCalibration);
    if (priceReadModeToggle) priceReadModeToggle.addEventListener('change', (e) => {
        appState.priceReadMode = e.target.checked;
        updateCursorStyle();
        drawCanvas();
    });

    // === PAINT EVENT LISTENERS ===
    const colorBtns = document.querySelectorAll('.color-btn');
    colorBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            colorBtns.forEach(b => b.classList.remove('active'));
            const target = e.currentTarget;
            target.classList.add('active');
            appState.paintColor = target.dataset.color || null;
            updateCursorStyle();
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

    if (speedDecBtn) speedDecBtn.addEventListener('click', () => adjustSpeed(-0.1));
    if (speedIncBtn) speedIncBtn.addEventListener('click', () => adjustSpeed(0.1));
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
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

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
            drawCanvas();
            return; // Skip other hover checks (crosshair etc.) during drag
        }

        // --- Cursor Hover Logic ---
        const scale = appState.scale || 1.0;
        const threshold = 15 / scale;

        // If paint mode is active, handle drawing
        if (appState.isPainting && appState.currentStroke) {
            if (e.cancelable) e.preventDefault();
            appState.currentStroke.points.push({ x: coords.x, y: coords.y });
            drawCanvas();
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
            drawCanvas();
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
            appState.isPainting = true;
            appState.currentStroke = {
                color: appState.paintColor,
                points: [{ x: coords.x, y: coords.y }]
            };
            if (e.cancelable) e.preventDefault();
        }
    }

    function handleCanvasMouseUp(e) {
        if (appState.isDraggingMask) {
            appState.isDraggingMask = false;
            updateCursorStyle(); // Revert cursor
        }
        if (appState.isPainting) {
            appState.isPainting = false;
            if (appState.currentStroke) {
                appState.strokes.push(appState.currentStroke);
                appState.currentStroke = null;
            }
            updateCursorStyle();
        }
    }

    function handleCanvasMouseLeave() {
        appState.showCrosshair = false;
        appState.mouseX = -1;
        appState.mouseY = -1;
        if (appState.isPainting) {
            appState.isPainting = false;
            if (appState.currentStroke) {
                appState.strokes.push(appState.currentStroke);
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
            priceCalibrateStatus.innerHTML = '👆 <strong>1つ目</strong>の基準価格の位置をチャート上でクリック';
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
                priceCalibrateStatus.innerHTML = `✅ 1点目: ¥${price.toLocaleString()} | 👆 <strong>2つ目</strong>の基準価格をクリック`;
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
                priceCalibrateStatus.innerHTML = `✅ 設定完了！ ¥${p1.price.toLocaleString()} ↔ ¥${p2.price.toLocaleString()}`;
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
    //  AUTO CALIBRATION (OCR)
    // ==========================================
    async function handleAutoCalibration() {
        if (!appState.image) { alert('先に画像をアップロードしてください'); return; }
        if (typeof Tesseract === 'undefined') { alert('OCRライブラリが読み込まれていません。インターネット接続を確認してください。'); return; }

        if (appState.isCalibrating) cancelCandleCalibration();
        if (appState.isPriceCalibrating) cancelPriceCalibration();

        if (priceCalibrateStatus) {
            priceCalibrateStatus.textContent = '⏳ 画像を解析中... (これには数秒かかる場合があります)';
            priceCalibrateStatus.className = 'calibrate-status active';
        }
        if (autoCalibrateBtn) {
            autoCalibrateBtn.disabled = true;
            autoCalibrateBtn.textContent = '⏳ 解析中...';
        }

        try {
            // Create OCR canvas
            const ocrCanvas = document.createElement('canvas');
            ocrCanvas.width = appState.image.width;
            ocrCanvas.height = appState.image.height;
            const ocrCtx = ocrCanvas.getContext('2d');
            ocrCtx.drawImage(appState.image, 0, 0);

            const imgData = ocrCtx.getImageData(0, 0, ocrCanvas.width, ocrCanvas.height);
            const data = imgData.data;

            // Binarization for better OCR (White text on Dark BG -> Black text on White BG)
            for (let i = 0; i < data.length; i += 4) {
                const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
                // Thresholding: Bright pixels become black (text), Dark pixels become white (bg)
                const val = avg > 90 ? 0 : 255;
                data[i] = val;     // R
                data[i + 1] = val; // G
                data[i + 2] = val; // B
            }
            ocrCtx.putImageData(imgData, 0, 0);

            // Pass to Tesseract with whitelist for numbers
            const result = await Tesseract.recognize(
                ocrCanvas,
                'eng',
                {
                    logger: m => {
                        console.log(m);
                        if (priceCalibrateStatus && m.status) {
                            const prog = m.progress ? Math.round(m.progress * 100) : 0;
                            priceCalibrateStatus.textContent = `⏳ ${m.status} (${prog}%)`;
                        }
                    }
                }
            );

            const words = result.data.words;
            let numbers = [];

            words.forEach(w => {
                // Remove commas for parsing, but keep logic distinct
                const rawText = w.text.trim();
                // Match numbers like 1,234.56 or 1000
                const numMatch = rawText.match(/^[1-9][0-9,]*(\.[0-9]+)?$/);

                if (numMatch) {
                    const cleanVal = parseFloat(rawText.replace(/,/g, ''));
                    if (!isNaN(cleanVal) && cleanVal > 0) {
                        const box = w.bbox;

                        // Filter by Position (Ignore Header/Footer)
                        // Top 8% (Title area) and Bottom 5% (Date area)
                        if (box.y0 < appState.height * 0.08) return;
                        if (box.y1 > appState.height * 0.95) return;

                        // Calculate center Y
                        const cy = (box.y0 + box.y1) / 2;
                        const cx = (box.x0 + box.x1) / 2;

                        numbers.push({ price: cleanVal, y: cy, x: cx, box: w.bbox });
                    }
                }
            });

            if (numbers.length < 2) {
                alert('数値が十分に読み取れませんでした。手動設定を試してください。');
                resetAutoCalButton();
                return;
            }

            console.log("Detected numbers:", numbers);

            // --- RANSAC Algorithm ---
            // Find the best line model: Price = m * y + c
            // that fits the most points.

            let bestInliers = [];
            let bestModel = null; // { m, c }

            // Try every pair of points
            for (let i = 0; i < numbers.length; i++) {
                for (let j = i + 1; j < numbers.length; j++) {
                    const p1 = numbers[i];
                    const p2 = numbers[j];

                    const dy = p2.y - p1.y;
                    const dp = p2.price - p1.price;

                    // Reject if points are too close vertically
                    if (Math.abs(dy) < 20) continue;

                    const m = dp / dy;

                    // Sanity check for slope "m"
                    // Screen Y increases downwards.
                    // Price usually increases upwards.
                    // So Higher Price -> Smaller Y.
                    // dp (p2-p1) and dy (y2-y1).
                    // If p2 is higher price, y2 should be smaller.
                    // dp > 0 implies dy < 0.
                    // So m should be NEGATIVE.
                    if (m >= 0) continue; // Inverted axis or error?

                    const c = p1.price - m * p1.y;

                    // Count inliers
                    const inliers = [];
                    numbers.forEach(curr => {
                        const predicted = m * curr.y + c;
                        const error = Math.abs(predicted - curr.price);

                        // Tolerance: larger of 1% or 5 units
                        const tolerance = Math.max(5, curr.price * 0.01);

                        if (error < tolerance) {
                            inliers.push(curr);
                        }
                    });

                    // Keep best
                    if (inliers.length > bestInliers.length) {
                        bestInliers = inliers;
                        bestModel = { m, c };
                    } else if (inliers.length === bestInliers.length) {
                        // Tie-breaker: prefer wider Y range
                        if (bestModel) {
                            const ysNew = inliers.map(n => n.y);
                            const spanNew = Math.max(...ysNew) - Math.min(...ysNew);
                            const ysOld = bestInliers.map(n => n.y);
                            const spanOld = Math.max(...ysOld) - Math.min(...ysOld);

                            if (spanNew > spanOld) {
                                bestInliers = inliers;
                                bestModel = { m, c };
                            }
                        }
                    }
                }
            }

            if (!bestModel || bestInliers.length < 2) {
                alert('価格軸の特定に失敗しました（整合性の取れる数値が見つかりません）。手動設定を試してください。');
                resetAutoCalButton();
                return;
            }

            // Recalculate Least Squares fit for the best inliers to get refined m, c
            let sumY = 0, sumP = 0, sumYP = 0, sumYY = 0;
            const N = bestInliers.length;
            bestInliers.forEach(n => {
                sumY += n.y;
                sumP += n.price;
                sumYP += n.y * n.price;
                sumYY += n.y * n.y;
            });

            // Linear regression: Price = m * y + c
            // m = (N*sumYP - sumY*sumP) / (N*sumYY - sumY*sumY)
            // c = (sumP - m*sumY) / N
            const denom = (N * sumYY - sumY * sumY);
            if (Math.abs(denom) < 1e-9) {
                console.warn("Singular matrix in regression");
            } else {
                const refinedM = (N * sumYP - sumY * sumP) / denom;
                const refinedC = (sumP - refinedM * sumY) / N;
                bestModel = { m: refinedM, c: refinedC };
            }

            console.log("Best Model:", bestModel, "Inliers:", bestInliers);

            // Use the min and max INLIERS to show the user what was matched.
            bestInliers.sort((a, b) => a.price - b.price);
            const minP = bestInliers[0];
            const maxP = bestInliers[bestInliers.length - 1];

            if (maxP.price === minP.price) {
                alert('異なる価格が見つかりませんでした。手動設定を試してください。');
                resetAutoCalButton();
                return;
            }

            // Consistency check: Max price should be at Top (smaller Y)
            if (maxP.y > minP.y) {
                // Check if we have an inverted axis or detection error.
                // But we trust the values.
                console.warn("Max price Y > Min price Y. This is unusual for standard charts.");
            }

            appState.priceCalPoints = [
                { y: maxP.y, price: maxP.price },
                { y: minP.y, price: minP.price }
            ];

            appState.priceCalibrated = true;
            appState.priceReadMode = true;
            updateCursorStyle();

            if (priceCalibrateStatus) {
                priceCalibrateStatus.textContent = `✅ 自動設定完了: ¥${maxP.price.toLocaleString()} (Y:${Math.round(maxP.y)}) ↔ ¥${minP.price.toLocaleString()} (Y:${Math.round(minP.y)})`;
                priceCalibrateStatus.className = 'calibrate-status success';
            }
            if (priceReadModeToggle) {
                priceReadModeToggle.checked = true;
                priceReadModeToggle.disabled = false;
            }
            if (priceCalibrateBtn) {
                priceCalibrateBtn.textContent = '💰 再計測';
                priceCalibrateBtn.disabled = false;
            }
            drawCanvas();

        } catch (e) {
            console.error(e);
            alert(`OCR解析に失敗しました。\n詳細: ${e.message || e}\n\n※インターネット接続が必要です。`);
            if (priceCalibrateStatus) {
                priceCalibrateStatus.textContent = '❌ 解析エラー';
                priceCalibrateStatus.className = 'calibrate-status error';
            }
        } finally {
            resetAutoCalButton();
        }
    }

    function resetAutoCalButton() {
        if (autoCalibrateBtn) {
            autoCalibrateBtn.disabled = !appState.image;
            autoCalibrateBtn.textContent = '🤖 自動キャリブレーション (画像から数値取得)';
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
    function handleFolderUpload(e) {
        const files = Array.from(e.target.files).filter(f => f.type.startsWith('image/'));
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
        const file = files[index];
        const reader = new FileReader();
        reader.onload = function (event) {
            const img = new Image();
            img.onload = function () { initGame(img); };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    }

    function navigateImage(delta) {
        const newIndex = appState.imageFileIndex + delta;
        if (newIndex < 0 || newIndex >= appState.imageFiles.length) return;
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

    // 後方互換のためにも残す（内部呼び出し等でそのまま利用される場合）
    function handleImageUpload(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function (event) {
            const img = new Image();
            img.onload = function () { initGame(img); };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    }

    function initGame(img, keepAutoPlay = false) {
        appState.image = img;
        appState.totalWidth = img.width;
        appState.height = img.height;

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
        if (finishBtn) finishBtn.disabled = true;
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
            priceCalibrateBtn.classList.remove('calibrating');
            priceCalibrateBtn.disabled = false;
        }
        if (autoCalibrateBtn) {
            autoCalibrateBtn.disabled = false;
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

    // 現在の画像をリセット（マスク位置・ズーム・スクロールは維持、ステップ/P&L/履歴のみリセット）
    function resetCurrentImage() {
        if (!appState.image) return;
        stopAutoPlay();

        // マスク位置・ズーム・スクロール位置を保存
        const savedVisibleWidth = appState.visibleWidth;
        const savedScale = appState.scale;
        const container = canvas.parentElement;
        const savedScrollLeft = container ? container.scrollLeft : 0;
        const savedScrollTop = container ? container.scrollTop : 0;

        initGame(appState.image);

        // 全て復元、ステップは0に戻す
        appState.visibleWidth = savedVisibleWidth;
        appState.scale = savedScale;
        if (zoomLevelInput) zoomLevelInput.value = Math.round(savedScale * 100);
        appState.currentStep = 0;
        if (currentStepEl) currentStepEl.textContent = 0;

        // スクロール位置を復元（drawCanvas後に設定）
        drawCanvas();
        if (container) {
            container.scrollLeft = savedScrollLeft;
            container.scrollTop = savedScrollTop;
        }

        const minVisible = appState.stepSize * 2;
        if (appState.visibleWidth > minVisible) {
            if (prevBtn) prevBtn.disabled = false;
        }
    }

    // ==========================================
    //  MASK JUMP BUTTONS - マスクを左端 / 右端に瞬時移動
    // ==========================================
    function handleMaskReset() {
        if (!appState.image) return;
        // アニメーションを即キャンセル
        if (appState.animationFrameId) {
            cancelAnimationFrame(appState.animationFrameId);
            appState.animationFrameId = null;
            appState.animating = false;
        }
        stopAutoPlay();
        stopAutoRewind();
        // マスクを最小位置（初期位置）に戻す
        const minVisible = appState.stepSize * 2;
        appState.visibleWidth = minVisible;
        appState.currentStep = 0;
        if (currentStepEl) currentStepEl.textContent = 0;
        if (prevBtn) prevBtn.disabled = true;
        if (nextBtn) nextBtn.disabled = false;
        drawCanvas();
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
        const currentPrice = parseInt(priceInput?.value) || 0;
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
                const currentPriceVal = parseInt(priceInput?.value) || 0;
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

            ctx.beginPath();
            if (stroke.points.length === 1) {
                ctx.fillStyle = stroke.color;
                ctx.arc(stroke.points[0].x, stroke.points[0].y, 2, 0, Math.PI * 2);
                ctx.fill();
                return;
            }

            ctx.strokeStyle = stroke.color;
            ctx.lineWidth = stroke.color === '#ffffff' ? 8 : 4;
            ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
            for (let i = 1; i < stroke.points.length; i++) {
                ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
            }
            ctx.stroke();
        });
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
        const currentPrice = parseInt(priceInput.value) || 0;

        // Commit P&L changes
        if (currentPrice > 0) {
            commitPositionChanges(currentSell, currentBuy, currentPrice);
        }

        // Record History
        const entry = {
            step: appState.currentStep + 1,
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

        // 自動めくりが動いていたら停止
        stopAutoPlay();

        // もし自動もどりが動いていたら停止（直接呼ばれる場合のため）
        // stopAutoRewind();

        // めくり完了状態から戻る場合は完了フラグを解除
        if (appState.isFinished) {
            appState.isFinished = false;
            if (nextBtn) nextBtn.disabled = false;
            if (autoPlayBtn) autoPlayBtn.disabled = false;
            if (finishBtn) finishBtn.disabled = false;
        }

        // Pop last history entry and restore state
        const removedEntry = appState.history.pop();
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
        
        if (finishBtn) finishBtn.disabled = true;
        drawCanvas();
    }

    function handleFinish() {
        stopAutoPlay();
        stopAutoRewind();
        finishGame();
    }

    function resetApp() {
        stopAutoPlay();
        stopAutoRewind();
        appState.image = null;
        appState.isCalibrating = false;
        appState.calibrationClicks = [];
        appState.candleWidth = null;
        appState.isPriceCalibrating = false;
        appState.priceCalibrationStep = 0;
        appState.priceCalPoints = [];
        appState.priceCalibrated = false;
        appState.priceReadMode = false;
        appState.avgSellPrice = 0;
        appState.avgBuyPrice = 0;
        appState.accRealizedPL = 0;
        appState.prevSellPos = 0;
        appState.prevBuyPos = 0;
        appState.paintColor = null;
        appState.strokes = [];
        appState.currentStroke = null;
        appState.isPainting = false;

        const colorBtns = document.querySelectorAll('.color-btn');
        if (colorBtns.length > 0) {
            colorBtns.forEach(b => b.classList.remove('active'));
            const defaultOff = Array.from(colorBtns).find(b => b.dataset.color === "");
            if (defaultOff) defaultOff.classList.add('active');
        }

        canvas.style.cursor = 'default';
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (messageEl) messageEl.style.display = 'block';
        canvas.parentElement.classList.remove('has-image');
        if (nextBtn) nextBtn.disabled = false;
        if (prevBtn) prevBtn.disabled = true;
        if (autoPlayBtn) autoPlayBtn.disabled = false;
        if (autoRewindBtn) autoRewindBtn.disabled = false;
        if (finishBtn) finishBtn.disabled = true;
        if (sellInput) sellInput.value = 0;
        if (buyInput) buyInput.value = 0;
        if (priceInput) priceInput.value = "";
        if (historyList) historyList.innerHTML = "";
        if (currentStepEl) currentStepEl.textContent = "0";
        if (calibrateBtn) {
            calibrateBtn.textContent = '📏 ローソク足幅を計測';
            calibrateBtn.classList.remove('calibrating');
            calibrateBtn.disabled = true;
        }
        if (calibrateStatus) { calibrateStatus.textContent = ''; calibrateStatus.className = 'calibrate-status'; }
        if (priceCalibrateBtn) {
            priceCalibrateBtn.textContent = '💰 価格軸を設定';
            priceCalibrateBtn.classList.remove('calibrating');
            priceCalibrateBtn.disabled = true;
        }
        if (autoCalibrateBtn) {
            autoCalibrateBtn.disabled = true;
        }
        if (priceCalibrateStatus) { priceCalibrateStatus.textContent = ''; priceCalibrateStatus.className = 'calibrate-status'; }
        if (priceReadModeToggle) { priceReadModeToggle.checked = false; priceReadModeToggle.disabled = true; }

        // Reset P&L display
        if (sellEntryRow) sellEntryRow.style.display = 'none';
        if (buyEntryRow) buyEntryRow.style.display = 'none';
        if (sellPLRow) sellPLRow.style.display = 'none';
        if (buyPLRow) buyPLRow.style.display = 'none';
        if (unrealizedPLEl) { unrealizedPLEl.textContent = '0'; unrealizedPLEl.className = 'pl-val-big pl-zero'; }
        if (realizedPLEl) { realizedPLEl.textContent = '0'; realizedPLEl.className = 'pl-val-big pl-zero'; }
        if (totalPLEl) { totalPLEl.textContent = '0'; totalPLEl.className = 'pl-val-total pl-zero'; }
    }

    // ==========================================
    //  AUTO PLAY / AUTO REWIND
    // ==========================================
    function toggleAutoPlay() {
        if (appState.autoPlayInterval) {
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

        // === 全画像(リスト)繰り返しモード ===
        const isLoopMode = appState.loopMode === 'folder' || appState.loopMode === 'image';
        const nextIndex = appState.imageFileIndex + 1 < appState.imageFiles.length
            ? appState.imageFileIndex + 1
            : (isLoopMode ? 0 : -1);

        if (nextIndex >= 0 && appState.imageFiles.length > 0) {
            if (nextIndex === appState.imageFileIndex) {
                // 同じ画像の場合は再読み込みせずに初期化 (1枚しかない場合など)
                initGame(appState.image, continueAutoPlay);
                appState.visibleWidth = appState.stepSize * 2;
                if (continueAutoPlay) {
                    setTimeout(() => startAutoPlay(), 300);
                } else {
                    stopAutoPlay();
                }
            } else {
                appState.imageFileIndex = nextIndex;
                updateImageNavUI();
                const file = appState.imageFiles[nextIndex];
                const reader = new FileReader();
                reader.onload = function (event) {
                    const img = new Image();
                    img.onload = function () {
                        initGame(img, continueAutoPlay);
                        if (continueAutoPlay) {
                            setTimeout(() => startAutoPlay(), 300);
                        } else {
                            stopAutoPlay();
                        }
                    };
                    img.src = event.target.result;
                };
                reader.readAsDataURL(file);
            }
        } else {
            stopAutoPlay();
        }
    }

    function stopAutoPlay() {
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
    }

    // ==========================================
    //  HISTORY
    // ==========================================
    function addHistoryItem(entry) {
        if (!historyList) return;
        const li = document.createElement('li');
        const priceStr = entry.price ? `¥${entry.price.toLocaleString()}` : '';
        li.innerHTML = `
            <span class="step-info">Day ${entry.step}</span>
            <span class="price-info">${priceStr}</span>
            <span class="pos-info sell-pos">${entry.sell}</span>
            <span class="pos-sep">-</span>
            <span class="pos-info buy-pos">${entry.buy}</span>
            <span class="tech-info">${entry.technique ? `[${entry.technique}]` : ''}</span>
        `;
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

        const initialVisible = appState.totalWidth * 0.2;

        appState.history.forEach((entry, index) => {
            const xPos = initialVisible + (index * appState.stepSize);

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
                    boxColor = "rgba(200, 50, 50, 0.8)";
                } else if (feedback && feedback.isConsistent === true) {
                    boxColor = "rgba(50, 150, 50, 0.8)";
                }

                const text = `${entry.sell}-${entry.buy}`;
                const tech = entry.technique || "";
                const width = Math.max(ctx.measureText(text).width, ctx.measureText(tech).width) + 20;

                ctx.fillStyle = boxColor;
                ctx.fillRect(xPos - width / 2, yPos - 35, width, tech ? 55 : 35);

                ctx.fillStyle = "#fff";
                ctx.fillText(text, xPos, yPos);

                if (tech) {
                    ctx.fillStyle = "#ffdd55";
                    ctx.fillText(tech, xPos, yPos + 20);
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
    function isValidHighLowLabel(ctx, box) {
        // 1. Check if text is white-ish (simple check)
        const cx = Math.floor((box.x0 + box.x1) / 2);
        const cy = Math.floor((box.y0 + box.y1) / 2);
        // We trust Tesseract found text.

        // 2. Check for "White Bar" or "Line" connected to the box.
        // The user says "White bar attached to the top/bottom".
        // This implies there are white pixels adjacent to the text box.
        // We will scan a margin around the box.

        const margin = 10;
        const width = ctx.canvas.width;
        const height = ctx.canvas.height;

        // Define search area: slightly larger than box
        const x0 = Math.max(0, Math.floor(box.x0 - margin));
        const y0 = Math.max(0, Math.floor(box.y0 - margin));
        const x1 = Math.min(width, Math.ceil(box.x1 + margin));
        const y1 = Math.min(height, Math.ceil(box.y1 + margin));

        const w = x1 - x0;
        const h = y1 - y0;
        if (w <= 0 || h <= 0) return false;

        const imgData = ctx.getImageData(x0, y0, w, h).data;
        const thresh = 100; // Lowered from 200 for better sensitivity

        // Iterate over the margin area (excluding the box itself approx)
        // Actually, just count total white pixels in this expanded region vs inside the box?
        // No, simplest is to check for *linear structures*.
        // But checking for "any sufficient amount of white stuff near the box" is likely good enough
        // to distinguish from random noise or axis labels (which are usually isolated or on a grid line).
        // Grid lines are thin/gray often. User says "White Bar".

        // Let's count white pixels that are *outside* the original box but inside the margin.
        let whitePixelCount = 0;

        // Original box in local coords
        const bx0 = box.x0 - x0;
        const by0 = box.y0 - y0;
        const bx1 = box.x1 - x0;
        const by1 = box.y1 - y0;

        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                // Check if (x,y) is inside original box
                if (x >= bx0 && x <= bx1 && y >= by0 && y <= by1) continue;

                const idx = (y * w + x) * 4;
                const r = imgData[idx];
                const g = imgData[idx + 1];
                const b = imgData[idx + 2];

                if (r > thresh && g > thresh && b > thresh) {
                    whitePixelCount++;
                }
            }
        }

        // If we find enough white pixels outside, we assume it's attached to a bar/line.
        // Lowered threshold to 5 pixels
        return whitePixelCount > 5;
    }
    function detectAndSetCandlePrice() {
        if (!appState.image || !appState.priceCalibrated) return;

        // Create a temporary canvas to read pixel data from the source image
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = appState.image.width;
        tempCanvas.height = appState.image.height;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.drawImage(appState.image, 0, 0);

        // Target X: Center of naturally revealed candle area
        // The newly revealed area is [visibleWidth - stepSize, visibleWidth]
        // We look at the center of this strip.
        const targetX = Math.floor(appState.visibleWidth - (appState.stepSize / 2));
        if (targetX < 0) return;

        // Get pixel column
        const imgData = tempCtx.getImageData(targetX, 0, 1, appState.height);
        const data = imgData.data;

        // Scan for candle body
        // Simple logic: Find non-background pixels.
        // Assume background is light (R,G,B > 200)
        // Group continuous non-bg pixels into segments.

        let segments = [];
        let currentSegment = null;

        for (let y = 0; y < appState.height; y++) {
            const idx = y * 4;
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];

            // Is background?
            // Strict check: assume white-ish background
            const isBg = (r > 200 && g > 200 && b > 200);

            if (!isBg) {
                if (!currentSegment) {
                    currentSegment = { startY: y, endY: y, r, g, b };
                } else {
                    currentSegment.endY = y;
                }
            } else {
                if (currentSegment) {
                    if (currentSegment.endY - currentSegment.startY > 2) { // Ignore tiny noise
                        segments.push(currentSegment);
                    }
                    currentSegment = null;
                }
            }
        }
        if (currentSegment && (currentSegment.endY - currentSegment.startY > 2)) {
            segments.push(currentSegment);
        }

        if (segments.length === 0) return;

        // Heuristic: The longest segment is likely the candle (body+wicks).
        // Or if multiple long segments (MA lines), we need to be careful.
        // For now, let's pick the longest one that isn't excessively long (like a grid line across screen? unlikely in column scan).

        let candidate = null;
        let maxLen = 0;

        for (const seg of segments) {
            const len = seg.endY - seg.startY;
            // Check color
            // Red: R >> G, B
            // Black/Blue: Low intensity or B > R
            const isRed = (seg.r > seg.g + 30 && seg.r > seg.b + 30);

            // Simple robust check: length matters most for candle body vs MA line (if MA is thin)
            // MA lines are usually thin vertically (1-3px) unless they are steep.
            // Candles are usually > 5-10px.

            if (len > maxLen) {
                maxLen = len;
                candidate = seg;
                candidate.isRed = isRed;
            }
        }

        if (candidate && maxLen > 5) {
            // Determine Close Price Y
            let closeY = candidate.startY; // Default to top

            // Refine Body Top/Bottom by checking width
            // This is to skip the upper/lower wicks
            const bodyTopY = findBodyY(tempCtx, targetX, candidate.startY, candidate.endY, true);
            const bodyBottomY = findBodyY(tempCtx, targetX, candidate.startY, candidate.endY, false);

            if (candidate.isRed) {
                // Bullish (陽線): Close is Top of Body
                closeY = bodyTopY;
            } else {
                // Bearish (陰線): Close is Bottom of Body
                closeY = bodyBottomY;
            }

            // Convert Y to Price
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

    function findBodyY(ctx, x, startY, endY, findTop) {
        // Scan from startY downwards (or endY upwards) until we find a row with width >= threshold
        // If the segment is entirely thin (Doji), just return the tip.
        const threshold = 3;
        const len = endY - startY;
        if (len < 5) return findTop ? startY : endY; // Too small to differentiate

        // Limit scan to 33% from each end to avoid scanning the whole body if it's a Marubozu
        // But since we want the EXACT edge of the body...

        if (findTop) {
            // Scanning from Top (startY) downwards
            for (let y = startY; y <= endY; y++) {
                if (measureWidth(ctx, x, y) >= threshold) return y;
            }
            return startY;
        } else {
            // Scanning from Bottom (endY) upwards
            for (let y = endY; y >= startY; y--) {
                if (measureWidth(ctx, x, y) >= threshold) return y;
            }
            return endY;
        }
    }

    function measureWidth(ctx, centerX, y) {
        // Measure continuous non-bg pixels left and right from centerX
        const w = 15; // Search radius
        // We need to be careful about not reading out of bounds, but getImageData handles clipping gracefully usually.
        // Actually better to clamp.
        const safeX = Math.max(0, centerX - w);
        const safeW = (centerX + w) - safeX;

        const imgData = ctx.getImageData(safeX, y, safeW * 2, 1);
        const d = imgData.data;
        const centerRelX = centerX - safeX;

        // Scan left from center
        let leftCount = 0;
        for (let i = centerRelX; i >= 0; i--) {
            const idx = i * 4;
            if (d[idx] > 220 && d[idx + 1] > 220 && d[idx + 2] > 220) break; // Bg detected
            leftCount++;
        }

        // Scan right from center
        let rightCount = 0;
        for (let i = centerRelX + 1; i < d.length / 4; i++) {
            const idx = i * 4;
            if (d[idx] > 220 && d[idx + 1] > 220 && d[idx + 2] > 220) break; // Bg detected
            rightCount++;
        }

        return leftCount + rightCount; // Total width
    }
});

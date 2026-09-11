// ======================================
// TradingView Style Free-Form Rectangle, Trend Line & Interactive Drawing Engine
// ======================================

let activeTool = null; // 'range' | 'rectangle' | 'trendline' | null
let drawingsHistory = []; 
let defaultRowCount = 11; // Select Range ডিফল্ট ১১টি রো
let activeSelectedDrawingId = null; 

// Undo/Redo State Management
let stateHistory = [];
let stateRedoHistory = [];

// Drawing / Dragging / Resizing State Variables
let isDrawing = false;
let isDraggingBox = false;
let isResizingBox = false;

let startX = 0, startY = 0;
let currentX = 0, currentY = 0;

let dragOffsetX = 0, dragOffsetY = 0;
let activeLinePoint = null; // 'start' | 'end' handle
let currentResizeHandle = null;

// Dynamic Color Palette for New Range Drawings
const predefinedColors = [
    "#2563eb", "#ef4444", "#10b981", "#8b5cf6", 
    "#f59e0b", "#ec4899", "#06b6d4", "#84cc16"
];
let colorIndex = -1;

function deleteSelectedDrawing() {
    if (!activeSelectedDrawingId) return;
    saveStateToHistory(); 
    drawingsHistory = drawingsHistory.filter(d => d.id !== activeSelectedDrawingId);
    activeSelectedDrawingId = null;

    if (drawingsHistory.length === 0) {
        colorIndex = -1;
    }

    saveDrawingsToStorage();
    renderDrawings();
    closeAllPopups();
}

document.addEventListener("DOMContentLoaded", () => {
    const tableBody = document.getElementById("fullTableBody");
    const tableContainer = document.getElementById("tableContainer") || document.getElementById("reportWrapper");
    const rangeToolBtn = document.getElementById("rangeToolBtn");
    const undoDrawingBtn = document.getElementById("undoDrawingBtn");
    const redoDrawingBtn = document.getElementById("redoDrawingBtn");
    const clearDrawingBtn = document.getElementById("clearDrawingBtn");

    if (rangeToolBtn) {
        rangeToolBtn.innerText = "Select Range";
    }

    createToolButtons();
    loadDrawingsFromStorage();
    createPopupControlsUI();

    if (tableContainer) {
        tableContainer.addEventListener("scroll", () => {
            renderDrawings();
        });
    }

    document.addEventListener("keydown", (e) => {
        const activeElem = document.activeElement;
        if (activeElem && (activeElem.tagName === "INPUT" || activeElem.tagName === "TEXTAREA" || activeElem.isContentEditable)) {
            return;
        }

        if ((e.key === "Delete" || e.key === "Backspace") && activeSelectedDrawingId) {
            e.preventDefault();
            deleteSelectedDrawing();
        }
    });

    if (rangeToolBtn) {
        rangeToolBtn.addEventListener("click", () => toggleTool('range'));
    }

    // Interactive Canvas Event Listeners
    if (tableContainer) {
        tableContainer.style.position = "relative";

        tableContainer.addEventListener("click", (e) => {
            if (e.target.closest("#rangePrimaryPopup") || e.target.closest("#rangeColorPalettePopup")) return;

            const rect = tableContainer.getBoundingClientRect();
            const clickX = e.clientX - rect.left + tableContainer.scrollLeft;
            const clickY = e.clientY - rect.top + tableContainer.scrollTop;

            // Rectangle ও Trendline এর জন্য Two-Click Logics
            if (activeTool === "rectangle" || activeTool === "trendline") {
                if (!isDrawing) {
                    // ১ম ক্লিক: আঁকা শুরু
                    isDrawing = true;
                    startX = clickX;
                    startY = clickY;
                    currentX = clickX;
                    currentY = clickY;
                    if (activeTool === "rectangle") {
                        renderTempRectangle(startX, startY, currentX, currentY);
                    } else if (activeTool === "trendline") {
                        renderTempTrendline(startX, startY, currentX, currentY);
                    }
                } else {
                    // ২য় ক্লিক: আঁকা শেষ
                    isDrawing = false;
                    currentX = clickX;
                    currentY = clickY;
                    removeTempDrawings();

                    const dist = Math.hypot(currentX - startX, currentY - startY);

                    if (dist > 5) {
                        saveStateToHistory(); 
                        const newId = (activeTool === "trendline" ? "line_" : "rect_") + Date.now();
                        
                        let newDrawing;
                        if (activeTool === "trendline") {
                            newDrawing = {
                                id: newId,
                                type: "trendline",
                                x1: startX,
                                y1: startY,
                                x2: currentX,
                                y2: currentY,
                                borderColor: "#2563eb",
                                borderWidth: "2px",
                                borderStyle: "solid",
                                isPinnedToRow: false
                            };
                        } else {
                            newDrawing = {
                                id: newId,
                                type: "rectangle",
                                x: Math.min(startX, currentX),
                                y: Math.min(startY, currentY),
                                width: Math.abs(currentX - startX),
                                height: Math.abs(currentY - startY),
                                borderColor: "#2563eb",
                                borderWidth: "2px",
                                borderStyle: "solid",
                                bgColor: "transparent",
                                isPinnedToRow: false
                            };
                        }

                        attachNearestRowToDrawing(newDrawing);
                        drawingsHistory.push(newDrawing);
                        activeSelectedDrawingId = newId;

                        saveDrawingsToStorage();
                        renderDrawings();
                        syncPopupInputs();
                        showPrimaryPopup();
                        toggleTool(null);
                    } else {
                        // দূরত্বের ব্যবধান কম হলে ক্যানসেল
                        toggleTool(null);
                    }
                }
                e.preventDefault();
                return;
            }
        });

        tableContainer.addEventListener("mousedown", (e) => {
            if (e.target.closest("#rangePrimaryPopup") || e.target.closest("#rangeColorPalettePopup")) return;

            const rect = tableContainer.getBoundingClientRect();
            const clickX = e.clientX - rect.left + tableContainer.scrollLeft;
            const clickY = e.clientY - rect.top + tableContainer.scrollTop;

            if (e.target.classList.contains("line-handle")) {
                saveStateToHistory(); 
                isResizingBox = true;
                activeLinePoint = e.target.dataset.point;
                e.preventDefault();
                e.stopPropagation();
                return;
            }

            if (e.target.classList.contains("resize-handle")) {
                saveStateToHistory(); 
                isResizingBox = true;
                currentResizeHandle = e.target.dataset.handle;
                e.preventDefault();
                e.stopPropagation();
                return;
            }

            if (!activeTool) {
                const targetDrawing = findClickedDrawing(clickX, clickY);

                if (targetDrawing) {
                    saveStateToHistory(); 
                    isDraggingBox = targetDrawing.type !== "range"; 
                    activeSelectedDrawingId = targetDrawing.id;

                    if (targetDrawing.type === "trendline") {
                        dragOffsetX = clickX;
                        dragOffsetY = clickY;
                    } else if (targetDrawing.type === "rectangle") {
                        dragOffsetX = clickX - targetDrawing.x;
                        dragOffsetY = clickY - targetDrawing.y;
                    }

                    renderDrawings();
                    syncPopupInputs();
                    showPrimaryPopup();

                    e.preventDefault();
                    e.stopPropagation();
                    return;
                } else {
                    activeSelectedDrawingId = null;
                    renderDrawings();
                    closeAllPopups();
                }
            }
        });

        tableContainer.addEventListener("mousemove", (e) => {
            const rect = tableContainer.getBoundingClientRect();
            const curX = e.clientX - rect.left + tableContainer.scrollLeft;
            const curY = e.clientY - rect.top + tableContainer.scrollTop;

            if (isDrawing) {
                currentX = curX;
                currentY = curY;
                if (activeTool === "rectangle") {
                    renderTempRectangle(startX, startY, currentX, currentY);
                } else if (activeTool === "trendline") {
                    renderTempTrendline(startX, startY, currentX, currentY);
                }
            }

            if (isDraggingBox && activeSelectedDrawingId) {
                const target = drawingsHistory.find(d => d.id === activeSelectedDrawingId);
                if (target) {
                    if (target.type === "rectangle") {
                        target.x = curX - dragOffsetX;
                        target.y = curY - dragOffsetY;
                        if (!target.isPinnedToRow) attachNearestRowToDrawing(target);
                    } else if (target.type === "trendline") {
                        const dx = curX - dragOffsetX;
                        const dy = curY - dragOffsetY;
                        target.x1 += dx;
                        target.y1 += dy;
                        target.x2 += dx;
                        target.y2 += dy;
                        dragOffsetX = curX;
                        dragOffsetY = curY;
                        if (!target.isPinnedToRow) attachNearestRowToDrawing(target);
                    }
                    renderDrawings();
                }
            }

            if (isResizingBox && activeSelectedDrawingId) {
                const target = drawingsHistory.find(d => d.id === activeSelectedDrawingId);
                if (target) {
                    if (target.type === "rectangle" && currentResizeHandle) {
                        resizeRectangleObject(target, currentResizeHandle, curX, curY);
                    } else if (target.type === "trendline" && activeLinePoint) {
                        if (activeLinePoint === "start") {
                            target.x1 = curX;
                            target.y1 = curY;
                        } else {
                            target.x2 = curX;
                            target.y2 = curY;
                        }
                    }
                    if (!target.isPinnedToRow) attachNearestRowToDrawing(target);
                    renderDrawings();
                }
            }
        });

        window.addEventListener("mouseup", () => {
            if (isDraggingBox || isResizingBox) {
                isDraggingBox = false;
                isResizingBox = false;
                currentResizeHandle = null;
                activeLinePoint = null;
                saveDrawingsToStorage();
            }
        });
    }

    // Range Tool Selection Handler
    if (tableBody) {
        tableBody.addEventListener("click", (e) => {
            if (activeTool !== "range") return;

            const targetRow = e.target.closest("tr");
            if (!targetRow) return;

            const periodCell = targetRow.cells[0];
            if (!periodCell) return;

            const periodVal = periodCell.innerText.replace(/\D/g, "").trim();
            if (!periodVal) return;

            saveStateToHistory(); 

            colorIndex = (colorIndex + 1) % predefinedColors.length;
            const chosenBorderColor = predefinedColors[colorIndex];
            const chosenTopBg = hexToRgba(chosenBorderColor, 0.25);

            const newId = "range_" + Date.now();
            const drawingItem = {
                id: newId,
                type: "range",
                startPeriod: periodVal,
                rowCount: defaultRowCount,
                borderColor: chosenBorderColor,
                borderWidth: "2px",
                borderStyle: "solid",
                bgColor: "transparent",
                topRowBg: chosenTopBg
            };

            drawingsHistory.push(drawingItem);
            activeSelectedDrawingId = newId;

            saveDrawingsToStorage();
            renderDrawings();
            syncPopupInputs();
            showPrimaryPopup();
            toggleTool(null);
        });
    }

    // Undo / Redo / Clear Handlers
    if (undoDrawingBtn) {
        undoDrawingBtn.addEventListener("click", () => {
            if (stateHistory.length > 0) {
                stateRedoHistory.push(JSON.parse(JSON.stringify(drawingsHistory)));
                drawingsHistory = stateHistory.pop();
                if (drawingsHistory.length === 0) colorIndex = -1;
                
                if (!drawingsHistory.some(d => d.id === activeSelectedDrawingId)) {
                    activeSelectedDrawingId = drawingsHistory.length > 0 ? drawingsHistory[drawingsHistory.length - 1].id : null;
                }

                saveDrawingsToStorage();
                renderDrawings();
                syncPopupInputs();
                if (activeSelectedDrawingId) showPrimaryPopup(); else closeAllPopups();
            }
        });
    }

    if (redoDrawingBtn) {
        redoDrawingBtn.addEventListener("click", () => {
            if (stateRedoHistory.length > 0) {
                stateHistory.push(JSON.parse(JSON.stringify(drawingsHistory)));
                drawingsHistory = stateRedoHistory.pop();
                
                if (!drawingsHistory.some(d => d.id === activeSelectedDrawingId)) {
                    activeSelectedDrawingId = drawingsHistory.length > 0 ? drawingsHistory[drawingsHistory.length - 1].id : null;
                }

                saveDrawingsToStorage();
                renderDrawings();
                syncPopupInputs();
                if (activeSelectedDrawingId) showPrimaryPopup(); else closeAllPopups();
            }
        });
    }

    if (clearDrawingBtn) {
        clearDrawingBtn.addEventListener("click", () => {
            if (drawingsHistory.length > 0) {
                saveStateToHistory(); 
                drawingsHistory = [];
                activeSelectedDrawingId = null;
                colorIndex = -1;
                saveDrawingsToStorage();
                renderDrawings();
                closeAllPopups();
            }
        });
    }
});

// FIX: Border অথবা 1st Row ক্লিকে Range সিলেক্ট করার আপডেটকৃত লজিক
function findClickedDrawing(x, y) {
    let matchedDrawings = [];

    // রিভার্স অর্ডার যাতে উপরে আঁকা অবজেক্টটি আগে প্রাধান্য পায়
    for (let i = drawingsHistory.length - 1; i >= 0; i--) {
        const d = drawingsHistory[i];

        if (d.type === "range") {
            const bounds = d.renderedBounds;
            if (bounds) {
                const borderThreshold = 6; // বর্ডারের মার্জিন সীমা (pixels)
                
                const isInsideX = x >= bounds.left && x <= bounds.left + bounds.width;
                const isInsideY = y >= bounds.top && y <= bounds.top + bounds.height;

                if (isInsideX && isInsideY) {
                    const isNearTopBorder = Math.abs(y - bounds.top) <= borderThreshold;
                    const isNearBottomBorder = Math.abs(y - (bounds.top + bounds.height)) <= borderThreshold;
                    const isNearLeftBorder = Math.abs(x - bounds.left) <= borderThreshold;
                    const isNearRightBorder = Math.abs(x - (bounds.left + bounds.width)) <= borderThreshold;
                    
                    const isBorderClick = isNearTopBorder || isNearBottomBorder || isNearLeftBorder || isNearRightBorder;
                    const isFirstRowClick = y >= bounds.top && y <= (bounds.top + (bounds.firstRowHeight || 36));

                    // শুধুমাত্র Border অথবা 1st Row-তে ক্লিক হলে সিলেক্ট হবে
                    if (isBorderClick || isFirstRowClick) {
                        return d;
                    }
                }
            }
        } else if (d.type === "rectangle") {
            const bounds = d.renderedBounds;
            if (bounds && x >= bounds.left && x <= bounds.left + bounds.width && y >= bounds.top && y <= bounds.top + bounds.height) {
                matchedDrawings.push({ drawing: d, area: bounds.width * bounds.height });
            } else if (x >= d.x && x <= d.x + d.width && y >= d.y && y <= d.y + d.height) {
                matchedDrawings.push({ drawing: d, area: d.width * d.height });
            }
        } else if (d.type === "trendline") {
            const dist = pointToLineDistance(x, y, d.x1, d.y1, d.x2, d.y2);
            if (dist <= 10) { 
                matchedDrawings.push({ drawing: d, area: 0 });
            }
        }
    }

    if (matchedDrawings.length === 0) return null;

    matchedDrawings.sort((a, b) => a.area - b.area);
    return matchedDrawings[0].drawing;
}

function pointToLineDistance(px, py, x1, y1, x2, y2) {
    const A = px - x1;
    const B = py - y1;
    const C = x2 - x1;
    const D = y2 - y1;

    const dot = A * C + B * D;
    const len_sq = C * C + D * D;
    let param = -1;
    if (len_sq !== 0) param = dot / len_sq;

    let xx, yy;
    if (param < 0) { xx = x1; yy = y1; }
    else if (param > 1) { xx = x2; yy = y2; }
    else { xx = x1 + param * C; yy = y1 + param * D; }

    const dx = px - xx;
    const dy = py - yy;
    return Math.sqrt(dx * dx + dy * dy);
}

function showPrimaryPopup() {
    const primaryPopup = document.getElementById("rangePrimaryPopup");
    if (primaryPopup) primaryPopup.style.display = "flex";
}

function resizeRectangleObject(target, handle, curX, curY) {
    const minSize = 15;
    if (handle.includes("e")) target.width = Math.max(minSize, curX - target.x);
    if (handle.includes("s")) target.height = Math.max(minSize, curY - target.y);
    if (handle.includes("w")) {
        const newW = target.x + target.width - curX;
        if (newW > minSize) { target.width = newW; target.x = curX; }
    }
    if (handle.includes("n")) {
        const newH = target.y + target.height - curY;
        if (newH > minSize) { target.height = newH; target.y = curY; }
    }
}

function attachNearestRowToDrawing(target) {
    const tableBody = document.getElementById("fullTableBody");
    const tableContainer = document.getElementById("tableContainer") || document.getElementById("reportWrapper");
    if (!tableBody || !tableContainer) return;

    const allRows = Array.from(tableBody.querySelectorAll("tr"));
    if (allRows.length === 0) return;

    const containerRect = tableContainer.getBoundingClientRect();
    let closestRow = null;
    let minDiff = Infinity;

    const referenceY = target.type === "trendline" ? target.y1 : target.y;

    allRows.forEach(row => {
        const rowRect = row.getBoundingClientRect();
        const rowTop = (rowRect.top - containerRect.top) + tableContainer.scrollTop;
        const diff = Math.abs(rowTop - referenceY);
        if (diff < minDiff) { minDiff = diff; closestRow = row; }
    });

    if (closestRow) {
        const periodVal = closestRow.cells[0]?.innerText.replace(/\D/g, "").trim();
        if (periodVal) {
            target.startPeriod = periodVal;
            const rowRect = closestRow.getBoundingClientRect();
            const rowTop = (rowRect.top - containerRect.top) + tableContainer.scrollTop;
            
            if (target.type === "trendline") {
                target.rowOffsetY1 = target.y1 - rowTop;
                target.rowOffsetY2 = target.y2 - rowTop;
            } else {
                target.rowOffsetY = target.y - rowTop;
            }
        }
    }
}

function createToolButtons() {
    const rangeToolBtn = document.getElementById("rangeToolBtn");
    if (!rangeToolBtn) return;

    let rectBtn = document.getElementById("rectToolBtn");
    if (!rectBtn) {
        rectBtn = document.createElement("button");
        rectBtn.id = "rectToolBtn";
        rectBtn.className = rangeToolBtn.className;
        rectBtn.innerText = "Rectangle";
        rangeToolBtn.parentNode.insertBefore(rectBtn, rangeToolBtn.nextSibling);
        rectBtn.addEventListener("click", () => toggleTool('rectangle'));
    }

    let trendBtn = document.getElementById("trendLineBtn");
    if (!trendBtn) {
        trendBtn = document.createElement("button");
        trendBtn.id = "trendLineBtn";
        trendBtn.className = rangeToolBtn.className;
        trendBtn.innerText = "Trend Line";
        rectBtn.parentNode.insertBefore(trendBtn, rectBtn.nextSibling);
        trendBtn.addEventListener("click", () => toggleTool('trendline'));
    }
}

function toggleTool(toolName) {
    const rangeBtn = document.getElementById("rangeToolBtn");
    const rectBtn = document.getElementById("rectToolBtn");
    const trendBtn = document.getElementById("trendLineBtn");

    if (isDrawing) {
        isDrawing = false;
        removeTempDrawings();
    }

    if (activeTool === toolName || toolName === null) {
        activeTool = null;
        [rangeBtn, rectBtn, trendBtn].forEach(b => {
            if (b) { b.classList.remove("active"); b.style.background = ""; b.style.color = ""; }
        });
        document.body.classList.remove("range-tool-active");
    } else {
        activeTool = toolName;
        if (rangeBtn) { rangeBtn.style.background = toolName === 'range' ? "#2563eb" : ""; rangeBtn.style.color = toolName === 'range' ? "#fff" : ""; }
        if (rectBtn) { rectBtn.style.background = toolName === 'rectangle' ? "#2563eb" : ""; rectBtn.style.color = toolName === 'rectangle' ? "#fff" : ""; }
        if (trendBtn) { trendBtn.style.background = toolName === 'trendline' ? "#2563eb" : ""; trendBtn.style.color = toolName === 'trendline' ? "#fff" : ""; }
        document.body.classList.add("range-tool-active");
    }
}

function saveStateToHistory() {
    stateHistory.push(JSON.parse(JSON.stringify(drawingsHistory)));
    stateRedoHistory = []; 
}

function saveDrawingsToStorage() {
    try {
        localStorage.setItem("analysis_drawings_data", JSON.stringify(drawingsHistory));
    } catch (e) {
        console.error("Error saving drawings:", e);
    }
}

function loadDrawingsFromStorage() {
    try {
        const saved = localStorage.getItem("analysis_drawings_data");
        if (saved) {
            drawingsHistory = JSON.parse(saved);
            if (drawingsHistory.length > 0) {
                activeSelectedDrawingId = drawingsHistory[drawingsHistory.length - 1].id;
            } else {
                colorIndex = -1;
            }
        }
    } catch (e) {
        console.error("Error loading drawings:", e);
    }
}

function renderTempRectangle(x1, y1, x2, y2) {
    const tableContainer = document.getElementById("tableContainer") || document.getElementById("reportWrapper");
    let tempBox = document.getElementById("tempDrawingBox");
    if (!tempBox) {
        tempBox = document.createElement("div");
        tempBox.id = "tempDrawingBox";
        tempBox.style.cssText = "position:absolute; pointer-events:none; border:2px dashed #2563eb; background:transparent; z-index:20;";
        tableContainer.appendChild(tempBox);
    }
    tempBox.style.left = Math.min(x1, x2) + "px";
    tempBox.style.top = Math.min(y1, y2) + "px";
    tempBox.style.width = Math.abs(x2 - x1) + "px";
    tempBox.style.height = Math.abs(y2 - y1) + "px";
}

function renderTempTrendline(x1, y1, x2, y2) {
    const tableContainer = document.getElementById("tableContainer") || document.getElementById("reportWrapper");
    let tempSvg = document.getElementById("tempSvgCanvas");
    if (!tempSvg) {
        tempSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        tempSvg.id = "tempSvgCanvas";
        tempSvg.style.cssText = "position:absolute; top:0; left:0; width:100%; height:100%; pointer-events:none; z-index:20;";
        tempSvg.innerHTML = `<line id="tempSvgLine" stroke="#2563eb" stroke-width="2" stroke-dasharray="4" />`;
        tableContainer.appendChild(tempSvg);
    }
    const line = tempSvg.querySelector("#tempSvgLine");
    line.setAttribute("x1", x1);
    line.setAttribute("y1", y1);
    line.setAttribute("x2", x2);
    line.setAttribute("y2", y2);
}

function removeTempDrawings() {
    const b = document.getElementById("tempDrawingBox");
    const s = document.getElementById("tempSvgCanvas");
    if (b) b.remove();
    if (s) s.remove();
}

function renderDrawings() {
    const tableBody = document.getElementById("fullTableBody");
    const tableContainer = document.getElementById("tableContainer") || document.getElementById("reportWrapper");
    if (!tableContainer) return;

    let overlayContainer = document.getElementById("drawingOverlay");
    if (!overlayContainer) {
        overlayContainer = document.createElement("div");
        overlayContainer.id = "drawingOverlay";
        overlayContainer.style.cssText = "position:absolute; top:0; left:0; pointer-events:none; z-index:10;";
        tableContainer.appendChild(overlayContainer);
    }

    overlayContainer.style.width = tableContainer.scrollWidth + "px";
    overlayContainer.style.height = tableContainer.scrollHeight + "px";
    overlayContainer.innerHTML = "";

    const svgLayer = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svgLayer.style.cssText = "position:absolute; top:0; left:0; width:100%; height:100%; pointer-events:none; z-index:11;";
    overlayContainer.appendChild(svgLayer);

    drawingsHistory.forEach(item => {
        if (item.type === "trendline") {
            if (!item.isPinnedToRow && item.startPeriod) {
                const allRows = Array.from(tableBody.querySelectorAll("tr"));
                let targetRow = allRows.find(row => row.cells[0]?.innerText.replace(/\D/g, "").trim() === item.startPeriod);
                if (targetRow) {
                    const containerRect = tableContainer.getBoundingClientRect();
                    const rowRect = targetRow.getBoundingClientRect();
                    const currentTop = (rowRect.top - containerRect.top) + tableContainer.scrollTop;
                    
                    item.y1 = currentTop + (item.rowOffsetY1 || 0);
                    item.y2 = currentTop + (item.rowOffsetY2 || 0);
                }
            }

            const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
            g.className.baseVal = "drawing-item";
            g.dataset.id = item.id;

            const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
            line.setAttribute("x1", item.x1); line.setAttribute("y1", item.y1);
            line.setAttribute("x2", item.x2); line.setAttribute("y2", item.y2);
            line.setAttribute("stroke", item.borderColor || "#2563eb");
            line.setAttribute("stroke-width", parseInt(item.borderWidth) || 2);
            if (item.borderStyle === "dashed") line.setAttribute("stroke-dasharray", "6,6");
            if (item.borderStyle === "dotted") line.setAttribute("stroke-dasharray", "2,4");

            g.appendChild(line);

            if (item.id === activeSelectedDrawingId) {
                const p1 = createSvgHandle(item.x1, item.y1, "start");
                const p2 = createSvgHandle(item.x2, item.y2, "end");
                g.appendChild(p1);
                g.appendChild(p2);
            }

            svgLayer.appendChild(g);

        } else {
            let top, left, width, height, firstRowHeight = 36;

            if (item.type === "rectangle") {
                width = item.width;
                height = item.height;
                left = item.x;

                if (!item.isPinnedToRow && item.startPeriod) {
                    const allRows = Array.from(tableBody.querySelectorAll("tr"));
                    let targetRow = allRows.find(row => row.cells[0]?.innerText.replace(/\D/g, "").trim() === item.startPeriod);
                    if (targetRow) {
                        const containerRect = tableContainer.getBoundingClientRect();
                        const rowRect = targetRow.getBoundingClientRect();
                        top = (rowRect.top - containerRect.top) + tableContainer.scrollTop + (item.rowOffsetY || 0);
                        item.y = top;
                    } else top = item.y;
                } else top = item.y;
            } else {
                // Range টাইপ ক্যালকুলেশন
                const allRows = Array.from(tableBody.querySelectorAll("tr"));
                if (allRows.length === 0) return;

                let startIdx = allRows.findIndex(row => row.cells[0]?.innerText.replace(/\D/g, "").trim() === item.startPeriod);
                if (startIdx === -1) return;

                let endIdx = Math.min(startIdx + (item.rowCount - 1), allRows.length - 1);
                const firstRow = allRows[startIdx];
                const lastRow = allRows[endIdx];
                if (!firstRow || !lastRow) return;

                const containerRect = tableContainer.getBoundingClientRect();
                const firstRect = firstRow.getBoundingClientRect();
                const lastRect = lastRow.getBoundingClientRect();

                top = (firstRect.top - containerRect.top) + tableContainer.scrollTop;
                left = (firstRect.left - containerRect.left) + tableContainer.scrollLeft;
                width = firstRect.width;
                height = (lastRect.bottom - firstRect.top);
                firstRowHeight = firstRect.height || 36;
            }

            // বাউন্ডারি ও ১ম রো-এর উচ্চতা সেভ রাখা
            item.renderedBounds = { top, left, width, height, firstRowHeight };

            const box = document.createElement("div");
            box.className = "drawing-range-box drawing-item";
            box.dataset.id = item.id;
            box.style.position = "absolute";
            box.style.pointerEvents = "none"; // ওভারলে তে ক্লিক রুকতে pointer-events none
            box.style.boxSizing = "border-box";
            box.style.top = top + "px";
            box.style.left = left + "px";
            box.style.width = width + "px";
            box.style.height = height + "px";
            box.style.borderWidth = item.borderWidth || "2px";
            box.style.borderStyle = item.borderStyle || "solid";
            box.style.borderColor = item.borderColor || "#2563eb";
            box.style.backgroundColor = item.bgColor || "transparent";

            if (item.type === "range" && item.topRowBg && item.topRowBg !== "transparent") {
                const topHighlight = document.createElement("div");
                topHighlight.style.cssText = `position:absolute; top:0; left:0; width:100%; height:${firstRowHeight}px; background:${item.topRowBg}; pointer-events:none;`;
                box.appendChild(topHighlight);
            }

            if (item.id === activeSelectedDrawingId) {
                box.style.outline = "2px dashed #2563eb";
                box.style.outlineOffset = "2px";

                if (item.type === "rectangle") {
                    ["nw", "n", "ne", "e", "se", "s", "sw", "w"].forEach(h => {
                        const handleEl = document.createElement("div");
                        handleEl.className = "resize-handle";
                        handleEl.dataset.handle = h;
                        handleEl.style.cssText = getHandleStyle(h);
                        box.appendChild(handleEl);
                    });
                }
            }

            overlayContainer.appendChild(box);
        }
    });
}

function createSvgHandle(cx, cy, pointType) {
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", cx);
    circle.setAttribute("cy", cy);
    circle.setAttribute("r", "6");
    circle.setAttribute("fill", "#ffffff");
    circle.setAttribute("stroke", "#2563eb");
    circle.setAttribute("stroke-width", "2");
    circle.className.baseVal = "line-handle";
    circle.dataset.point = pointType;
    circle.style.cursor = "pointer";
    circle.style.pointerEvents = "all";
    return circle;
}

function getHandleStyle(position) {
    const size = "8px";
    let posCss = "", cursor = `${position}-resize`;
    if (position === "nw") posCss = `top: -4px; left: -4px;`;
    if (position === "n")  posCss = `top: -4px; left: calc(50% - 4px);`;
    if (position === "ne") posCss = `top: -4px; right: -4px;`;
    if (position === "e")  posCss = `top: calc(50% - 4px); right: -4px;`;
    if (position === "se") posCss = `bottom: -4px; right: -4px;`;
    if (position === "s")  posCss = `bottom: -4px; left: calc(50% - 4px);`;
    if (position === "sw") posCss = `bottom: -4px; left: -4px;`;
    if (position === "w")  posCss = `top: calc(50% - 4px); left: -4px;`;

    return `position: absolute; width: ${size}; height: ${size}; background: #ffffff; border: 1px solid #2563eb; border-radius: 2px; cursor: ${cursor}; pointer-events: auto; z-index: 25; ${posCss}`;
}

function createPopupControlsUI() {
    const rangeToolBtn = document.getElementById("rangeToolBtn");
    if (!rangeToolBtn || !rangeToolBtn.parentElement) return;

    const parentWrapper = rangeToolBtn.parentElement;
    parentWrapper.style.position = "relative"; 

    const primaryPopup = document.createElement("div");
    primaryPopup.id = "rangePrimaryPopup";
    primaryPopup.style.cssText = `
        position: absolute; bottom: 100%; left: 0; margin-bottom: -2px;
        background: #111827; border: 1px solid #1f2937; border-radius: 8px;
        padding: 6px 10px; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4);
        display: none; justify-content: space-between; align-items: center;
        gap: 8px; box-sizing: border-box; z-index: 100; width: 100%;
    `;

    primaryPopup.innerHTML = `
        <button id="prmColorBtn" style="background: #2563eb; color: #ffffff; border: none; padding: 5px 10px; border-radius: 6px; font-size: 12px; font-weight: 700; cursor: pointer;">🎨 Options</button>
        <button id="prmPinBtn" style="display: none; background: #374151; color: #ffffff; border: 1px solid #4b5563; padding: 5px 8px; border-radius: 6px; font-size: 11px; font-weight: 600; cursor: pointer;">Normal</button>
        <div id="prmRowBox" style="display: flex; align-items: center; gap: 4px; background: #1f2937; border: 1px solid #374151; border-radius: 6px; padding: 3px 6px;">
            <span style="font-size: 11px; color: #9ca3af; font-weight: 600;">Rows:</span>
            <input type="number" id="prmRowCount" value="11" min="1" max="50" style="width: 28px; background: transparent; border: none; color: #ffffff; text-align: center; font-size: 12px; font-weight: bold; outline: none;">
        </div>
        <div style="display: flex; align-items: center; gap: 4px;">
            <button id="prmDeleteBtn" style="background: transparent; color: #ef4444; border: none; font-size: 15px; cursor: pointer;" title="Delete">🗑️</button>
            <button id="prmCloseBtn" style="background: transparent; color: #9ca3af; border: none; font-size: 15px; font-weight: bold; cursor: pointer;" title="Close">✕</button>
        </div>
    `;

    const colorPalettePopup = document.createElement("div");
    colorPalettePopup.id = "rangeColorPalettePopup";
    colorPalettePopup.style.cssText = `
        position: absolute; bottom: 100%; left: 0; margin-bottom: -160px;
        background: #ffffff; border: 1px solid #e5e7eb; border-radius: 10px;
        padding: 10px; box-shadow: 0 12px 28px rgba(0, 0, 0, 0.15);
        display: none; flex-direction: column; gap: 10px; box-sizing: border-box; z-index: 101; width: 100%;
    `;

    colorPalettePopup.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 6px; border-bottom: 1px solid #f1f5f9; padding-bottom: 6px;">
            <div style="flex: 1; display: flex; flex-direction: column; gap: 2px;">
                <span style="font-size: 10px; font-weight: 700; color: #334155;">Line / Border</span>
                <input type="color" id="paletteBorderColor" value="#2563eb" style="width: 28px; height: 22px; border: none; cursor: pointer; background: none;">
            </div>
            <div id="paletteFillContainer" style="flex: 1; display: flex; flex-direction: column; gap: 2px;">
                <span style="font-size: 10px; font-weight: 700; color: #334155;">Fill Color</span>
                <div style="display: flex; align-items: center; gap: 4px;">
                    <input type="color" id="paletteFillColor" value="#2563eb" style="width: 22px; height: 22px; border: none; cursor: pointer; background: none;">
                    <button id="paletteFillNone" style="font-size: 9px; padding: 2px 4px; border: 1px solid #cbd5e1; background: #fff; color: #475569; border-radius: 4px; font-weight: 600; cursor: pointer;">None</button>
                </div>
            </div>
        </div>

        <div id="paletteTopRowContainer" style="display: flex; align-items: center; justify-content: space-between; gap: 6px; border-bottom: 1px solid #f1f5f9; padding-bottom: 6px;">
            <span style="font-size: 10px; font-weight: 700; color: #334155;">1st Row Color</span>
            <div style="display: flex; align-items: center; gap: 6px;">
                <input type="color" id="paletteTopRowColor" value="#2563eb" style="width: 28px; height: 22px; border: none; cursor: pointer; background: none;">
                <button id="paletteTopRowNone" style="font-size: 9px; padding: 2px 4px; border: 1px solid #cbd5e1; background: #fff; color: #475569; border-radius: 4px; font-weight: 600; cursor: pointer;">None</button>
            </div>
        </div>

        <div style="display: flex; align-items: center; justify-content: space-between; gap: 6px;">
            <div style="flex: 1; display: flex; flex-direction: column; gap: 2px;">
                <span style="font-size: 10px; font-weight: 700; color: #334155;">Thickness</span>
                <select id="prmBorderWidth" style="background: #f8fafc; color: #334155; border: 1px solid #cbd5e1; border-radius: 4px; padding: 2px; font-size: 11px; font-weight: bold; cursor: pointer;">
                    <option value="1px">1px</option>
                    <option value="2px" selected>2px</option>
                    <option value="3px">3px</option>
                    <option value="4px">4px</option>
                </select>
            </div>
            <div style="flex: 1; display: flex; flex-direction: column; gap: 2px;">
                <span style="font-size: 10px; font-weight: 700; color: #334155;">Style</span>
                <select id="prmBorderStyle" style="background: #f8fafc; color: #334155; border: 1px solid #cbd5e1; border-radius: 4px; padding: 2px; font-size: 11px; font-weight: bold; cursor: pointer;">
                    <option value="solid">Solid</option>
                    <option value="dashed">Dashed</option>
                    <option value="dotted">Dotted</option>
                </select>
            </div>
        </div>
    `;

    parentWrapper.appendChild(primaryPopup);
    parentWrapper.appendChild(colorPalettePopup);

    document.getElementById("prmColorBtn").addEventListener("click", (e) => {
        e.stopPropagation();
        colorPalettePopup.style.display = (colorPalettePopup.style.display === "none" || colorPalettePopup.style.display === "") ? "flex" : "none";
    });

    document.getElementById("prmDeleteBtn").addEventListener("click", (e) => { e.stopPropagation(); deleteSelectedDrawing(); });
    document.getElementById("prmCloseBtn").addEventListener("click", (e) => { e.stopPropagation(); closeAllPopups(); });

    document.getElementById("prmPinBtn").addEventListener("click", () => {
        const current = drawingsHistory.find(d => d.id === activeSelectedDrawingId);
        if (current && (current.type === "rectangle" || current.type === "trendline")) {
            saveStateToHistory(); 
            current.isPinnedToRow = !current.isPinnedToRow;
            if (!current.isPinnedToRow) attachNearestRowToDrawing(current);
            saveDrawingsToStorage();
            renderDrawings();
            syncPopupInputs();
        }
    });

    document.getElementById("prmBorderWidth").addEventListener("change", (e) => updateActiveDrawingWithHistory(d => d.borderWidth = e.target.value));
    document.getElementById("prmBorderStyle").addEventListener("change", (e) => updateActiveDrawingWithHistory(d => d.borderStyle = e.target.value));

    const bindColorPickerWithHistory = (elementId, applyFn) => {
        const elem = document.getElementById(elementId);
        if (!elem) return;

        elem.addEventListener("focus", () => {
            saveStateToHistory(); 
        });

        elem.addEventListener("input", (e) => {
            if (!activeSelectedDrawingId) return;
            const target = drawingsHistory.find(d => d.id === activeSelectedDrawingId);
            if (target) {
                applyFn(target, e.target.value);
                saveDrawingsToStorage();
                renderDrawings();
            }
        });
    };

    bindColorPickerWithHistory("paletteBorderColor", (d, val) => d.borderColor = val);
    bindColorPickerWithHistory("paletteFillColor", (d, val) => d.bgColor = hexToRgba(val, 0.2));
    bindColorPickerWithHistory("paletteTopRowColor", (d, val) => d.topRowBg = hexToRgba(val, 0.25));

    document.getElementById("paletteFillNone").addEventListener("click", () => updateActiveDrawingWithHistory(d => d.bgColor = "transparent"));
    document.getElementById("paletteTopRowNone").addEventListener("click", () => updateActiveDrawingWithHistory(d => d.topRowBg = "transparent"));
    
    document.getElementById("prmRowCount").addEventListener("change", (e) => {
        const val = parseInt(e.target.value) || 11;
        defaultRowCount = val;
        updateActiveDrawingWithHistory(d => d.rowCount = val);
    });

    syncPopupInputs();
}

function closeAllPopups() {
    const primaryPopup = document.getElementById("rangePrimaryPopup");
    const colorPalettePopup = document.getElementById("rangeColorPalettePopup");
    if (primaryPopup) primaryPopup.style.display = "none";
    if (colorPalettePopup) colorPalettePopup.style.display = "none";
}

function syncPopupInputs() {
    if (!activeSelectedDrawingId && drawingsHistory.length > 0) {
        activeSelectedDrawingId = drawingsHistory[drawingsHistory.length - 1].id;
    }

    const current = drawingsHistory.find(d => d.id === activeSelectedDrawingId);
    if (!current) return;

    const rowBox = document.getElementById("prmRowBox");
    const topRowContainer = document.getElementById("paletteTopRowContainer");
    const fillContainer = document.getElementById("paletteFillContainer");
    const pinBtn = document.getElementById("prmPinBtn");

    if (current.type === "trendline") {
        if (rowBox) rowBox.style.display = "none";
        if (topRowContainer) topRowContainer.style.display = "none";
        if (fillContainer) fillContainer.style.display = "none";
        if (pinBtn) {
            pinBtn.style.display = "block";
            pinBtn.innerText = current.isPinnedToRow ? "📌 Pinned" : "Normal";
            pinBtn.style.background = current.isPinnedToRow ? "#2563eb" : "#374151";
        }
    } else if (current.type === "rectangle") {
        if (rowBox) rowBox.style.display = "none";
        if (topRowContainer) topRowContainer.style.display = "none";
        if (fillContainer) fillContainer.style.display = "flex";
        if (pinBtn) {
            pinBtn.style.display = "block";
            pinBtn.innerText = current.isPinnedToRow ? "📌 Pinned" : "Normal";
            pinBtn.style.background = current.isPinnedToRow ? "#2563eb" : "#374151";
        }
    } else {
        if (rowBox) rowBox.style.display = "flex";
        if (topRowContainer) topRowContainer.style.display = "flex";
        if (fillContainer) fillContainer.style.display = "flex";
        if (pinBtn) pinBtn.style.display = "none";
    }

    const rowInput = document.getElementById("prmRowCount");
    if (rowInput) rowInput.value = current.rowCount || 11;

    const borderWidthSelect = document.getElementById("prmBorderWidth");
    if (borderWidthSelect && current.borderWidth) borderWidthSelect.value = current.borderWidth;

    const borderStyleSelect = document.getElementById("prmBorderStyle");
    if (borderStyleSelect && current.borderStyle) borderStyleSelect.value = current.borderStyle;

    const paletteBorder = document.getElementById("paletteBorderColor");
    if (paletteBorder && current.borderColor) paletteBorder.value = rgbaToHex(current.borderColor);

    const paletteTopRow = document.getElementById("paletteTopRowColor");
    if (paletteTopRow && current.topRowBg) paletteTopRow.value = rgbaToHex(current.topRowBg);
}

function updateActiveDrawingWithHistory(updateFn) {
    if (!activeSelectedDrawingId) return;
    const target = drawingsHistory.find(d => d.id === activeSelectedDrawingId);
    if (target) {
        saveStateToHistory(); 
        updateFn(target);
        saveDrawingsToStorage();
        renderDrawings();
    }
}

function hexToRgba(hex, alpha) {
    let c = hex.replace('#', '');
    if (c.length === 3) c = c.split('').map(x => x + x).join('');
    const num = parseInt(c, 16);
    return `rgba(${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}, ${alpha})`;
}

function rgbaToHex(rgba) {
    if (!rgba || rgba === "transparent") return "#2563eb";
    if (rgba.startsWith("#")) return rgba;
    const parts = rgba.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (!parts) return "#2563eb";
    return "#" + parts.slice(1, 4).map(x => parseInt(x).toString(16).padStart(2, '0')).join('');
}
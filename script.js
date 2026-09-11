document.addEventListener("DOMContentLoaded", () => {

// ==========================================
// SUPABASE & REALTIME API CONFIGURATION
// ==========================================
const SUPABASE_URL = 'https://uyiqnufwstoxjipkefob.supabase.co';
const SUPABASE_KEY = 'sb_publishable_lG_mg0Pd_pNRzuGM0wQW2Q_vg5TRXyu';
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Pagination & State Control
const PAGE_SIZE = 100;
let currentPage = 0;
let isLoading = false;
let hasMore = true;

let gameData = []; // সকল গেম ডেটার অ্যারে
let isRendering = false;

// DOM Elements
const timerDisplay = document.getElementById("timerDisplay");
const periodDisplay = document.getElementById("periodDisplay");
const savedCount = document.getElementById("savedCount");

// Analysis Elements
const pnValue = document.getElementById("pnValue");
const pnResult = document.getElementById("pnResult");
const l5nValue = document.getElementById("l5nValue");
const l5nResult = document.getElementById("l5nResult");
const roundReminder = document.getElementById("roundReminder");

// Reappear Confirmation Elements
const row10Info = document.getElementById("row10Info") || document.getElementById("row10Number");
const row10Prediction = document.getElementById("row10Prediction") || document.getElementById("row10Color");

const tableBody = document.getElementById("fullTableBody");
const tableContainer = document.getElementById("tableContainer");

// Traded Set Data Persistence (LocalStorage)
let tradedPeriodsSet = new Set();

function loadTradedPeriods() {
    try {
        const saved = localStorage.getItem("traded_periods_data");
        if (saved) {
            tradedPeriodsSet = new Set(JSON.parse(saved));
        }
    } catch (e) {
        console.error("Error loading saved traded list:", e);
    }
}

function saveTradedPeriods() {
    try {
        localStorage.setItem("traded_periods_data", JSON.stringify(Array.from(tradedPeriodsSet)));
    } catch (e) {
        console.error("Error saving traded list:", e);
    }
}

loadTradedPeriods();

// ==========================================
// INFINITE SCROLL & SUPABASE PAGINATION ENGINE
// ==========================================

// Supabase থেকে পেজিনেশন সহ ডেটা ফেচ করা
async function fetchSupabaseRows(page = 0) {
    if (isLoading || !hasMore) return;
    isLoading = true;

    showLoadingIndicator(true);

    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    try {
        const { data, error, count } = await _supabase
            .from('wingo_results')
            .select('*', { count: 'exact' })
            .order('period', { ascending: false }) // ড্যাশবোর্ডের জন্য ডিসেন্ডিং অর্ডারে ফেচ
            .range(from, to);

        if (error) throw error;

        // মোট রেকর্ডের কাউন্ট আপডেট
        if (count !== null && savedCount) {
            savedCount.innerText = Number(count).toLocaleString();
        }

        if (data && data.length > 0) {
            if (page === 0) {
                gameData = data.slice().reverse(); // প্রথম পেজের ডেটা গেম ডেটায় ঢুকানো (Ascending Layout)
            } else {
                // পেছনের পুরোনো ডেটা অ্যার্যের শুরুতে যোগ করা
                const reversedNewData = data.slice().reverse();
                gameData = [...reversedNewData, ...gameData];
            }
            currentPage++;
            updateDashboard();
        } else {
            hasMore = false;
        }
    } catch (err) {
        console.error("❌ Supabase infinite fetch error:", err);
    } finally {
        isLoading = false;
        showLoadingIndicator(false);
    }
}

// ==========================================
// DIRECT REALTIME API FETCH (WORKER.JS LOGIC)
// ==========================================
async function fetchDirectApiRealtimeData() {
    try {
        const liveUrl = window.location.origin + '/?live=1&t=' + Date.now();
        const fallbackUrl = `https://draw.ar-lottery01.com/WinGo/WinGo_30S/GetHistoryIssuePage.json?pageSize=15&pageNo=1&ts=${Date.now()}`;
        
        let res;
        try {
            res = await fetch(liveUrl);
            const contentType = res.headers.get("content-type");
            
            // যদি HTML ব্যাক আসে তবে জোরপূর্বক ফ্যালব্যাক URL কল করবে
            if (!res.ok || (contentType && contentType.includes("text/html"))) {
                throw new Error("Returned HTML instead of JSON");
            }
        } catch(e) {
            // ফ্যালব্যাক রিকোয়েস্ট (Direct Third-Party API)
            res = await fetch(fallbackUrl);
        }

        if (!res.ok) return;

        const json = await res.json();
        const list = json && json.data && json.data.list ? json.data.list : [];
        if (list.length === 0) return;

        let hasNewRow = false;

        list.forEach((item) => {
            const num = Number(item.number);
            let colorVal = String(item.color || '');

            if (num === 0) colorVal = 'Red, Violet';
            else if (num === 5) colorVal = 'Green, Violet';
            else if ([1, 3, 7, 9].includes(num)) colorVal = 'Green';
            else if ([2, 4, 6, 8].includes(num)) colorVal = 'Red';

            const periodStr = String(item.issueNumber);
            const exists = gameData.some(row => String(row.period) === periodStr);

            if (!exists) {
                const formattedRow = {
                    period: periodStr,
                    number: String(num),
                    bigSmall: num >= 5 ? 'Big' : 'Small',
                    color: colorVal
                };
                gameData.push(formattedRow);
                hasNewRow = true;
            }
        });

        if (hasNewRow) {
            // Sort ascending by period
            gameData.sort((a, b) => BigInt(a.period) > BigInt(b.period) ? 1 : -1);
            updateDashboard();
        }

    } catch (err) {
        console.warn("Direct Realtime fetch skipped/error:", err);
    }
}

// ==========================================
// ⏱️ WIN GO 30s COUNTDOWN TIMER ENGINE
// ==========================================
function startWinGoTimer() {
    setInterval(() => {
        const now = new Date();
        const totalSeconds = now.getSeconds();
        let remainingSeconds = 30 - (totalSeconds % 30);
        
        if (remainingSeconds === 30) remainingSeconds = 0;

        const secStr = remainingSeconds < 10 ? '0' + remainingSeconds : String(remainingSeconds);
        if (timerDisplay) {
            timerDisplay.innerText = '00:' + secStr;
        }

        // প্রতি ৩০ সেকেন্ডের একদম শেষে বা নতুন পিরিয়ডের শুরুতে রিয়ালটাইম API ডাটা টানবে
        if (remainingSeconds === 0 || remainingSeconds === 1) {
            fetchDirectApiRealtimeData();
        }
    }, 1000);
}

// Supabase Realtime Postgres Changes Subscription
function startSupabaseRealtime() {
    _supabase
        .channel('wingo-live-results')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'wingo_results' }, async () => {
            await fetchDirectApiRealtimeData();
        })
        .subscribe();
}

// ম্যানুয়াল ডেটা লোড করার বাটন শো করার ফাংশন
function showLoadingIndicator(show) {
    let loader = document.getElementById("loadMoreBtnContainer");
    if (!loader && tableContainer) {
        loader = document.createElement("div");
        loader.id = "loadMoreBtnContainer";
        loader.style.cssText = "padding: 12px; text-align: center;";
        
        const btn = document.createElement("button");
        btn.id = "loadMoreDataBtn";
        btn.innerText = "⬇ Load More History";
        btn.style.cssText = "padding: 8px 16px; background: #2563eb; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 12px;";
        
        btn.addEventListener("click", () => {
            if (hasMore && !isLoading) {
                btn.innerText = "⏳ Loading...";
                fetchSupabaseRows(currentPage);
            }
        });

        loader.appendChild(btn);
        tableContainer.appendChild(loader);
    }

    if (loader) {
        const btn = loader.querySelector("#loadMoreDataBtn");
        if (!hasMore) {
            if (btn) btn.innerText = "No More Data Available";
        } else if (!show && btn) {
            btn.innerText = "⬇ Load More History";
        }
    }
}

// পেজ শুরু হওয়ার ইনিশিয়ালাইজেশন
async function initEngine() {
    await fetchSupabaseRows(0);
    await fetchDirectApiRealtimeData();

    startSupabaseRealtime();
    startWinGoTimer();
}

initEngine();

// ==========================================
// CONTROL BUTTONS EVENT HANDLING
// ==========================================
const clearBtn = document.getElementById("clearBtn");
if (clearBtn) {
    clearBtn.addEventListener("click", () => {
        if (confirm("Are you sure you want to delete all saved data?")) {
            gameData = [];
            updateDashboard();
        }
    });
}

// Alignment & Badge Builder for Period Cell
function getPeriodCellHTML(periodVal) {
    const periodStr = String(periodVal).trim();
    const isTraded = tradedPeriodsSet.has(periodStr);
    
    return `
        <div style="position: relative; display: inline-block; text-align: center; width: 100%;">
            <span>${periodStr}</span>
            ${isTraded ? `<span class="traded-bubble" style="margin-left: 8px;">Traded</span>` : ''}
        </div>
    `;
}

// Shared Download Engine Logic
async function triggerReportDownload(exportData) {
    if (!exportData || exportData.length === 0) {
        alert("No data available to download!");
        return;
    }

    let tradedPeriodsSet = new Set();
    try {
        const saved = localStorage.getItem("traded_periods_data");
        if (saved) tradedPeriodsSet = new Set(JSON.parse(saved));
    } catch (e) {}

    let drawingsDataRaw = "[]";
    try {
        const savedDrawings = localStorage.getItem("analysis_drawings_data");
        if (savedDrawings) drawingsDataRaw = savedDrawings;
    } catch(e) {}

    let analysisToolsCode = "";
    try {
        const resp = await fetch("analysistools.js");
        analysisToolsCode = await resp.text();
    } catch(e) {
        console.error("Could not load analysistools.js code:", e);
    }

    const reversedData = [...exportData].reverse();
    let rows = "";

    reversedData.forEach((row) => {
        let colorHTML = "";
        if (row.color) {
            row.color.split(",").forEach(c => {
                let color = c.trim().toLowerCase();
                colorHTML += `<span class="dot ${color}"></span>`;
            });
        }

        const periodStr = String(row.period).trim();
        const isTraded = tradedPeriodsSet.has(periodStr);
        const periodCellContent = `
            <div style="position: relative; display: inline-block; text-align: center; width: 100%;">
                <span>${periodStr}</span>
                ${isTraded ? `<span class="traded-bubble" style="margin-left: 8px;">Traded</span>` : ''}
            </div>
        `;

        const targetNum = parseInt(row.number);
        let chartPointsHTML = "";
        for (let i = 0; i <= 9; i++) {
            let colorClass = (i === 0 || i === 5) ? "violet" : (i % 2 === 0 ? "red" : "green");
            if (i === targetNum) {
                chartPointsHTML += `<div class="chart-point active target-point ${colorClass}">${i}</div>`;
            } else {
                chartPointsHTML += `<div class="chart-point">${i}</div>`;
            }
        }

        rows += `
        <tr data-period="${periodStr}">
            <td style="width: 25%;">${periodCellContent}</td>
            <td style="width: 12%;">${row.number}</td>
            <td style="width: 15%;">${row.bigSmall}</td>
            <td style="width: 13%;">${colorHTML}</td>
            <td class="chart-cell" style="width: 35%;"><div class="chart-wrap"><div class="chart-points">${chartPointsHTML}</div></div></td>
        </tr>`;
    });

    const htmlContent = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Game Data Dashboard Report</title>
    <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
    html { scroll-behavior: smooth; }
    body { background: #f4f7f9; color: #333; padding: 20px; max-width: 950px; margin: auto; }
    
    .header-info { margin-bottom: 15px; font-size: 14px; background: #ffffff; padding: 12px 18px; border-radius: 8px; border: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 2px 6px rgba(0,0,0,0.03); }
    .header-info h2 { color: #2563eb; font-size: 18px; }

    .sticky-header-group {
        position: sticky;
        top: 0;
        width: 100%;
        z-index: 1000;
        background: #ffffff;
        border-radius: 8px 8px 0 0;
        box-shadow: 0 4px 12px rgba(0,0,0,0.08);
        transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.25s ease;
        will-change: transform;
    }

    .sticky-header-group.hide-header {
        transform: translateY(-150%);
        opacity: 0;
        pointer-events: none;
    }

    .toolbar-container { 
        display: flex; 
        align-items: center; 
        justify-content: space-between;
        padding: 10px 14px; 
        background: #ffffff;
        border: 1px solid #e2e8f0; 
        border-bottom: none;
        border-radius: 8px 8px 0 0;
    }

    .tools-left, .tools-right {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .btn { padding: 6px 12px; font-size: 12px; font-weight: bold; border-radius: 6px; border: 1px solid #cbd5e1; background: #fff; cursor: pointer; transition: all 0.2s; }
    .btn:hover { background: #f1f5f9; }
    .btn-top { background: #2563eb; color: #fff; border: none; padding: 6px 14px; }
    .btn-top:hover { background: #1d4ed8; }
    .btn-close { background: #64748b; color: #fff; border: none; padding: 6px 10px; font-size: 14px; }
    .btn-close:hover { background: #475569; }
    .btn-danger { background: #ef4444; color: #fff; border: none; }
    .btn-danger:hover { background: #dc2626; }

    .table-wrapper { position: relative; background: #ffffff; margin-top: 0px; border-radius: 0 0 8px 8px; border: 1px solid #e2e8f0; border-top: none; overflow: visible; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    
    .header-table {
        width: 100%;
        border-collapse: collapse;
        table-layout: fixed;
    }
    .header-table th { 
        background: #2563eb; 
        color: #ffffff; 
        padding: 12px 8px; 
        font-size: 13px; 
        font-weight: 600; 
        text-align: center; 
    }

    td { padding: 8px 6px; text-align: center; font-size: 13px; border-bottom: 1px solid #e2e8f0; color: #334155; }
    tr:nth-child(even) { background-color: #f8fafc; }
    .dot { width: 12px; height: 12px; display: inline-block; border-radius: 50%; margin: 0 2px; }
    .dot.red { background: #ef4444; } .dot.green { background: #22c55e; } .dot.violet { background: #a855f7; }
    .traded-bubble { background: #2563eb; color: #fff; font-size: 10px; padding: 2px 7px; border-radius: 12px; font-weight: bold; display: inline-block; vertical-align: middle; } @media (min-width: 700px){.traded-bubble {position: absolute;}}
    .chart-cell { position: relative; min-width: 260px; height: 36px; padding: 0; }
    .chart-wrap { position: relative; width: 260px; height: 36px; margin: auto; }
    .chart-points { position: absolute; left: 0; top: 0; width: 260px; height: 36px; display: flex; justify-content: space-between; align-items: center; z-index: 5; }
    .chart-point { width: 22px; height: 22px; border-radius: 50%; border: 1px solid #cbd5e1; background: transparent; color: #64748b; font-size: 11px; font-weight: bold; display: flex; align-items: center; justify-content: center; position: relative; z-index: 2; }
    .chart-point.active { color: #ffffff !important; border: none !important; z-index: 10 !important; }
    .chart-point.red { background: #ef4444 !important; } .chart-point.green { background: #22c55e !important; } .chart-point.violet { background: #a855f7 !important; }
    #reportTrendSVG { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 3; }
    .drawing-range-box { position: absolute; pointer-events: auto; box-sizing: border-box; z-index: 12; }

    .options-popup, .drawing-options-menu, [data-options-popup] {
        top: 100% !important;
        bottom: auto !important;
        margin-top: 6px !important;
        z-index: 2000 !important;
    }

	 #rangePrimaryPopup {
		margin-bottom: -35px !important;
		margin-left: -9px !important;
		width: 250px !important;
	 }
	 #rangeColorPalettePopup {
		 margin-bottom: -191px !important;
		 margin-left: -9px !important;
		 width: 250px !important;
		 height: 150px !important;
	 } 

    </style></head>
    <body>

    <div class="header-info" id="topHeader">
        <h2>|| Wingo Data Analysis Report</h2>
        <div><span><b>Total Saved Rows: <span style="color: blue;"> ${exportData.length}</span></b></span> | <span><b>Download Time: <span style="color: blue;"> ${new Date().toLocaleString()}</span></b></span></div>
    </div>

    <div class="sticky-header-group" id="stickyHeaderGroup">
        <div class="toolbar-container">
            <div class="tools-left">
                <button id="rangeToolBtn" class="btn">Select Range</button>
                <button id="undoDrawingBtn" class="btn">↩ Undo</button>
                <button id="redoDrawingBtn" class="btn">↪ Redo</button>
                <button id="clearDrawingBtn" class="btn btn-danger">🗑 Clear All</button>
            </div>
            <div class="tools-right">
                <button id="scrollToTopBtn" class="btn btn-top">Click to Top ⬆</button>
                <button id="closeHeaderBtn" class="btn btn-close" title="Hide Header">✖</button>
            </div>
        </div>
        
        <table class="header-table">
            <thead>
                <tr>
                    <th style="width: 25%;">Period</th>
                    <th style="width: 12%;">Number</th>
                    <th style="width: 15%;">Big Small</th>
                    <th style="width: 13%;">Color</th>
                    <th style="width: 35%;">Chart</th>
                </tr>
            </thead>
        </table>
    </div>

    <div class="table-wrapper" id="reportWrapper"><svg id="reportTrendSVG"></svg>
        <table>
            <tbody id="fullTableBody">${rows}</tbody>
        </table>
    </div>

    <script>
    if (!localStorage.getItem("analysis_drawings_data")) {
        localStorage.setItem("analysis_drawings_data", JSON.stringify(${drawingsDataRaw}));
    }

    document.getElementById("scrollToTopBtn")?.addEventListener("click", () => {
        window.scrollTo({ top: 0, behavior: "smooth" });
    });

    const stickyHeader = document.getElementById("stickyHeaderGroup");
    let isManuallyClosed = false;

    document.getElementById("closeHeaderBtn")?.addEventListener("click", () => {
        stickyHeader.classList.add("hide-header");
        isManuallyClosed = true;
    });

    let lastScrollY = window.scrollY;

    window.addEventListener("scroll", () => {
        const currentScrollY = window.scrollY;
        const diff = currentScrollY - lastScrollY;

        if (currentScrollY <= 20) {
            isManuallyClosed = false;
            stickyHeader.classList.remove("hide-header");
        } else if (!isManuallyClosed) {
            if (diff > 5) {
                stickyHeader.classList.add("hide-header");
            } else if (diff < -5) {
                stickyHeader.classList.remove("hide-header");
            }
        }

        lastScrollY = currentScrollY;
    });

    window.addEventListener("load", () => {
        const svg = document.getElementById("reportTrendSVG");
        const wrapper = document.getElementById("reportWrapper");
        const targetPoints = document.querySelectorAll(".target-point");
        if (svg && wrapper && targetPoints.length > 0) {
            svg.setAttribute("width", wrapper.offsetWidth);
            svg.setAttribute("height", wrapper.offsetHeight);
            const rectWrapper = wrapper.getBoundingClientRect();
            const points = [];
            targetPoints.forEach(el => {
                const rect = el.getBoundingClientRect();
                const x = (rect.left + rect.width / 2) - rectWrapper.left;
                const y = (rect.top + rect.height / 2) - rectWrapper.top;
                points.push({ x, y });
            });
            let svgContent = "";
            for (let i = 0; i < points.length - 1; i++) {
                const p1 = points[i]; const p2 = points[i + 1];
                svgContent += \`<line x1="\${p1.x}" y1="\${p1.y}" x2="\${p2.x}" y2="\${p2.y}" stroke="#ff4d4f" stroke-width="2"/>\`;
            }
            svg.innerHTML = svgContent;
        }

        if (window.renderDrawings) {
            window.renderDrawings();
        }
    });
    <\/script>

    <script>
    ${analysisToolsCode}
    <\/script>
    </body></html>`;

    const blob = new Blob([htmlContent], { type: "text/html" });
    const url = URL.createObjectURL(blob);

    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const yy = String(d.getFullYear()).slice(-2);

    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    
    const fileName = `Wingo Data Report ${mm}-${dd}-${yy} ${hours}-${minutes}-${seconds}.html`;

    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;

    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    URL.revokeObjectURL(url);
}

// Download Button Event
const downloadBtn = document.getElementById("downloadBtn");
if (downloadBtn) {
    downloadBtn.addEventListener("click", () => {
        triggerReportDownload(gameData);
    });
}

// Mobile View Controls Toggle
const toggleBtn = document.getElementById("toggleControlsBtn");
if (toggleBtn) {
    toggleBtn.addEventListener("click", () => {
        const left = document.getElementById("leftSidebar");
        const right = document.getElementById("rightSidebar");
        
        if (left && left.classList.contains("active")) {
            left.classList.remove("active");
            if (right) right.classList.remove("active");
            toggleBtn.innerText = "Show Controls & Stats";
        } else {
            if (left) left.classList.add("active");
            if (right) right.classList.add("active");
            toggleBtn.innerText = "Hide Controls & Stats";
        }
        setTimeout(() => {
            drawColumnTrendLines();
            if (typeof renderDrawings === "function") renderDrawings();
        }, 100);
    });
}

// Period Input & List Handling
const periodInput = document.getElementById("periodInput");
const addPeriodBtn = document.getElementById("addPeriodBtn");
const periodList = document.getElementById("periodList");

function renderPeriodListUI() {
    if (!periodList) return;
    periodList.innerHTML = "";
    
    Array.from(tradedPeriodsSet).reverse().forEach((val, idx, arr) => {
        const li = document.createElement("li");
        const count = arr.length - idx;
        
        li.innerHTML = `
            <span><b>#${count}</b> - ${val}</span> 
            <div>
                <span class="badge-tag">Traded</span>
                <button class="delete-btn" data-period="${val}">✕</button>
            </div>
        `;
        periodList.appendChild(li);
    });

    periodList.querySelectorAll(".delete-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
            const targetPeriod = e.target.getAttribute("data-period");
            tradedPeriodsSet.delete(targetPeriod);
            saveTradedPeriods();
            renderPeriodListUI();
            renderTable();
        });
    });
}

function addPeriodToList() {
    if (!periodInput) return;
    
    const value = periodInput.value.trim();
    if (value === "") return;

    if (!tradedPeriodsSet.has(value)) {
        tradedPeriodsSet.add(value);
        saveTradedPeriods();
        renderPeriodListUI();
        renderTable();
    }
    
    periodInput.value = "";
}

if (addPeriodBtn) {
    addPeriodBtn.addEventListener("click", addPeriodToList);
}

if (periodInput) {
    periodInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
            addPeriodToList();
        }
    });
}

renderPeriodListUI();

// Engine Functions
function updateDashboard() {
    // অটোমেটিক নেক্সট পিরিয়ড ক্যালকুলেশন
    if (gameData.length > 0 && periodDisplay) {
        const lastPeriod = String(gameData[gameData.length - 1].period).replace(/\D/g, "");
        if (lastPeriod) {
            try {
                periodDisplay.innerText = (BigInt(lastPeriod) + 1n).toString();
            } catch(e) {}
        }
    }
    
    calculateStatsOnly();
    renderTable();
}

function calculateStatsOnly() {
    if (gameData.length === 0) return;

    const currentNextPeriod = periodDisplay ? periodDisplay.innerText.trim() : "";

    if (currentNextPeriod && currentNextPeriod !== "----") {
        let latestRow = gameData[gameData.length - 1];
        let latestNum = parseInt(latestRow.number);
        let latestPeriodStr = String(latestRow.period);
        
        let latestPeriodLastDigit = parseInt(latestPeriodStr.slice(-1));
        let nextPeriodLastDigit = parseInt(currentNextPeriod.slice(-1));

        if (!isNaN(latestNum) && !isNaN(latestPeriodLastDigit) && !isNaN(nextPeriodLastDigit)) {
            let total = (latestNum + latestPeriodLastDigit) - nextPeriodLastDigit;
            if (total > 9) total = total - 10;
            if (total < 0) total = total + 10;

            if (pnValue) pnValue.innerText = total;
            if (pnResult) {
                pnResult.innerText = (total >= 0 && total <= 4) ? "Small" : "Big";
            }
        }
    }

    if (gameData.length >= 5) {
        let last5Rows = gameData.slice(-5);
        let sum = last5Rows.reduce((acc, row) => acc + (parseInt(row.number) || 0), 0);
        
        function reduceToSingleDigit(num) {
            while (num > 9) {
                num = String(num).split('').reduce((a, b) => parseInt(a) + parseInt(b), 0);
            }
            return num;
        }

        let singleDigit = reduceToSingleDigit(sum);
        if (l5nValue) l5nValue.innerText = singleDigit;
        if (l5nResult) {
            l5nResult.innerText = (singleDigit >= 0 && singleDigit <= 4) ? "Small" : "Big";
        }
    }

    if (currentNextPeriod && currentNextPeriod !== "----") {
        let last3 = currentNextPeriod.slice(-3);
        let last2 = currentNextPeriod.slice(-2);
        let last1 = currentNextPeriod.slice(-1);

        const triples = ["000", "111", "222", "333", "444", "555", "666", "777", "888", "999"];

        if (triples.includes(last3)) {
            if (roundReminder) roundReminder.innerText = "Strong Round Number";
        } else if (last2 === "00") {
            if (roundReminder) roundReminder.innerText = "Medium Round Number";
        } else if (last1 === "0") {
            if (roundReminder) roundReminder.innerText = "Normal Round Number";
        } else {
            if (roundReminder) roundReminder.innerText = "None";
        }
    }

    const reversedData = gameData.slice().reverse();
    if (reversedData.length >= 10) {
        let row10 = reversedData[9];
        let num = row10.number !== undefined ? row10.number : "-";
        let bs = row10.bigSmall || "-";
        let color = row10.color || "-";

        if (row10Info) {
            row10Info.innerText = `${num}, ${bs}, ${color}`;
        }
        
        if (row10Prediction) {
            row10Prediction.innerText = bs;
        }
    } else {
        if (row10Info) row10Info.innerText = "-";
        if (row10Prediction) row10Prediction.innerText = "-";
    }
}

function getNumberColor(number) {
    number = parseInt(number);
    if (number === 0 || number === 5) return "violet";
    if (number % 2 === 0) return "red";
    return "green";
}

function createChart(number) {
    number = parseInt(number);
    const wrap = document.createElement("div");
    wrap.className = "chart-wrap";

    const points = document.createElement("div");
    points.className = "chart-points";

    for (let i = 0; i <= 9; i++) {
        const point = document.createElement("div");
        point.className = "chart-point";
        point.innerText = i;

        if (i === number) {
            point.classList.add("active", "target-point", getNumberColor(i));
        }
        points.appendChild(point);
    }

    wrap.appendChild(points);
    return wrap;
}

function renderTable() {
    if (!tableBody || isRendering) return;
    isRendering = true;
    
    // Trading Viewport Anchoring: নতুন ডেটা যুক্ত হওয়ার আগে কন্টেইনারের স্ক্রল অবস্থা মেপে রাখা
    const oldScrollTop = tableContainer ? tableContainer.scrollTop : 0;
    const oldScrollHeight = tableContainer ? tableContainer.scrollHeight : 0;

    tableBody.innerHTML = "";
    const data = gameData.slice().reverse();

    const fragment = document.createDocumentFragment();

    data.forEach((row) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${getPeriodCellHTML(row.period)}</td>
            <td>${row.number || ''}</td>
            <td>${row.bigSmall || ''}</td>
            <td></td>
            <td class="chart-cell"></td>
        `;

        const colorCell = tr.children[3];
        if (row.color) {
            row.color.split(",").forEach(color => {
                const dot = document.createElement("span");
                dot.className = "dot " + color.trim().toLowerCase();
                colorCell.appendChild(dot);
            });
        }

        const chartCell = tr.children[4];
        chartCell.appendChild(createChart(row.number));

        fragment.appendChild(tr);
    });

    tableBody.appendChild(fragment);
    isRendering = false;

    // নতুন ডেটা উপরে যুক্ত হলেও ভিউপোর্ট সম্পূর্ণ স্থির রাখার অ্যাডজাস্টমেন্ট
    if (tableContainer) {
        if (oldScrollTop > 0) {
            const newScrollHeight = tableContainer.scrollHeight;
            tableContainer.scrollTop = oldScrollTop + (newScrollHeight - oldScrollHeight);
        } else {
            // পেজ রিলোডের পর সেভ করা স্ক্রল পজিশনে রিস্টোর
            const savedScrollPos = sessionStorage.getItem("dashboardTableScrollTop");
            if (savedScrollPos !== null) {
                tableContainer.scrollTop = parseInt(savedScrollPos, 10);
            }
        }
    }

    requestAnimationFrame(() => {
        drawColumnTrendLines();
        if (typeof renderDrawings === "function") renderDrawings();
    });
}

function drawColumnTrendLines() {
    const svg = document.getElementById("tableTrendSVG");
    const table = tableContainer ? tableContainer.querySelector("table") : null;
    
    if (!tableContainer || !svg || !table) return;

    const targetPoints = tableContainer.querySelectorAll(".target-point");
    if (targetPoints.length === 0) {
        svg.innerHTML = "";
        return;
    }

    const fullWidth = Math.max(table.scrollWidth, tableContainer.scrollWidth);
    const fullHeight = Math.max(table.scrollHeight, tableContainer.scrollHeight);

    svg.setAttribute("width", fullWidth);
    svg.setAttribute("height", fullHeight);
    svg.style.width = fullWidth + "px";
    svg.style.height = fullHeight + "px";

    const containerRect = tableContainer.getBoundingClientRect();
    let svgContent = "";

    const points = [];
    targetPoints.forEach(el => {
        const rect = el.getBoundingClientRect();
        const x = (rect.left + rect.width / 2) - containerRect.left + tableContainer.scrollLeft;
        const y = (rect.top + rect.height / 2) - containerRect.top + tableContainer.scrollTop;
        points.push({ x, y });
    });

    for (let i = 0; i < points.length - 1; i++) {
        const p1 = points[i];
        const p2 = points[i + 1];
        svgContent += `<line x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}" stroke="#ff4d4f" stroke-width="2"/>`;
    }

    svg.innerHTML = svgContent;
}

// ==========================================
// SCROLL LISTENERS (ONLY FOR SAVING SCROLL POSITION & REDRAWING)
// ==========================================
if (tableContainer) {
    let scrollTimer;
    tableContainer.addEventListener("scroll", () => {
        // স্ক্রল করার পর পজিশন sessionStorage-এ সেভ রাখা
        sessionStorage.setItem("dashboardTableScrollTop", tableContainer.scrollTop);

        clearTimeout(scrollTimer);
        scrollTimer = setTimeout(() => {
            drawColumnTrendLines();
            if (typeof renderDrawings === "function") renderDrawings();
        }, 50);
    });
}

// উইন্ডো স্ক্রল পজিশন সেভ করা
window.addEventListener("scroll", () => {
    sessionStorage.setItem("dashboardWindowScrollY", window.scrollY);
});

// রিলোডের পর Window-এর স্ক্রল অবস্থান রিস্টোর করা
window.addEventListener("load", () => {
    const savedWindowY = sessionStorage.getItem("dashboardWindowScrollY");
    if (savedWindowY !== null) {
        window.scrollTo(0, parseInt(savedWindowY, 10));
    }
});

let resizeTimer;
window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
        drawColumnTrendLines();
        if (typeof renderDrawings === "function") renderDrawings();
    }, 100);
});

});

// Scroll To Top Control
document.addEventListener('DOMContentLoaded', () => {
    const tableContainer = document.getElementById('tableContainer');
    const scrollToTopBtn = document.getElementById('scrollToTopBtn');

    if (tableContainer && scrollToTopBtn) {
        tableContainer.addEventListener('scroll', () => {
            if (tableContainer.scrollTop > 100) {
                scrollToTopBtn.style.display = 'flex';
            } else {
                scrollToTopBtn.style.display = 'none';
            }
        });

        scrollToTopBtn.addEventListener('click', () => {
            tableContainer.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });
    }
});
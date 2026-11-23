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
window.wingoGameData = gameData;
let isRendering = false;

// DOM Elements
const timerDisplay = document.getElementById("timerDisplay");
const savedCount = document.getElementById("savedCount");

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
            .order('period', { ascending: false })
            .range(from, to);

        if (error) throw error;

        if (count !== null && savedCount) {
            savedCount.innerText = Number(count).toLocaleString();
        }

        if (data && data.length > 0) {
            if (page === 0) {
                gameData = data.slice().reverse();
            } else {
                const reversedNewData = data.slice().reverse();
                gameData = [...reversedNewData, ...gameData];
            }
            window.wingoGameData = gameData;
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
            
            if (!res.ok || (contentType && contentType.includes("text/html"))) {
                throw new Error("Returned HTML instead of JSON");
            }
        } catch(e) {
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
            gameData.sort((a, b) => BigInt(a.period) > BigInt(b.period) ? 1 : -1);
            window.wingoGameData = gameData;
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
    if (window.StatisticsModule && typeof window.StatisticsModule.updateStatistics === "function") {
        window.StatisticsModule.updateStatistics(gameData);
    }
    renderTable();
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

    if (tableContainer) {
        if (oldScrollTop > 0) {
            const newScrollHeight = tableContainer.scrollHeight;
            tableContainer.scrollTop = oldScrollTop + (newScrollHeight - oldScrollHeight);
        } else {
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
        sessionStorage.setItem("dashboardTableScrollTop", tableContainer.scrollTop);

        clearTimeout(scrollTimer);
        scrollTimer = setTimeout(() => {
            drawColumnTrendLines();
            if (typeof renderDrawings === "function") renderDrawings();
        }, 50);
    });
}

window.addEventListener("scroll", () => {
    sessionStorage.setItem("dashboardWindowScrollY", window.scrollY);
});

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

// Period Number এবং Next Period অটো-ফিল করার স্ক্রিপ্ট
document.addEventListener("click", function(event) {
    let target = event.target;
    let periodValue = "";

    let nextPeriodContainer = target.closest("div, p, span, td");
    if (nextPeriodContainer && nextPeriodContainer.innerText.includes("Next Period")) {
      let matches = nextPeriodContainer.innerText.match(/\d+/);
      if (matches) periodValue = matches[0];
    } 
    else if (/^\d{10,}$/.test(target.innerText.trim())) {
      periodValue = target.innerText.trim();
    }

    if (!periodValue) {
      let cell = target.closest("td");
      if (cell) {
        let colIndex = cell.cellIndex;
        let table = cell.closest("table");
        
        if (table && table.rows[0]) {
          let headerText = table.rows[0].cells[colIndex]?.innerText.toLowerCase() || "";
          
          if (headerText.includes("period")) {
            periodValue = cell.innerText.replace(/traded/gi, '').trim();
          }
        }
      }
    }

    if (periodValue) {
      let sidebarInput = document.getElementById("periodInput");
      if (sidebarInput) sidebarInput.value = periodValue;

      let tradeInput = document.getElementById("tradePeriodInput");
      if (tradeInput) tradeInput.value = periodValue;

      target.style.transition = "opacity 0.15s ease";
      target.style.opacity = "0.5";
      setTimeout(() => {
        target.style.opacity = "1";
      }, 150);
    }
});
// ==========================================
// REPORT DOWNLOAD & UNIQUE DRAWING STORAGE ENGINE
// ==========================================

window.DownloadModule = (function () {
    async function triggerReportDownload(exportData) {
        if (!exportData || exportData.length === 0) {
            alert("No data available to download!");
            return;
        }

        // প্রতিটি রিপোর্টের জন্য একদম ইউনিক localStorage কী তৈরি করা হচ্ছে
        const uniqueReportKey = "analysis_drawings_data_report_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);

        let tradedPeriodsSet = new Set();
        try {
            const saved = localStorage.getItem("traded_periods_data");
            if (saved) tradedPeriodsSet = new Set(JSON.parse(saved));
        } catch (e) {}

        let drawingsDataRaw = "[]";
        try {
            const savedDrawings = localStorage.getItem("analysis_drawings_data");
            if (savedDrawings) drawingsDataRaw = savedDrawings;
        } catch (e) {}

        let analysisToolsCode = "";
        try {
            const resp = await fetch("analysistools.js");
            analysisToolsCode = await resp.text();
        } catch (e) {
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

        // analysistools.js এর ভেতরে থাকা "analysis_drawings_data" কী-কে এই রিপোর্টের ইউনিক কী দিয়ে প্রতিস্থাপন করা হচ্ছে
        const scopedAnalysisToolsCode = analysisToolsCode.replaceAll("analysis_drawings_data", uniqueReportKey);

        const htmlContent = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>WinGo Offilne Data</title>
        <style>
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
        html { scroll-behavior: smooth; }
        body { background: #f4f7f9; color: #333; padding: 112px 20px 20px 20px; max-width: 950px; margin: auto; }

        .header-info { margin-bottom: 15px; font-size: 14px; background: #ffffff; padding: 12px 18px; border-radius: 8px; border: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 2px 6px rgba(0,0,0,0.03); }
        .header-info h2 { color: #2563eb; font-size: 18px; }

        /* Top Fixed Header Group */
        .fixed-header-group {
            position: fixed;
            top: 0;
            left: 50%;
            transform: translateX(-50%);
            width: 100%;
            max-width: 950px;
            padding: 0 20px;
            z-index: 1000;
            background: #f4f7f9;
        }

        .fixed-header-inner {
            background: #ffffff;
            border-radius: 0 0 8px 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.08);
            overflow: hidden;
            border: 1px solid #e2e8f0;
            border-top: none;
        }

        .toolbar-container {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 10px 14px;
            background: #ffffff;
            border-bottom: 1px solid #e2e8f0;
        }

        .tools-left, .tools-right { display: flex; align-items: center; gap: 8px; }
        .btn { padding: 6px 12px; font-size: 12px; font-weight: bold; border-radius: 6px; border: 1px solid #cbd5e1; background: #fff; cursor: pointer; transition: all 0.2s; }
        .btn:hover { background: #f1f5f9; }
        .btn-top { background: #2563eb; color: #fff; border: none; padding: 6px 14px; }
        .btn-top:hover { background: #1d4ed8; }
        .btn-danger { background: #ef4444; color: #fff; border: none; }
        .btn-danger:hover { background: #dc2626; }

        .table-wrapper { position: relative; background: #ffffff; margin-top: 0px; border-radius: 8px; border: 1px solid #e2e8f0; overflow: visible; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
        table { width: 100%; border-collapse: collapse; table-layout: fixed; }
        .header-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
        .header-table th { background: #2563eb; color: #ffffff; padding: 12px 8px; font-size: 13px; font-weight: 600; text-align: center; }

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
            margin-bottom: -80px !important;
            margin-left: -9px !important;
            width: 250px !important;
        }
        #rangeColorPalettePopup {
            margin-bottom: -232px !important;
            margin-left: -9px !important;
            width: 250px !important;
            height: 150px !important;
        }

        @media (max-width: 600px) {
            body { padding-top: 122px; }
            .fixed-header-group { padding: 0 10px; }
            .header-info { flex-direction: column; gap: 6px; text-align: center; }
        }
        </style></head>
        <body>

        <div class="fixed-header-group" id="fixedHeaderGroup">
            <div class="fixed-header-inner">
                <div class="toolbar-container">
                    <div class="tools-left">
                        <button id="rangeToolBtn" class="btn">Select Range</button>
                        <button id="undoDrawingBtn" class="btn">↩ Undo</button>
                        <button id="redoDrawingBtn" class="btn">↪ Redo</button>
                        <button id="clearDrawingBtn" class="btn btn-danger">🗑 Clear All</button>
                    </div>
                    <div class="tools-right">
                        <button id="scrollToTopBtn" class="btn btn-top">Click to Top ⬆</button>
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
        </div>

        <div class="header-info" id="topHeader">
            <h2>Wingo<span style="color:#333;">View</span></h2>
            <div><span><b>Total Saved Rows: <span style="color: blue;"> ${exportData.length}</span></b></span> | <span><b>Download Time: <span style="color: blue;"> ${new Date().toLocaleString()}</span></b></span></div>
        </div>

        <div class="table-wrapper" id="reportWrapper"><svg id="reportTrendSVG"></svg>
            <table>
                <tbody id="fullTableBody">${rows}</tbody>
            </table>
        </div>

        <script>
        const REPORT_STORAGE_KEY = "${uniqueReportKey}";
        if (!localStorage.getItem(REPORT_STORAGE_KEY)) {
            localStorage.setItem(REPORT_STORAGE_KEY, JSON.stringify(${drawingsDataRaw}));
        }

        document.getElementById("scrollToTopBtn")?.addEventListener("click", () => {
            window.scrollTo({ top: 0, behavior: "smooth" });
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
        ${scopedAnalysisToolsCode}
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

        const fileName = `Wingo Offline Data ${mm}-${dd}-${yy} ${hours}-${minutes}-${seconds}.html`;

        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;

        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        URL.revokeObjectURL(url);
    }

    document.addEventListener("DOMContentLoaded", () => {
        const downloadBtn = document.getElementById("downloadBtn");
        if (downloadBtn) {
            downloadBtn.addEventListener("click", () => {
                triggerReportDownload(window.wingoGameData || []);
            });
        }
    });

    return {
        triggerReportDownload
    };
})();
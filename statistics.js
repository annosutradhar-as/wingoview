// ==========================================
// RIGHT & LEFT SIDEBAR STATISTICS ENGINE
// ==========================================

window.StatisticsModule = (function () {
    const getElements = () => ({
        periodDisplay: document.getElementById("periodDisplay"),
        roundReminder: document.getElementById("roundReminder"),
        trendDisplay: document.getElementById("trendDisplay"),
        currentStreakDisplay: document.getElementById("currentStreakDisplay"),
        maxStreakDisplay: document.getElementById("maxStreakDisplay"),
        colorTrendDisplay: document.getElementById("colorTrendDisplay"),
        colorCurrentStreakDisplay: document.getElementById("colorCurrentStreakDisplay"),
        colorMaxStreakDisplay: document.getElementById("colorMaxStreakDisplay"),
        pnValue: document.getElementById("pnValue"),
        pnResult: document.getElementById("pnResult"),
        fnValue: document.getElementById("fnValue"),
        fnResult: document.getElementById("fnResult"),
        l5nValue: document.getElementById("l5nValue"),
        l5nResult: document.getElementById("l5nResult"),
        row10Info: document.getElementById("row10Info") || document.getElementById("row10Number"),
        row10Prediction: document.getElementById("row10Prediction") || document.getElementById("row10Color"),
        statsAveragePrediction: document.getElementById("statsAveragePrediction")
    });

    function getBigSmall(row) {
        if (row && row.bigSmall) {
            const val = row.bigSmall.trim().toLowerCase();
            if (val === "big") return "Big";
            if (val === "small") return "Small";
        }
        const num = parseInt(row && row.number);
        if (!isNaN(num)) {
            return num >= 5 ? "Big" : "Small";
        }
        return null;
    }

    function parseColorInfo(row) {
        const raw = row && row.color ? String(row.color).toLowerCase() : "";
        let hasGreen = raw.includes("green");
        let hasRed = raw.includes("red");
        let hasViolet = raw.includes("violet");

        if (!hasGreen && !hasRed && !hasViolet) {
            const num = parseInt(row && row.number);
            if (!isNaN(num)) {
                if (num === 0) {
                    hasRed = true;
                    hasViolet = true;
                } else if (num === 5) {
                    hasGreen = true;
                    hasViolet = true;
                } else if ([1, 3, 7, 9].includes(num)) {
                    hasGreen = true;
                } else if ([2, 4, 6, 8].includes(num)) {
                    hasRed = true;
                }
            }
        }

        if (!hasGreen && !hasRed && !hasViolet) {
            return null;
        }

        return {
            hasGreen,
            hasRed,
            hasViolet
        };
    }

    function updateStatistics(gameData) {
        if (!gameData || gameData.length === 0) return;

        const els = getElements();

        // 1. Next Period Calculation
        if (els.periodDisplay) {
            const lastPeriod = String(gameData[gameData.length - 1].period).replace(/\D/g, "");
            if (lastPeriod) {
                try {
                    els.periodDisplay.innerText = (BigInt(lastPeriod) + 1n).toString();
                } catch (e) {}
            }
        }

        const currentNextPeriod = els.periodDisplay ? els.periodDisplay.innerText.trim() : "";

        // 2. Round Number Logic
        if (currentNextPeriod && currentNextPeriod !== "----") {
            let last3 = currentNextPeriod.slice(-3);
            let last2 = currentNextPeriod.slice(-2);
            let last1 = currentNextPeriod.slice(-1);

            const triples = ["000", "111", "222", "333", "444", "555", "666", "777", "888", "999"];

            if (triples.includes(last3)) {
                if (els.roundReminder) els.roundReminder.innerText = "Strong Round Number";
            } else if (last2 === "00") {
                if (els.roundReminder) els.roundReminder.innerText = "Medium Round Number";
            } else if (last1 === "0") {
                if (els.roundReminder) els.roundReminder.innerText = "Normal Round Number";
            } else {
                if (els.roundReminder) els.roundReminder.innerText = "None";
            }
        }

        // 3. Trend, Current Streak & Max Streak (Last 25 Rows - Big/Small)
        const reversedData = gameData.slice().reverse();
        const sampleRows = reversedData.slice(0, 25);

        let currentType = null;
        let currentStreakCount = 0;
        for (let i = 0; i < reversedData.length; i++) {
            const bs = getBigSmall(reversedData[i]);
            if (!bs) continue;
            if (currentType === null) {
                currentType = bs;
                currentStreakCount = 1;
            } else if (bs === currentType) {
                currentStreakCount++;
            } else {
                break;
            }
        }
        if (els.currentStreakDisplay) {
            els.currentStreakDisplay.innerText = currentType ? `${currentStreakCount} ${currentType}` : "-";
        }

        let maxBig = 0, maxSmall = 0;
        let tempBig = 0, tempSmall = 0;
        let totalBig = 0, totalSmall = 0;

        for (let i = 0; i < sampleRows.length; i++) {
            const bs = getBigSmall(sampleRows[i]);
            if (bs === "Big") {
                totalBig++;
                tempBig++;
                tempSmall = 0;
                if (tempBig > maxBig) maxBig = tempBig;
            } else if (bs === "Small") {
                totalSmall++;
                tempSmall++;
                tempBig = 0;
                if (tempSmall > maxSmall) maxSmall = tempSmall;
            }
        }

        if (els.maxStreakDisplay) {
            els.maxStreakDisplay.innerText = `${maxBig} Big || ${maxSmall} Small`;
        }

        let calculatedTrend = "-";
        if (totalBig > totalSmall) {
            calculatedTrend = "Big";
        } else if (totalSmall > totalBig) {
            calculatedTrend = "Small";
        } else {
            if (maxBig > maxSmall) {
                calculatedTrend = "Big";
            } else if (maxSmall > maxBig) {
                calculatedTrend = "Small";
            } else {
                calculatedTrend = currentType || "-";
            }
        }
        if (els.trendDisplay) {
            els.trendDisplay.innerText = calculatedTrend;
        }

        // 3B. Color Confirmation (Green, Red & Violet counted independently)
        let curGreen = 0, curRed = 0, curViolet = 0;
        let stopGreen = false, stopRed = false, stopViolet = false;

        for (let i = 0; i < reversedData.length; i++) {
            const info = parseColorInfo(reversedData[i]);
            if (!info) continue;

            if (!stopGreen) {
                if (info.hasGreen) curGreen++;
                else stopGreen = true;
            }
            if (!stopRed) {
                if (info.hasRed) curRed++;
                else stopRed = true;
            }
            if (!stopViolet) {
                if (info.hasViolet) curViolet++;
                else stopViolet = true;
            }

            if (stopGreen && stopRed && stopViolet) break;
        }

        if (els.colorCurrentStreakDisplay) {
            const activeStreaks = [];
            if (curGreen > 0) activeStreaks.push(`${curGreen} Green`);
            if (curRed > 0) activeStreaks.push(`${curRed} Red`);
            if (curViolet > 0) activeStreaks.push(`${curViolet} Violet`);
            els.colorCurrentStreakDisplay.innerText = activeStreaks.length > 0 ? activeStreaks.join(" || ") : "-";
        }

        let greenCount = 0, redCount = 0, violetCount = 0;
        let maxGreen = 0, maxRed = 0, maxViolet = 0;
        let tempGreen = 0, tempRed = 0, tempViolet = 0;

        for (let i = 0; i < sampleRows.length; i++) {
            const info = parseColorInfo(sampleRows[i]);
            if (!info) continue;

            if (info.hasGreen) {
                greenCount++;
                tempGreen++;
                if (tempGreen > maxGreen) maxGreen = tempGreen;
            } else {
                tempGreen = 0;
            }

            if (info.hasRed) {
                redCount++;
                tempRed++;
                if (tempRed > maxRed) maxRed = tempRed;
            } else {
                tempRed = 0;
            }

            if (info.hasViolet) {
                violetCount++;
                tempViolet++;
                if (tempViolet > maxViolet) maxViolet = tempViolet;
            } else {
                tempViolet = 0;
            }
        }

        if (els.colorMaxStreakDisplay) {
            els.colorMaxStreakDisplay.innerText = `${maxGreen} Green || ${maxRed} Red || ${maxViolet} Violet`;
        }

        if (els.colorTrendDisplay) {
            if (greenCount === 0 && redCount === 0 && violetCount === 0) {
                els.colorTrendDisplay.innerText = "-";
            } else if (greenCount >= redCount && greenCount >= violetCount) {
                els.colorTrendDisplay.innerText = "Green";
            } else if (redCount >= greenCount && redCount >= violetCount) {
                els.colorTrendDisplay.innerText = "Red";
            } else {
                els.colorTrendDisplay.innerText = "Violet";
            }
        }

        // Collect all right-sidebar Big/Small predictions for overall average
        const rightSidebarVotes = [];
        if (calculatedTrend === "Big" || calculatedTrend === "Small") {
            rightSidebarVotes.push(calculatedTrend);
        }

        // 4. PN Calculation
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

                const pnPred = (total >= 0 && total <= 4) ? "Small" : "Big";
                if (els.pnValue) els.pnValue.innerText = total;
                if (els.pnResult) els.pnResult.innerText = pnPred;
                rightSidebarVotes.push(pnPred);
            }
        }

        // 5. FN Calculation
        if (gameData.length >= 2) {
            let currentRow = gameData[gameData.length - 1];
            let belowRow = gameData[gameData.length - 2];

            let currentNum = parseInt(currentRow.number);
            let belowNum = parseInt(belowRow.number);

            if (!isNaN(currentNum) && !isNaN(belowNum)) {
                let adjustedCurrent = belowNum > currentNum ? currentNum + 10 : currentNum;
                let futureNum = adjustedCurrent - belowNum;

                if (futureNum >= 0 && futureNum <= 9) {
                    const fnPred = (futureNum >= 0 && futureNum <= 4) ? "Small" : "Big";
                    if (els.fnValue) els.fnValue.innerText = futureNum;
                    if (els.fnResult) els.fnResult.innerText = fnPred;
                    rightSidebarVotes.push(fnPred);
                } else {
                    if (els.fnValue) els.fnValue.innerText = "None";
                    if (els.fnResult) els.fnResult.innerText = "None";
                }
            } else {
                if (els.fnValue) els.fnValue.innerText = "None";
                if (els.fnResult) els.fnResult.innerText = "None";
            }
        } else {
            if (els.fnValue) els.fnValue.innerText = "None";
            if (els.fnResult) els.fnResult.innerText = "None";
        }

        // 6. L5S Calculation
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
            const l5nPred = (singleDigit >= 0 && singleDigit <= 4) ? "Small" : "Big";
            if (els.l5nValue) els.l5nValue.innerText = singleDigit;
            if (els.l5nResult) els.l5nResult.innerText = l5nPred;
            rightSidebarVotes.push(l5nPred);
        }

        // 7. Last Reappear (10th Row Info)
        if (reversedData.length >= 10) {
            let row10 = reversedData[9];
            let num = row10.number !== undefined ? row10.number : "-";
            let bs = row10.bigSmall || "-";
            let color = row10.color || "-";

            if (els.row10Info) {
                els.row10Info.innerText = `${num}, ${bs}, ${color}`;
            }

            if (els.row10Prediction) {
                els.row10Prediction.innerText = bs;
            }

            const normalizedRow10Bs = getBigSmall(row10);
            if (normalizedRow10Bs) {
                rightSidebarVotes.push(normalizedRow10Bs);
            }
        } else {
            if (els.row10Info) els.row10Info.innerText = "-";
            if (els.row10Prediction) els.row10Prediction.innerText = "-";
        }

        // 8. Left Sidebar: Statistics Overview Average
        if (els.statsAveragePrediction) {
            const totalBigPred = rightSidebarVotes.filter(v => v === "Big").length;
            const totalSmallPred = rightSidebarVotes.filter(v => v === "Small").length;
            if (totalBigPred === 0 && totalSmallPred === 0) {
                els.statsAveragePrediction.innerText = "-";
            } else if (totalBigPred > totalSmallPred) {
                els.statsAveragePrediction.innerText = `Big (${totalBigPred}/${rightSidebarVotes.length})`;
            } else if (totalSmallPred > totalBigPred) {
                els.statsAveragePrediction.innerText = `Small (${totalSmallPred}/${rightSidebarVotes.length})`;
            } else {
                els.statsAveragePrediction.innerText = `Equal (${totalBigPred}B / ${totalSmallPred}S)`;
            }
        }
    }

    return {
        updateStatistics
    };
})();
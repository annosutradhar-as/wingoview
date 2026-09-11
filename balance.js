// Balance.js - Dynamic Result Handling with Pending/Waiting Trades Execution

(function () {
    let isDemoMode = localStorage.getItem('isDemoMode') === 'true';
    let demoBalance = parseFloat(localStorage.getItem('demoBalance'));
    if (isNaN(demoBalance)) demoBalance = 1000.00;

    let tradesHistory = [];
    try {
        tradesHistory = JSON.parse(localStorage.getItem('tradesHistory')) || [];
    } catch (e) {
        tradesHistory = [];
    }
    
    let realBalanceText = "৳0.00";
    let activeActionType = null;

    // Elements
    const balanceDisplayBtn = document.getElementById('balanceDisplayBtn');
    const depositBtn = document.getElementById('depositBtn');
    const withdrawBtn = document.getElementById('withdrawBtn');
    
    const tradePeriodInput = document.getElementById('tradePeriodInput');
    const tradeSelectOption = document.getElementById('tradeSelectOption');
    const tradeAmountInput = document.getElementById('tradeAmountInput');
    const executeTradeBtn = document.getElementById('executeTradeBtn');
    
    const tradeHistoryList = document.getElementById('tradeHistoryList');
    const totalTradesElem = document.getElementById('totalTradesCount');
    const totalProfitElem = document.getElementById('totalProfitCount');
    const totalLoseElem = document.getElementById('totalLoseCount');
    const clearAllTradesBtn = document.getElementById('clearAllTradesBtn');

    // Popover Elements
    const inlinePopover = document.getElementById('inlinePopover');
    const popoverAmountInput = document.getElementById('popoverAmountInput');
    const popoverSubmitBtn = document.getElementById('popoverSubmitBtn');
    const closePopoverBtn = document.getElementById('closePopoverBtn');

    // Prevent Keydown Propagation
    document.querySelectorAll('.allow-typing, #popoverAmountInput').forEach(input => {
        ['keydown', 'keyup', 'keypress'].forEach(evt => {
            input.addEventListener(evt, (e) => e.stopPropagation());
        });
    });

    function saveData() {
        localStorage.setItem('isDemoMode', isDemoMode);
        localStorage.setItem('demoBalance', demoBalance);
        localStorage.setItem('tradesHistory', JSON.stringify(tradesHistory));
    }

    function syncMainBalanceFromDOM() {
        if (!isDemoMode) {
            const mainBalElem = document.querySelector('.Wallet__C-balance-l1 div');
            if (mainBalElem) {
                realBalanceText = mainBalElem.innerText.trim();
                balanceDisplayBtn.innerText = realBalanceText;
            }
        }
    }
    setInterval(syncMainBalanceFromDOM, 800);

    function updateBalanceUI() {
        if (isDemoMode) {
            balanceDisplayBtn.innerText = `৳${demoBalance.toFixed(2)}`;
            balanceDisplayBtn.title = "Demo Balance";
            balanceDisplayBtn.classList.add("demo-active");
        } else {
            balanceDisplayBtn.innerText = realBalanceText;
            balanceDisplayBtn.title = "Main Balance";
            balanceDisplayBtn.classList.remove("demo-active");
        }
        saveData();
    }

    balanceDisplayBtn.addEventListener('click', () => {
        isDemoMode = !isDemoMode;
        updateBalanceUI();
    });

    // Popover Controls
    function showPopover(btn, type) {
        activeActionType = type;
        
        if (type === 'deposit') {
            popoverAmountInput.value = demoBalance.toFixed(2);
        } else {
            popoverAmountInput.value = '';
        }

        inlinePopover.classList.remove('hidden');
        
        const btnRect = btn.getBoundingClientRect();
        const widgetRect = document.getElementById('demoBalanceWidget').getBoundingClientRect();
        const leftOffset = btnRect.left - widgetRect.left;
        inlinePopover.style.left = `${Math.max(5, leftOffset - 10)}px`;

        if (type === 'withdraw') {
            inlinePopover.style.marginLeft = '-63px';
        } else {
            inlinePopover.style.marginLeft = '0px';
        }
    }

    function hidePopover() {
        inlinePopover.classList.add('hidden');
    }

    depositBtn.addEventListener('click', () => showPopover(depositBtn, 'deposit'));
    withdrawBtn.addEventListener('click', () => showPopover(withdrawBtn, 'withdraw'));
    closePopoverBtn.addEventListener('click', hidePopover);

    popoverSubmitBtn.addEventListener('click', () => {
        const val = parseFloat(popoverAmountInput.value);
        if (!isNaN(val) && val >= 0) {
            if (activeActionType === 'deposit') {
                if (!isDemoMode) isDemoMode = true;
                demoBalance = val;
            } else if (activeActionType === 'withdraw') {
                if (isDemoMode && val <= demoBalance) {
                    demoBalance -= val;
                }
            }
            updateBalanceUI();
            hidePopover();
        }
    });

    // --- Accurate Row Data Extractor ---
    function getRowGameData(row) {
        if (!row) return { number: null, bigSmall: null, color: null };

        const number = row.cells[1] ? row.cells[1].innerText.trim() : "";
        const bigSmall = row.cells[2] ? row.cells[2].innerText.trim() : "";
        
        let color = "";
        const numVal = parseInt(number);
        
        if (!isNaN(numVal)) {
            if ([1, 3, 7, 9].includes(numVal)) color = "Green";
            else if ([2, 4, 6, 8].includes(numVal)) color = "Red";
            else if (numVal === 0) color = "Red"; 
            else if (numVal === 5) color = "Green"; 
        }

        if (row.cells[3]) {
            const cellHtml = row.cells[3].innerHTML.toLowerCase();
            if (cellHtml.includes('red') || cellHtml.includes('rgb(220') || cellHtml.includes('rgb(255')) color = "Red";
            else if (cellHtml.includes('green') || cellHtml.includes('rgb(40') || cellHtml.includes('rgb(38')) color = "Green";
        }

        return { number, bigSmall, color };
    }

    // Check Win/Loss
    function checkTradeResult(gameData, selected) {
        if (selected === gameData.bigSmall) return true;
        if (selected === gameData.color) return true;
        if (selected === gameData.number) return true;
        return false;
    }

    // Get Result Label for List
    function calculateResultText(gameData, selected, isWin) {
        if (isWin) return selected;

        if (selected === "Big") return "Small";
        if (selected === "Small") return "Big";
        if (selected === "Green") return "Red";
        if (selected === "Red") return "Green";
        
        return gameData.number || "Loss";
    }

    function findTableRowByPeriod(period) {
        const rows = document.querySelectorAll('#fullTableBody tr');
        for (let row of rows) {
            const txt = row.cells[0] ? row.cells[0].innerText.replace(/[^0-9]/g, '') : '';
            if (txt && (txt.endsWith(period) || period.endsWith(txt))) return row;
        }
        return null;
    }

    // --- Processing Pending/Waiting Trades ---
    function processPendingTrades() {
        let hasChanges = false;

        tradesHistory.forEach(item => {
            if (item.status === 'pending') {
                const targetRow = findTableRowByPeriod(item.period);
                
                if (targetRow) {
                    const gameData = getRowGameData(targetRow);
                    
                    // যদি ডেটা খালি না থাকে তবে রেজাল্ট ক্যালকুলেট করা হবে
                    if (gameData.number !== "" || gameData.bigSmall !== "") {
                        const isWin = checkTradeResult(gameData, item.selected);
                        const changeAmount = isWin ? (item.tradeAmount * 0.96) : -item.tradeAmount;
                        const actualResult = calculateResultText(gameData, item.selected, isWin);

                        item.status = 'completed';
                        item.isWin = isWin;
                        item.amount = parseFloat(changeAmount.toFixed(2));
                        item.result = actualResult;

                        // ডেমো মোডে থাকলে ব্যালেন্স রিয়েলটাইমে আপডেট হবে
                        if (isDemoMode) {
                            demoBalance += changeAmount;
                        }

                        hasChanges = true;
                    }
                }
            }
        });

        if (hasChanges) {
            updateBalanceUI();
            renderTradeList();
            updateStats();
            saveData();
        }
    }

    // পর্যায়ক্রমিকভাবে (প্রতি ১ সেকেন্ড পর পর) পেন্ডিং ট্রেড চেক করবে
    setInterval(processPendingTrades, 1000);

    // Trade Execution Engine
    executeTradeBtn.addEventListener('click', () => {
        const period = tradePeriodInput.value.trim();
        const selectedValue = tradeSelectOption.value;
        const tradeAmount = parseFloat(tradeAmountInput.value) || 10;

        if (!period || !selectedValue) return;

        const exists = tradesHistory.some(item => item.period === period && item.selected === selectedValue);
        if (exists) return;

        const targetRow = findTableRowByPeriod(period);
        
        let tradeItem;

        if (targetRow) {
            // ডেটা রো ইতিমধ্যেই পেজে উপস্থিত
            const gameData = getRowGameData(targetRow);
            const isWin = checkTradeResult(gameData, selectedValue);
            const changeAmount = isWin ? (tradeAmount * 0.96) : -tradeAmount;
            const actualResult = calculateResultText(gameData, selectedValue, isWin);

            tradeItem = {
                id: Date.now(),
                period: period,
                selected: selectedValue,
                result: actualResult,
                amount: parseFloat(changeAmount.toFixed(2)),
                tradeAmount: tradeAmount,
                isWin: isWin,
                status: 'completed'
            };

            if (isDemoMode) {
                demoBalance += changeAmount;
            }
        } else {
            // ফিউচার ডেটা রো, তাই "Waiting for Result" অবস্থায় থাকবে
            tradeItem = {
                id: Date.now(),
                period: period,
                selected: selectedValue,
                result: "Waiting...",
                amount: 0,
                tradeAmount: tradeAmount,
                isWin: false,
                status: 'pending'
            };
        }

        tradesHistory.unshift(tradeItem);

        updateBalanceUI();
        renderTradeList();
        updateStats();
        saveData();
    });

    function removeTradeItem(id) {
        const targetIndex = tradesHistory.findIndex(item => item.id === id);
        if (targetIndex !== -1) {
            const item = tradesHistory[targetIndex];

            // ট্রেড কমপ্লিট হয়ে থাকলে ব্যালেন্স থেকে লাভ/ক্ষতির অ্যামাউন্ট অ্যাডজাস্ট হবে
            if (isDemoMode && item.status === 'completed') {
                demoBalance -= item.amount;
                updateBalanceUI();
            }

            tradesHistory.splice(targetIndex, 1);
            
            renderTradeList();
            updateStats();
            saveData();
        }
    }

    clearAllTradesBtn.addEventListener('click', () => {
        if (confirm("Remove Balance & Trade History?")) {
            tradesHistory = [];
            demoBalance = 1000.00;
            updateBalanceUI();
            renderTradeList();
            updateStats();
            saveData();
        }
    });

    tradeHistoryList.addEventListener('click', function(e) {
        if (e.target && e.target.classList.contains('remove-btn')) {
            const itemId = parseInt(e.target.getAttribute('data-id'));
            if (!isNaN(itemId)) {
                removeTradeItem(itemId);
            }
        }
    });

    function renderTradeList() {
        tradeHistoryList.innerHTML = '';
        tradesHistory.forEach((item) => {
            const li = document.createElement('li');
            li.className = 'trade-item-row';
            
            let amtText = "0.00";
            let amtClass = "";
            let hoverText = "Waiting for Result";
            let badgeText = "W";
            let badgeBg = "style='background: #f59e0b; color: #fff; padding: 2px 3px; border-radius: 50%; color: white; font-size: 9px; font-weight: bold;'"; // ⏳ পেন্ডিং থাকলে অরেঞ্জ ব্যাজ দেখাবে

            if (item.status === 'pending') {
                amtText = "";
                amtClass = "pending-val";
            } else {
                amtText = item.amount > 0 ? `+${item.amount}` : `${item.amount}`;
                amtClass = item.amount > 0 ? 'profit-val' : 'loss-val';
                hoverText = item.amount > 0 ? `+${item.amount} = Profit` : `${item.amount} = Lose`;
                badgeText = item.isWin ? 'P' : 'L';
                badgeBg = item.isWin ? 'class="pl-hover-badge p-bg"' : 'class="pl-hover-badge l-bg"';
            }
            
            li.innerHTML = `
                <span class="col-period">#${item.period.slice(-4)}</span>
                <span class="col-entry">${item.selected}</span>
                <span class="col-result" style="${item.status === 'pending' ? 'color:#f59e0b; font-size:11px;' : ''}">${item.result}</span>
                <div class="col-pl">
                    <span class="${amtClass}">${amtText}</span>
                    <span ${item.status === 'pending' ? badgeBg : badgeBg} title="${hoverText}">
                        ${badgeText}
                    </span>
                    <span class="remove-btn" data-id="${item.id}">&times;</span>
                </div>
            `;
            tradeHistoryList.appendChild(li);
        });
    }

    function updateStats() {
        // শুধুমাত্র কমপ্লিট হওয়া ট্রেডগুলো হিসাব করবে
        const completedTrades = tradesHistory.filter(i => i.status === 'completed');
        totalTradesElem.innerText = completedTrades.length;
        
        const profitCount = completedTrades.filter(i => i.isWin).length;
        totalProfitElem.innerText = profitCount;
        totalLoseElem.innerText = completedTrades.length - profitCount;
    }

    syncMainBalanceFromDOM();
    updateBalanceUI();
    renderTradeList();
    updateStats();
})();
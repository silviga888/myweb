// ==================== 配置 ====================
// 修改 REFRESH_INTERVAL 可调整刷新频率：30000 = 30秒，60000 = 60秒
const CONFIG = {
    REFRESH_INTERVAL: 30000,
    METALS: [
        { code: 'XAU', name: '黄金', symbol: 'XAU/USD', icon: '🥇', class: 'gold', basePrice: 2345.67 },
        { code: 'XAG', name: '白银', symbol: 'XAG/USD', icon: '🥈', class: 'silver', basePrice: 28.45 },
        { code: 'XPT', name: '铂金', symbol: 'XPT/USD', icon: '💎', class: 'platinum', basePrice: 1012.30 },
        { code: 'XPD', name: '钯金', symbol: 'XPD/USD', icon: '🔶', class: 'palladium', basePrice: 956.80 }
    ],
    KARATS: [
        { label: '24K', purity: '99.9%', factor: 1.0 },
        { label: '22K', purity: '91.6%', factor: 0.916 },
        { label: '21K', purity: '87.5%', factor: 0.875 },
        { label: '20K', purity: '83.3%', factor: 0.833 },
        { label: '18K', purity: '75.0%', factor: 0.75 },
        { label: '16K', purity: '66.7%', factor: 0.667 },
        { label: '14K', purity: '58.3%', factor: 0.583 },
        { label: '10K', purity: '41.7%', factor: 0.417 }
    ],
    FOREX_RATES: {
        'USD/EUR': 0.9234,
        'USD/GBP': 0.7891,
        'USD/JPY': 151.23,
        'USD/CNY': 7.2345,
        'USD/INR': 83.45,
        'USD/AUD': 1.5234,
        'USD/CAD': 1.3567,
        'USD/CHF': 0.9012
    },
    CNY_RATE: 7.2345  // 美元兑人民币汇率，用于估算人民币金价
};

// ==================== 状态 ====================
let state = {
    data: {},
    lastFetch: null,
    timer: null,
    prevPrices: {},
    isFirstLoad: true
};

// ==================== 工具函数 ====================
const $ = (id) => document.getElementById(id);

const formatPrice = (price, decimals = 2) => {
    if (price === undefined || price === null) return '--';
    return price.toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    });
};

const showToast = (msg, type = 'success') => {
    const el = type === 'success' ? $('successToast') : $('errorToast');
    el.textContent = msg;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 2500);
};

// 基于时间种子的伪随机，保证同一秒内波动一致但随时间变化
function seededRandom(seed) {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
}

// ==================== 模拟数据生成 ====================
function generateMockData() {
    const now = Date.now();
    const seed = Math.floor(now / 1000);
    const data = {};

    CONFIG.METALS.forEach(metal => {
        const r1 = seededRandom(seed + metal.basePrice);
        const r2 = seededRandom(seed + metal.basePrice * 2);
        const r3 = seededRandom(seed + metal.basePrice * 3);

        // 价格波动 ±0.25%
        const fluctuation = (r1 - 0.5) * 0.005;
        const price = metal.basePrice * (1 + fluctuation);

        // 计算涨跌（对比上一秒基准）
        const prevSeed = seed - 1;
        const prevR = seededRandom(prevSeed + metal.basePrice);
        const prevFluctuation = (prevR - 0.5) * 0.005;
        const prevPrice = metal.basePrice * (1 + prevFluctuation);

        const ch = price - prevPrice;
        const chp = (ch / prevPrice) * 100;

        // 买卖价差约 0.05%
        const spread = price * 0.0005;

        // 日内高低
        const highOffset = Math.abs(r2) * 0.003;
        const lowOffset = Math.abs(r3) * 0.003;

        const gramPrice = price / 31.1035; // 1盎司 = 31.1035克

        data[metal.code] = {
            price: price,
            ch: ch,
            chp: chp,
            bid: price - spread,
            ask: price + spread,
            open_price: prevPrice,
            high_price: price * (1 + highOffset),
            low_price: price * (1 - lowOffset),
            gramPrice: gramPrice,
            exchange_rates: CONFIG.FOREX_RATES
        };
    });

    return data;
}

// ==================== 数据获取（模拟） ====================
async function fetchAllData() {
    const btn = $('refreshBtn');
    btn.classList.add('spinning');

    // 模拟网络延迟 300-700ms
    await new Promise(r => setTimeout(r, 300 + Math.random() * 400));

    // 检测价格变化用于行闪烁动画
    CONFIG.METALS.forEach(m => {
        const newData = generateMockData();
        const newPrice = newData[m.code]?.price;
        const oldPrice = state.data[m.code]?.price;
        if (oldPrice && newPrice !== undefined && Math.abs(newPrice - oldPrice) > 0.001) {
            state.prevPrices[m.code] = { up: newPrice > oldPrice };
        }
    });

    state.data = generateMockData();
    state.lastFetch = Date.now();

    renderAll();

    if (!state.isFirstLoad) {
        showToast('数据已更新 · ' + new Date().toLocaleTimeString('zh-CN'));
    }
    state.isFirstLoad = false;

    btn.classList.remove('spinning');
    $('loadingOverlay').classList.add('hidden');
}

// ==================== 渲染 ====================
function renderAll() {
    renderMainTable();
    renderKaratTable();
    renderForexTable();
    updateStatus();
}

function renderMainTable() {
    const tbody = $('mainTableBody');

    tbody.innerHTML = CONFIG.METALS.map(metal => {
        const data = state.data[metal.code];
        if (!data) return '';

        const price = data.price;
        const ch = data.ch;
        const chp = data.chp;
        const isUp = ch > 0;
        const isDown = ch < 0;
        const changeClass = isUp ? 'up' : isDown ? 'down' : 'neutral';
        const arrow = isUp ? '▲' : isDown ? '▼' : '—';
        const flashClass = state.prevPrices[metal.code]
            ? (state.prevPrices[metal.code].up ? 'flash-up' : 'flash-down')
            : '';

        return `
            <tr class="${flashClass}" data-code="${metal.code}">
                <td>
                    <div class="metal-cell">
                        <div class="metal-icon ${metal.class}">${metal.icon}</div>
                        <div class="metal-name">
                            <span class="name">${metal.name}</span>
                            <span class="symbol">${metal.symbol}</span>
                        </div>
                    </div>
                </td>
                <td><span class="price-value">$${formatPrice(price)}</span></td>
                <td>
                    <span class="change-badge ${changeClass}">
                        ${arrow} ${formatPrice(Math.abs(ch))}
                    </span>
                </td>
                <td>
                    <span class="change-badge ${changeClass}">
                        ${arrow} ${Math.abs(chp).toFixed(2)}%
                    </span>
                </td>
                <td><span class="price-value">$${formatPrice(data.bid)}</span></td>
                <td><span class="price-value">$${formatPrice(data.ask)}</span></td>
                <td><span class="price-value">$${formatPrice(data.open_price)}</span></td>
                <td><span class="price-value">$${formatPrice(data.high_price)}</span></td>
                <td><span class="price-value">$${formatPrice(data.low_price)}</span></td>
            </tr>
        `;
    }).join('');

    state.prevPrices = {};
}

function renderKaratTable() {
    const tbody = $('karatTableBody');
    const goldData = state.data['XAU'];

    if (!goldData) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-secondary);padding:2rem;">加载中...</td></tr>';
        return;
    }

    const gramPrice = goldData.gramPrice;

    tbody.innerHTML = CONFIG.KARATS.map(karat => {
        const usdPrice = gramPrice * karat.factor;
        const cnyPrice = usdPrice * CONFIG.CNY_RATE;
        return `
            <tr>
                <td><span class="karat-label">${karat.label}</span></td>
                <td><span class="karat-purity">${karat.purity}</span></td>
                <td><span class="price-gold">$${formatPrice(usdPrice)}</span></td>
                <td><span class="price-cny">¥${formatPrice(cnyPrice)}</span></td>
            </tr>
        `;
    }).join('');
}

function renderForexTable() {
    const tbody = $('forexTableBody');
    const goldData = state.data['XAU'];

    if (!goldData || !goldData.exchange_rates) {
        tbody.innerHTML = '<tr><td colspan="2" style="text-align:center;color:var(--text-secondary);padding:2rem;">加载中...</td></tr>';
        return;
    }

    const rates = goldData.exchange_rates;

    tbody.innerHTML = Object.entries(rates).map(([pair, rate]) => `
        <tr>
            <td><span class="forex-pair">${pair}</span></td>
            <td><span class="forex-rate">${rate.toFixed(4)}</span></td>
        </tr>
    `).join('');
}

function updateStatus() {
    const timeStr = state.lastFetch
        ? new Date(state.lastFetch).toLocaleTimeString('zh-CN')
        : '--:--:--';
    $('lastUpdate').innerHTML = `<span>更新于: ${timeStr}</span>`;
}

// ==================== 交互控制 ====================
function manualRefresh() {
    fetchAllData();
}

function startAutoRefresh() {
    if (state.timer) clearInterval(state.timer);
    state.timer = setInterval(() => {
        fetchAllData();
    }, CONFIG.REFRESH_INTERVAL);
}

// ==================== 初始化 ====================
async function init() {
    await fetchAllData();
    startAutoRefresh();

    // 页面可见性变化时智能处理：隐藏暂停，显示恢复
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            if (state.timer) clearInterval(state.timer);
        } else {
            fetchAllData();
            startAutoRefresh();
        }
    });
}

// 启动应用
init();
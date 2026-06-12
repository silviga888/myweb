// ==================== 配置 ====================
const CONFIG = {
    REFRESH_INTERVAL: 60000,
    OZ_TO_G: 31.1035,
    METALS: [
        { code: 'XAU', name: '黄金', symbol: 'XAU/USD', class: 'gold', basePrice: 2345.67 },
        { code: 'XAG', name: '白银', symbol: 'XAG/USD', class: 'silver', basePrice: 28.45 },
        { code: 'XPT', name: '铂金', symbol: 'XPT/USD', class: 'platinum', basePrice: 1012.30 },
        { code: 'XPD', name: '钯金', symbol: 'XPD/USD', class: 'palladium', basePrice: 956.80 }
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
    CNY_RATE: 7.2345
};

// ==================== 状态 ====================
let state = {
    data: {},
    lastFetch: null,
    timer: null,
    prevPrices: {},
    isFirstLoad: true,
    currentUnit: 'USD_OZ',
    exchangeRate: null,
    forexRates: null
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

function seededRandom(seed) {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
}

// ==================== 实时汇率获取 ====================
async function fetchExchangeRate() {
    try {
        const res = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
        if (!res.ok) throw new Error('汇率API请求失败');
        const json = await res.json();
        const rates = json.rates;

        state.exchangeRate = rates.CNY || CONFIG.CNY_RATE;
        state.forexRates = {
            'USD/EUR': rates.EUR || CONFIG.FOREX_RATES['USD/EUR'],
            'USD/GBP': rates.GBP || CONFIG.FOREX_RATES['USD/GBP'],
            'USD/JPY': rates.JPY || CONFIG.FOREX_RATES['USD/JPY'],
            'USD/CNY': rates.CNY || CONFIG.FOREX_RATES['USD/CNY'],
            'USD/INR': rates.INR || CONFIG.FOREX_RATES['USD/INR'],
            'USD/AUD': rates.AUD || CONFIG.FOREX_RATES['USD/AUD'],
            'USD/CAD': rates.CAD || CONFIG.FOREX_RATES['USD/CAD'],
            'USD/CHF': rates.CHF || CONFIG.FOREX_RATES['USD/CHF']
        };
    } catch (err) {
        console.error('获取实时汇率失败，使用备用汇率:', err);
        state.exchangeRate = CONFIG.CNY_RATE;
        state.forexRates = { ...CONFIG.FOREX_RATES };
    }
}

// ==================== 单位换算与切换 ====================
function convertValue(val) {
    if (state.currentUnit === 'USD_OZ') return val;
    if (!state.exchangeRate) return val;
    return val * state.exchangeRate / CONFIG.OZ_TO_G;
}

function toggleUnit() {
    state.currentUnit = state.currentUnit === 'USD_OZ' ? 'CNY_G' : 'USD_OZ';
    $('unitBtn').textContent = state.currentUnit === 'USD_OZ' ? '单位：美元/盎司' : '单位：人民币/克';
    updateUnitHeaders();
    renderAll();
    showToast(`已切换至：${state.currentUnit === 'USD_OZ' ? '美元/盎司' : '人民币/克'}`);
}

function updateUnitHeaders() {
    const isUSD = state.currentUnit === 'USD_OZ';
    const unitText = isUSD ? '美元/盎司' : '人民币/克';
    const unitShort = isUSD ? '美元' : '人民币';

    $('thPrice').innerHTML = `最新价`;
    $('thChange').innerHTML = `涨跌额`;
    $('thBid').innerHTML = `买入价`;
    $('thAsk').innerHTML = `卖出价`;
    $('thOpen').innerHTML = `开盘价`;
    $('thHigh').innerHTML = `最高价`;
    $('thLow').innerHTML = `最低价`;
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

        const fluctuation = (r1 - 0.5) * 0.005;
        const price = metal.basePrice * (1 + fluctuation);

        const prevSeed = seed - 1;
        const prevR = seededRandom(prevSeed + metal.basePrice);
        const prevFluctuation = (prevR - 0.5) * 0.005;
        const prevPrice = metal.basePrice * (1 + prevFluctuation);

        const ch = price - prevPrice;
        const chp = (ch / prevPrice) * 100;
        const spread = price * 0.0005;
        const highOffset = Math.abs(r2) * 0.003;
        const lowOffset = Math.abs(r3) * 0.003;
        const gramPrice = price / 31.1035;

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
            exchange_rates: state.forexRates || CONFIG.FOREX_RATES
        };
    });

    return data;
}

// ==================== 数据获取 ====================
async function fetchAllData() {
    const btn = $('refreshBtn');
    btn.classList.add('spinning');

    await new Promise(r => setTimeout(r, 300 + Math.random() * 400));

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
    const isCNY = state.currentUnit === 'CNY_G';
    const symbol = isCNY ? '¥' : '$';
    const decimals = 2;

    tbody.innerHTML = CONFIG.METALS.map(metal => {
        const data = state.data[metal.code];
        if (!data) return '';

        const price = convertValue(data.price);
        const ch = convertValue(data.ch);
        const chp = data.chp;
        const bid = convertValue(data.bid);
        const ask = convertValue(data.ask);
        const open = convertValue(data.open_price);
        const high = convertValue(data.high_price);
        const low = convertValue(data.low_price);

        const isUp = ch > 0;
        const isDown = ch < 0;
        const changeClass = isUp ? 'up' : isDown ? 'down' : 'neutral';
        const arrow = isUp ? '▲' : isDown ? '▼' : '—';
        const flashClass = state.prevPrices[metal.code]
            ? (state.prevPrices[metal.code].up ? 'flash-up' : 'flash-down')
            : '';

        const displaySymbol = isCNY ? metal.symbol.replace('/USD', '/CNY') : metal.symbol;

        return `
            <tr class="${flashClass}" data-code="${metal.code}">
                <td>
                    <div class="metal-cell">
                        <div class="metal-name">
                            <span class="name">${metal.name}</span>
                            <span class="symbol">${displaySymbol}</span>
                        </div>
                    </div>
                </td>
                <td><span class="price-value">${symbol}${formatPrice(price, decimals)}</span></td>
                <td>
                    <span class="change-badge ${changeClass}">
                        ${arrow} ${formatPrice(Math.abs(ch), decimals)}
                    </span>
                </td>
                <td>
                    <span class="change-badge ${changeClass}">
                        ${arrow} ${Math.abs(chp).toFixed(2)}%
                    </span>
                </td>
                <td><span class="price-value">${symbol}${formatPrice(bid, decimals)}</span></td>
                <td><span class="price-value">${symbol}${formatPrice(ask, decimals)}</span></td>
                <td><span class="price-value">${symbol}${formatPrice(open, decimals)}</span></td>
                <td><span class="price-value">${symbol}${formatPrice(high, decimals)}</span></td>
                <td><span class="price-value">${symbol}${formatPrice(low, decimals)}</span></td>
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
    const cnyRate = state.exchangeRate || CONFIG.CNY_RATE;

    tbody.innerHTML = CONFIG.KARATS.map(karat => {
        const usdPrice = gramPrice * karat.factor;
        const cnyPrice = usdPrice * cnyRate;
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
    const rates = state.forexRates || CONFIG.FOREX_RATES;

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
    await fetchExchangeRate();
    await fetchAllData();
    startAutoRefresh();

    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            if (state.timer) clearInterval(state.timer);
        } else {
            fetchAllData();
            startAutoRefresh();
        }
    });
}

init();
// Configuration
const API_BASE = window.location.origin;
const REFRESH_INTERVAL = 10000; // 10 secondes
const ANIMATION_DURATION = 500;

// État global
let lastPrices = {};
let isConnected = false;
let refreshIntervalMs = null; // durée en ms entre deux rafraîchissements
let refreshIntervalId = null; // handle de setInterval pour le fetch auto
let sortMode = localStorage.getItem('sort-mode') || 'price'; // Mode de tri: 'price' ou 'alphabetical'
let chartColorBalance = 0; // Pour équilibrer rouge/vert : positif = plus de verts, négatif = plus de rouges

// Fonction pour vérifier si on est en mode transaction immédiate (timer = 0)
function isImmediateMode() {
    return refreshIntervalMs === 0;
}

// Fonction pour nettoyer les anciennes animations avant d'en ajouter de nouvelles
function clearPreviousAnimations() {
    document.querySelectorAll('.price-change').forEach(el => el.classList.remove('price-change'));
    document.querySelectorAll('.price-flash').forEach(el => el.classList.remove('price-flash'));
}

// Fonction pour trier les boissons selon le mode choisi
function getSortedDrinks(drinks) {
    const sortedDrinks = [...drinks];
    
    if (sortMode === 'alphabetical') {
        sortedDrinks.sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    } else {
        sortedDrinks.sort((a, b) => b.price - a.price);
    }
    
    return sortedDrinks;
}

// Fonction pour basculer le mode de tri
function toggleSortMode() {
    const currentMode = sortMode;
    sortMode = sortMode === 'price' ? 'alphabetical' : 'price';
    
    localStorage.setItem('sort-mode', sortMode);
    
    localStorage.setItem('sort-toggle-signal', Date.now().toString());
    
    const toggleButton = document.getElementById('sort-type-toggle');
    if (toggleButton) {
        const label = toggleButton.querySelector('span');
        if (label) {
            label.textContent = sortMode === 'price' ? 'Prix' : 'A-Z';
        }
        
        toggleButton.setAttribute('data-sort-mode', sortMode);
    }
    
    if (lastDrinksData && lastDrinksData.length > 0) {
        const sortedDrinks = getSortedDrinks(lastDrinksData);
        reorderStockTiles(sortedDrinks);
    }
}

let timerIntervalId = null;   // handle de setInterval pour le compteur 1s
let wallStreetCharts = null;
let currentChartType = localStorage.getItem('chart-type') || 'candlestick'; // Type de graphique actuel
let activeDrinks = new Set(); // Set des drink_id qui ont été achetés et dont les graphiques doivent être mis à jour
let isInitialLoad = true; // Flag pour savoir si c'est le premier chargement
let previousPrices = {}; // Pour stocker les prix précédents et détecter les vrais changements
let lastDrinksData = []; // Pour stocker les dernières données des boissons pour le re-tri

// Couleurs distinctes pour chaque boisson
const drinkColors = [
    '#FF6B6B', // Rouge corail
    '#4ECDC4', // Turquoise
    '#45B7D1', // Bleu ciel
    '#96CEB4', // Vert menthe
    '#FFEAA7', // Jaune doré
    '#DDA0DD', // Prune
    '#98D8C8', // Vert d'eau
    '#F7DC6F', // Jaune citron
    '#BB8FCE', // Violet pastel
    '#85C1E9', // Bleu clair
    '#F8C471', // Orange pêche
    '#82E0AA', // Vert clair
    '#F1948A', // Rouge saumon
    '#85D1E8'  // Bleu pastel
];

// Mapping pour stocker l'historique de prix de chaque boisson (pour les mini-courbes)
const drinkPriceHistory = new Map();

// Mapping des boissons vers leurs couleurs
const drinkColorMap = new Map();

// Fonction de nettoyage du cache pour éviter l'accumulation pendant la soirée
function cleanupCache() {
    // Nettoyer l'historique des prix pour éviter l'accumulation infinie
    drinkPriceHistory.forEach((history, drinkId) => {
        if (Array.isArray(history)) {
            // Limiter à 5 points maximum pour les mini-charts
            if (history.length > 5) {
                const recent = history.slice(-5);
                drinkPriceHistory.set(drinkId, recent);
            }
        }
    });
    
    // Nettoyer les prix précédents 
    const currentDrinks = new Set();
    if (lastDrinksData && lastDrinksData.length > 0) {
        lastDrinksData.forEach(drink => currentDrinks.add(drink.id));
    }
    
    // Supprimer les données des boissons qui n'existent plus
    Object.keys(previousPrices).forEach(id => {
        if (!currentDrinks.has(parseInt(id))) {
            delete previousPrices[id];
            delete lastPrices[id];
            drinkPriceHistory.delete(parseInt(id));
            drinkColorMap.delete(parseInt(id));
        }
    });
    
    console.log('Cache nettoyé pour éviter les lags');
}

// Nettoyer le cache toutes les 5 minutes pendant la soirée
setInterval(cleanupCache, 5 * 60 * 1000);

// Fonction pour générer une mini-courbe SVG
function generateMiniChart(drinkId, currentPrice) {
    // Initialiser l'historique si nécessaire
    if (!drinkPriceHistory.has(drinkId)) {
        drinkPriceHistory.set(drinkId, []);
    }
    
    const history = drinkPriceHistory.get(drinkId);
    
    // Ajouter le prix actuel
    history.push(currentPrice);
    
    // Garder seulement les 5 derniers points pour éviter les lags
    if (history.length > 5) {
        history.shift();
    }
    
    // Si on a moins de 2 points, retourner une ligne plate
    if (history.length < 2) {
        return `<svg width="60" height="20" viewBox="0 0 60 20">
            <line x1="5" y1="10" x2="55" y2="10" stroke="#888" stroke-width="2" />
        </svg>`;
    }
    
    // Calculer la tendance générale
    const firstPrice = history[0];
    const lastPrice = history[history.length - 1];
    const trend = lastPrice > firstPrice ? 'up' : (lastPrice < firstPrice ? 'down' : 'flat');
    
    // Couleurs selon la tendance
    const color = trend === 'up' ? '#4CAF50' : (trend === 'down' ? '#F44336' : '#888');
    
    // Normaliser les prix pour le SVG
    const minPrice = Math.min(...history);
    const maxPrice = Math.max(...history);
    const priceRange = maxPrice - minPrice || 1; // Éviter division par 0
    
    // Générer les points de la courbe
    const points = history.map((price, index) => {
        const x = 5 + (index * 50) / (history.length - 1);
        const y = 15 - ((price - minPrice) / priceRange) * 10;
        return `${x},${y}`;
    }).join(' ');
    
    return `<svg width="60" height="20" viewBox="0 0 60 20">
        <polyline points="${points}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        <circle cx="${5 + (50 * (history.length - 1)) / (history.length - 1)}" cy="${15 - ((lastPrice - minPrice) / priceRange) * 10}" r="2" fill="${color}" />
    </svg>`;
}

// Éléments DOM pour le mur de bourse
const stockGrid = document.getElementById('stockGrid');
// const connectionStatus = document.getElementById('connectionStatus'); // SUPPRIMÉ
// const statusText = document.getElementById('statusText'); // SUPPRIMÉ
const lastUpdate = document.getElementById('lastUpdate');
const marketStatus = document.getElementById('marketStatus');
const timerElement = document.getElementById('timer-countdown');

// Stockage des graphiques individuels pour chaque boisson
const stockCharts = new Map();

// Fonction pour détruire tous les graphiques existants
function destroyAllCharts() {
    stockCharts.forEach((chart, drinkId) => {
        try {
            chart.destroy();
        } catch (error) {
        }
    });
    stockCharts.clear();
}

// Rendre l'intervalle d'actualisation dynamique
refreshIntervalMs = parseInt(localStorage.getItem('refreshInterval'), 10) || REFRESH_INTERVAL;

// Timer d'actualisation
let countdown = Math.ceil(refreshIntervalMs / 1000);

function updateTimer() {
    // Cycle propre: N, N-1, ..., 1, N, ...
    if (countdown <= 1) {
        countdown = Math.ceil(refreshIntervalMs / 1000);
    } else {
        countdown = countdown - 1;
    }
    if (timerElement) {
        timerElement.textContent = countdown;
    }
}

// Démarrer/Arrêter le compteur 1s
function startTimer() {
    stopTimer();
    countdown = Math.ceil(refreshIntervalMs / 1000);
    timerIntervalId = setInterval(updateTimer, 1000);
}

function stopTimer() {
    if (timerIntervalId) {
        clearInterval(timerIntervalId);
        timerIntervalId = null;
    }
}

// Initialisation des particules
function initParticles() {
    const particlesContainer = document.getElementById('particles');
    const particleCount = 50;
    
    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        particle.style.left = Math.random() * 100 + '%';
        particle.style.animationDelay = Math.random() * 6 + 's';
        particle.style.animationDuration = (Math.random() * 3 + 3) + 's';
        particlesContainer.appendChild(particle);
    }
}

// Mise à jour du statut de connexion - SUPPRIMÉ
/*
function updateConnectionStatus(connected) {
    isConnected = connected;
    if (connected) {
        connectionStatus.className = 'connection-status connected';
        statusText.textContent = '🟢 Connecté';
    } else {
        connectionStatus.className = 'connection-status disconnected';
        statusText.textContent = '🔴 Déconnecté';
    }
}
*/

// Mise à jour de l'horodatage
function updateTimestamp() {
    const now = new Date();
    if (lastUpdate) {
        lastUpdate.textContent = now.toLocaleTimeString('fr-FR');
    }
}

// Récupération des prix depuis l'API
async function fetchPrices() {
    try {
        const res = await fetch(`${API_BASE}/prices`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        
        const data = await res.json();
        
        // Mettre à jour la liste des boissons actives (pour info)
        if (data.active_drinks) {
            activeDrinks = new Set(data.active_drinks);
        }
        
        renderStockWall(data.prices, data.active_drinks);
        // Connexion réussie
        handleReconnection();
        updateTimestamp();
        
        // Réinitialiser le compteur après une actualisation réussie
        countdown = Math.ceil(refreshIntervalMs / 1000);
        if (timerElement) {
            timerElement.textContent = countdown;
        }
        
    } catch (error) {
        console.error('Erreur lors de la récupération des prix:', error);
        // Erreur de connexion
        handleConnectionError();
    }
}

// Fonctions utilitaires pour le tableau
function getDrinkColor(drinkName, drinkId) {
    if (!drinkColorMap.has(drinkId)) {
        const colorIndex = drinkColorMap.size % drinkColors.length;
        drinkColorMap.set(drinkId, drinkColors[colorIndex]);
    }
    return drinkColorMap.get(drinkId);
}

function getTrendIcon(trend) {
    if (!trend) return '➡️';
    switch (trend) {
        case 'up': return '📈';
        case 'down': return '📉';
        default: return '➡️';
    }
}

function getVariationClass(variation) {
    if (!variation) return 'neutral';
    if (variation > 0) return 'up';
    if (variation < 0) return 'down';
    return 'neutral';
}

function formatVariation(variation) {
    if (!variation || variation === 0) return '0.00€';
    const sign = variation > 0 ? '+' : '';
    return `${sign}${variation.toFixed(2)}€`;
}

function calculateTrend(drink) {
    const previousPrice = lastPrices[drink.id];
    if (previousPrice === undefined) {
        return { class: 'neutral', hasChanged: false };
    }
    
    if (drink.price > previousPrice) {
        return { class: 'up', hasChanged: true };
    } else if (drink.price < previousPrice) {
        return { class: 'down', hasChanged: true };
    }
    
    return { class: 'neutral', hasChanged: false };
}

function calculateVariation(drink) {
    const previousPrice = lastPrices[drink.id];
    if (previousPrice === undefined) return '0.00€';
    
    const variation = drink.price - previousPrice;
    const sign = variation > 0 ? '+' : '';
    return `${sign}${variation.toFixed(2)}€`;
}

// Fonction pour rendre le mur de bourse
function renderStockWall(drinks, activeDrinksList = null) {
    
    // Sauvegarder les données pour le re-tri
    lastDrinksData = drinks || [];
    
    // Nettoyer les animations précédentes en mode immédiat
    clearPreviousAnimations();
    
    if (!stockGrid) {
        console.error('Debug: stockGrid element not found!');
        return;
    }
    
    if (!drinks || drinks.length === 0) {
        // Détruire tous les graphiques existants
        destroyAllCharts();
        stockGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: #fff; padding: 50px;">Aucune donnée disponible</div>';
        return;
    }
    
    // Si c'est le premier chargement, créer toute l'interface
    if (isInitialLoad) {
        
        // Détruire tous les graphiques existants avant de recréer le DOM
        destroyAllCharts();
        
        // Trier les boissons selon le mode choisi
        const sortedDrinks = getSortedDrinks(drinks);
        
        // Vider la grille APRÈS avoir détruit les graphiques
        stockGrid.innerHTML = '';
        
        sortedDrinks.forEach((drink, index) => {
            const tile = createStockTile(drink);
            stockGrid.appendChild(tile);
            
            // Initialiser les prix précédents
            previousPrices[drink.id] = drink.price;
            lastPrices[drink.id] = drink.price;
        });
        
        // Créer TOUS les graphiques au départ
        setTimeout(() => {
            sortedDrinks.forEach((drink, index) => {
                createOrUpdateStockChart(drink);
            });
        }, 250); // Délai pour s'assurer que le DOM est prêt
        
        isInitialLoad = false; // Marquer que le premier chargement est terminé
        
    } else {
        // Mise à jour : détecter les vrais changements de prix
        
        const drinksWithPriceChanges = [];
        
        drinks.forEach((drink) => {
            const previousPrice = previousPrices[drink.id];
            const hasPriceChanged = previousPrice !== undefined && Math.abs(previousPrice - drink.price) > 0.001;
            
            if (hasPriceChanged) {
                drinksWithPriceChanges.push(drink);
            } else {
            }
            
            // Mettre à jour les prix dans les tuiles existantes (toujours)
            updateStockTilePrice(drink);
            
            // Mettre à jour lastPrices APRÈS updateStockTilePrice pour la prochaine détection
            lastPrices[drink.id] = drink.price;
            
            // Sauvegarder le nouveau prix pour la prochaine comparaison
            previousPrices[drink.id] = drink.price;
        });
        
        // Mettre à jour SEULEMENT les graphiques des boissons dont le prix a changé
        drinksWithPriceChanges.forEach((drink) => {
            createOrUpdateStockChart(drink);
        });
        
        // Re-trier les tuiles selon le mode choisi
        const sortedDrinks = getSortedDrinks(drinks);
        reorderStockTiles(sortedDrinks);
    }
    
}

// Créer une tuile pour une boisson
function createStockTile(drink) {
    const trend = calculateTrend(drink);
    const variation = calculateVariation(drink);
    const drinkColor = getDrinkColor(drink.name, drink.id);
    
    const tile = document.createElement('div');
    tile.className = `stock-tile trend-${trend.class}`;
    tile.id = `tile-${drink.id}`;
    
    // Animation flash si le prix change
    if (trend.hasChanged) {
        tile.classList.add('price-flash');
        // L'animation restera jusqu'à la prochaine actualisation du graphique
    }
    
    tile.innerHTML = `
        <div class="tile-chart">
            <canvas id="chart-${drink.id}" width="100%" height="100%"></canvas>
        </div>
        <div class="tile-info">
            <div class="tile-name">${drink.name}</div>
            <div class="tile-price">${drink.price_rounded.toFixed(1)} €</div>
            <div class="tile-variation ${trend.class}">${variation}</div>
        </div>
    `;
    
    return tile;
}

// Mettre à jour seulement le prix dans une tuile existante
function updateStockTilePrice(drink) {
    const tile = document.getElementById(`tile-${drink.id}`);
    if (!tile) {
        return;
    }
    
    const trend = calculateTrend(drink);
    const variation = calculateVariation(drink);
    
    // Mettre à jour le prix
    const priceElement = tile.querySelector('.tile-price');
    if (priceElement) {
        priceElement.textContent = `${drink.price_rounded.toFixed(1)} €`;
    }
    
    // Mettre à jour la variation
    const variationElement = tile.querySelector('.tile-variation');
    if (variationElement) {
        variationElement.textContent = variation;
        variationElement.className = `tile-variation ${trend.class}`;
    }
    
    // Mettre à jour la classe de tendance de la tuile
    tile.className = `stock-tile trend-${trend.class}`;
    
    // Animation flash si le prix change
    if (trend.hasChanged) {
        tile.classList.add('price-flash');
        // L'animation restera jusqu'à la prochaine actualisation du graphique
    }
    
    // NE PAS mettre à jour lastPrices ici - c'est géré dans renderStockWall
}

// Réorganiser les tuiles par prix (sans recréer le DOM)
function reorderStockTiles(sortedDrinks) {
    if (!stockGrid) return;
    
    
    // Créer un fragment pour réorganiser
    const fragment = document.createDocumentFragment();
    
    sortedDrinks.forEach((drink) => {
        const tile = document.getElementById(`tile-${drink.id}`);
        if (tile) {
            fragment.appendChild(tile);
        }
    });
    
    // Vider la grille et remettre les tuiles dans le bon ordre
    stockGrid.innerHTML = '';
    stockGrid.appendChild(fragment);
}

// Créer ou mettre à jour le graphique d'une boisson
function createOrUpdateStockChart(drink) {
    const chartId = `chart-${drink.id}`;
    
    
    const canvas = document.getElementById(chartId);
    
    if (!canvas) {
        return;
    }
    
    
    // Si un graphique existe déjà pour cette boisson, le détruire d'abord
    if (stockCharts.has(drink.id)) {
        try {
            stockCharts.get(drink.id).destroy();
        } catch (error) {
        }
        stockCharts.delete(drink.id);
    }
    
    // Réinitialiser les dimensions du canvas pour éviter les problèmes de redimensionnement
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    
    // Choisir le type de graphique selon le toggle
    if (currentChartType === 'candlestick') {
        createCandlestickChart(drink, canvas);
    } else {
        createLineChart(drink, canvas);
    }
}

// Créer un graphique candlestick
function createCandlestickChart(drink, canvas) {
    
    // Initialiser l'historique si nécessaire
    if (!drinkPriceHistory.has(drink.id)) {
        drinkPriceHistory.set(drink.id, []);
    }
    
    let history = drinkPriceHistory.get(drink.id);
    const timestamp = Date.now();
    const currentPrice = drink.price;
    
    // Convertir les données linéaires en OHLC si nécessaire SANS PERDRE L'HISTORIQUE
    let ohlcHistory = [];
    
    if (history.length > 0 && history[0].y !== undefined) {
        // Convertir les points simples en candlesticks en préservant les données
        for (let i = 0; i < history.length; i++) {
            const point = history[i];
            const prevPrice = i > 0 ? history[i-1].y : point.y;
            // Variation fixe basée sur l'ID de la boisson pour la cohérence
            const variation = (drink.id % 10) * 0.01;
            
            ohlcHistory.push({
                x: point.x,
                o: prevPrice,
                h: Math.max(prevPrice, point.y) + variation,
                l: Math.min(prevPrice, point.y) - variation,
                c: point.y
            });
        }
    } else {
        // Copier les données OHLC existantes
        ohlcHistory = [...history];
    }
    
    // Si on a moins de points, créer des données aléatoires de départ SEULEMENT LA PREMIÈRE FOIS
    if (ohlcHistory.length < 1) {
        // Créer quelques candlesticks aléatoires de départ
        const basePrice = currentPrice;
        const numCandles = 3 + Math.floor(Math.random() * 5); // 3-7 bougies
        
        for (let i = 0; i < numCandles; i++) {
            const x = i; // Index simple au lieu de timestamp
            
            // Variation aléatoire mais cohérente
            const variation = (Math.random() - 0.5) * 0.3;
            const open = Math.max(0.5, basePrice + variation * (i / numCandles));
            const close = Math.max(0.5, basePrice + variation * ((i + 1) / numCandles));
            const high = Math.max(open, close) + Math.random() * 0.1;
            const low = Math.min(open, close) - Math.random() * 0.1;
            
            ohlcHistory.push({
                x: x,
                o: Math.max(0.5, open),
                h: Math.max(0.5, high),
                l: Math.max(0.5, low),
                c: Math.max(0.5, close)
            });
        }
        
        // Sauvegarder immédiatement ces données initiales
        drinkPriceHistory.set(drink.id, ohlcHistory);
    }
    
    // Ajouter un nouveau candlestick seulement lors de transactions réelles
    // Cette fonction n'est appelée que quand le prix a vraiment changé
    const lastCandle = ohlcHistory[ohlcHistory.length - 1];
    const transactionIndex = ohlcHistory.length; // Index basé sur le nombre de transactions
    
    // Toujours ajouter une nouvelle bougie car il y a eu une transaction
    const open = lastCandle ? lastCandle.c : currentPrice;
    const variation = (Math.random() - 0.5) * 0.2;
    const close = currentPrice;
    const high = Math.max(open, close) + Math.random() * 0.05;
    const low = Math.min(open, close) - Math.random() * 0.05;
    
    ohlcHistory.push({
        x: transactionIndex, // Utiliser l'index de transaction au lieu du timestamp
        o: Math.max(0.5, open),
        h: Math.max(0.5, high),
        l: Math.max(0.5, low),
        c: Math.max(0.5, close)
    });
    
    // Garder seulement les 10 dernières bougies pour éviter les lags
    if (ohlcHistory.length > 10) {
        ohlcHistory.splice(0, ohlcHistory.length - 10);
    }
    
    // Trier par timestamp
    ohlcHistory.sort((a, b) => a.x - b.x);
    
    // Sauvegarder l'historique au format OHLC
    drinkPriceHistory.set(drink.id, ohlcHistory);
    
    
    // Créer un nouveau graphique candlestick
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            console.error('Debug: Failed to get canvas context for', chartId);
            return;
        }
        
        const trend = calculateTrendFromHistoryOHLC(ohlcHistory);
        
        try {
            const chart = new Chart(ctx, {
                type: 'candlestick',
                data: {
                    datasets: [{
                        label: drink.name,
                        data: [...ohlcHistory],
                        color: {
                            up: '#00ff41',   // Couleur pour les bougies haussières
                            down: '#ff4444', // Couleur pour les bougies baissières
                            unchanged: '#00ff41' // Vert par défaut au lieu de gris
                        }
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            enabled: true,
                            mode: 'nearest',
                            callbacks: {
                                title: () => '',
                                label: (context) => {
                                    const data = context.raw;
                                    return [
                                        `O: ${data.o.toFixed(2)} €`,
                                        `H: ${data.h.toFixed(2)} €`, 
                                        `L: ${data.l.toFixed(2)} €`,
                                        `C: ${data.c.toFixed(2)} €`
                                    ];
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            type: 'linear',
                            display: false
                        },
                        y: {
                            display: false,
                            beginAtZero: false
                        }
                    }
                }
            });
            
            stockCharts.set(drink.id, chart);
            
        } catch (error) {
            console.error(`Debug: Error creating candlestick chart for ${drink.name}:`, error);
        }
}

// Créer un graphique linéaire
// Créer un graphique linéaire
function createLineChart(drink, canvas) {
    // Initialiser l'historique si nécessaire (format simple {x, y})
    if (!drinkPriceHistory.has(drink.id)) {
        drinkPriceHistory.set(drink.id, []);
    }
    
    let history = drinkPriceHistory.get(drink.id);
    const timestamp = Date.now();
    const currentPrice = drink.price;
    
    // Convertir les données OHLC en données simples si nécessaire SANS PERDRE L'HISTORIQUE
    let lineHistory = [];
    
    // Si on a des données OHLC, les convertir en points simples
    if (history.length > 0 && history[0].c !== undefined) {
        lineHistory = history.map(candle => ({
            x: candle.x,
            y: candle.c // Utiliser le prix de clôture
        }));
    } else {
        // Copier les données existantes au format line
        lineHistory = [...history];
    }
    
    // Si on a moins de points, créer des données aléatoires de départ SEULEMENT LA PREMIÈRE FOIS
    if (lineHistory.length < 1) {
        // Créer quelques points aléatoires de départ
        const basePrice = currentPrice;
        const numPoints = 3 + Math.floor(Math.random() * 5); // 3-7 points
        const isIncreasing = Math.random() > 0.5; // 50% croissant, 50% décroissant
        
        for (let i = 0; i < numPoints; i++) {
            const x = i; // Index simple au lieu de timestamp
            
            // Variation progressive selon la tendance
            const progress = i / (numPoints - 1);
            const trendMultiplier = isIncreasing ? progress : (1 - progress);
            const variation = (Math.random() - 0.5) * 0.1; // Petit bruit
            const trendVariation = trendMultiplier * 0.3; // Tendance principale
            
            const y = Math.max(0.5, basePrice + (isIncreasing ? trendVariation : -trendVariation) + variation);
            
            lineHistory.push({ x: x, y: y });
        }
        
        // Sauvegarder immédiatement ces données initiales
        drinkPriceHistory.set(drink.id, lineHistory);
    }
    
    // Ajouter un nouveau point seulement lors de transactions réelles
    // Cette fonction n'est appelée que quand le prix a vraiment changé
    const transactionIndex = lineHistory.length; // Index basé sur le nombre de transactions
    
    // Toujours ajouter un nouveau point car il y a eu une transaction
    lineHistory.push({ x: transactionIndex, y: currentPrice });
    
    // Garder seulement les 10 derniers points pour éviter les lags
    if (lineHistory.length > 10) {
        lineHistory.splice(0, lineHistory.length - 10);
    }
    
    // Trier par timestamp
    lineHistory.sort((a, b) => a.x - b.x);
    
    // Sauvegarder l'historique au format line
    drinkPriceHistory.set(drink.id, lineHistory);
    
    
    // Créer le graphique linéaire
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        console.error('Debug: Failed to get canvas context for line chart');
        return;
    }
    
    const trend = calculateTrendFromHistory(lineHistory);
    const trendColor = getTrendColor(trend);
    
    try {
        const chart = new Chart(ctx, {
            type: 'line',
            data: {
                datasets: [{
                    data: [...lineHistory],
                    borderColor: trendColor,
                    backgroundColor: getTrendColor(trend, 0.2), // Aire colorée selon la tendance
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 0,
                    pointHoverRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        enabled: true,
                        mode: 'nearest',
                        callbacks: {
                            title: () => '',
                            label: (context) => `${context.parsed.y.toFixed(2)} €`
                        }
                    }
                },
                scales: {
                    x: {
                        type: 'linear',
                        display: false
                    },
                    y: {
                        display: false,
                        beginAtZero: false
                    }
                },
                elements: {
                    line: { tension: 0.4 },
                    point: { radius: 0 }
                }
            }
        });
        
        stockCharts.set(drink.id, chart);
        
    } catch (error) {
        console.error(`Debug: Error creating line chart for ${drink.name}:`, error);
    }
}

// Calculer la tendance à partir de l'historique OHLC
function calculateTrendFromHistoryOHLC(history) {
    if (history.length < 2) return 'neutral';
    
    const firstCandle = history[0];
    const lastCandle = history[history.length - 1];
    
    if (lastCandle.c > firstCandle.c) return 'up';
    if (lastCandle.c < firstCandle.c) return 'down';
    return 'neutral';
}

// Calculer la tendance à partir de l'historique (ancienne version pour compatibilité)
function calculateTrendFromHistory(history) {
    if (history.length < 2) return 'neutral';
    
    // Au lieu de comparer premier et dernier, comparer les deux derniers points
    // pour synchroniser avec l'animation des cases
    const previousPoint = history[history.length - 2];
    const lastPoint = history[history.length - 1];
    
    const previousPrice = previousPoint.y || previousPoint.c;
    const lastPrice = lastPoint.y || lastPoint.c;
    
    let trend;
    if (lastPrice > previousPrice) trend = 'up';
    else if (lastPrice < previousPrice) trend = 'down';
    else trend = 'neutral';
    
    return trend;
}

// Obtenir la couleur selon la tendance
function getTrendColor(trend, alpha = 1) {
    switch (trend) {
        case 'up':
            return alpha === 1 ? '#00ff41' : `rgba(0, 255, 65, ${alpha})`;
        case 'down':
            return alpha === 1 ? '#ff4444' : `rgba(255, 68, 68, ${alpha})`;
        default:
            // Pour les tendances neutres, utiliser vert par défaut (pas de gris)
            return alpha === 1 ? '#00ff41' : `rgba(0, 255, 65, ${alpha})`;
    }
}

// Création d'une ligne de prix avec animations
function createPriceRow(drink) {
    const row = document.createElement('tr');
    
    // Calculer la tendance
    const trend = calculateTrend(drink);
    const variation = calculateVariation(drink);
    
    // Mettre à jour le prix précédent
    lastPrices[drink.id] = drink.price;
    
    row.innerHTML = `
        <td class="name-cell">${drink.name}</td>
        <td class="price-cell ${trend.class}">
            <div class="price-container">
                <span class="price-exact">${drink.price.toFixed(2)} €</span>
                <span class="price-rounded">${drink.price_rounded.toFixed(1)} €</span>
            </div>
        </td>
        <td class="variation-cell ${trend.class}">${variation}</td>
    `;
    
    // Ajouter l'animation si le prix a changé
    if (trend.hasChanged) {
        row.classList.add('price-change');
        // L'animation restera jusqu'à la prochaine actualisation du graphique
    }
    
    return row;
}

// Calcul de la tendance
function calculateTrend(drink) {
    const currentPrice = drink.price;
    const previousPrice = lastPrices[drink.id];
    
    if (previousPrice === undefined) {
        return {
            icon: '<span class="neutral">➖</span>',
            class: 'neutral',
            hasChanged: false
        };
    }
    
    const change = currentPrice - previousPrice;
    const hasChanged = Math.abs(change) > 0.001; // Seuil de sensibilité
    
    if (change > 0) {
        return {
            icon: '<span class="up">🔼</span>',
            class: 'up',
            hasChanged
        };
    } else if (change < 0) {
        return {
            icon: '<span class="down">🔽</span>',
            class: 'down',
            hasChanged
        };
    } else {
        return {
            icon: '<span class="neutral">➖</span>',
            class: 'neutral',
            hasChanged
        };
    }
}

// Calcul de la variation en pourcentage
function calculateVariation(drink) {
    const currentPrice = drink.price;
    const previousPrice = lastPrices[drink.id];
    
    if (previousPrice === undefined || previousPrice === 0) {
        return '--';
    }
    
    const percentage = ((currentPrice - previousPrice) / previousPrice) * 100;
    const sign = percentage > 0 ? '+' : '';
    
    return `${sign}${percentage.toFixed(2)}%`;
}

// Démarrer le rafraîchissement automatique
function startAutoRefresh() {
    if (refreshIntervalId) clearInterval(refreshIntervalId);
    
    refreshIntervalId = setInterval(fetchPrices, refreshIntervalMs);
    
    // Rafraîchir immédiatement et réinitialiser le compteur
    fetchPrices();
    countdown = Math.ceil(refreshIntervalMs / 1000);
}

// Arrêter le rafraîchissement automatique
function stopAutoRefresh() {
    if (refreshIntervalId) {
        clearInterval(refreshIntervalId);
        refreshIntervalId = null;
    }
}

// Gestion des erreurs de connexion
function handleConnectionError() {
    // updateConnectionStatus(false); // SUPPRIMÉ
    marketStatus.innerHTML = '🔴 DÉCONNECTÉ';
    marketStatus.style.color = '#ff0040';
}

// Gestion de la reconnexion
function handleReconnection() {
    // updateConnectionStatus(true); // SUPPRIMÉ
    marketStatus.innerHTML = '🟢 ACTIF';
    marketStatus.style.color = '#00ff41';
}

// Détection de la visibilité de la page
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        stopAutoRefresh();
        stopTimer();
    } else {
        startAutoRefresh();
        startTimer();
    }
});

// Gestion des erreurs réseau
window.addEventListener('online', handleReconnection);
window.addEventListener('offline', handleConnectionError);

// Initialisation
// Initialiser le toggle du type de graphique
function initChartToggle() {
    const toggleBtn = document.getElementById('chart-type-toggle');
    if (!toggleBtn) {
        return;
    }
    
    // Synchroniser l'état initial du bouton avec currentChartType
    if (currentChartType === 'line') {
        toggleBtn.textContent = '📈 Linéaire';
        toggleBtn.setAttribute('data-type', 'line');
    } else {
        toggleBtn.textContent = '📊 Candlestick';
        toggleBtn.setAttribute('data-type', 'candlestick');
    }
    
    // Gérer le clic sur le toggle
    toggleBtn.addEventListener('click', () => {
        if (currentChartType === 'candlestick') {
            currentChartType = 'line';
            toggleBtn.textContent = '📈 Linéaire';
            toggleBtn.setAttribute('data-type', 'line');
        } else {
            currentChartType = 'candlestick';
            toggleBtn.textContent = '📊 Candlestick';
            toggleBtn.setAttribute('data-type', 'candlestick');
        }
        
        // Sauvegarder dans localStorage
        localStorage.setItem('chart-type', currentChartType);
        
        
        // Envoyer signal de synchronisation
        localStorage.setItem('chart-toggle-signal', Date.now().toString());
        
        // Recréer tous les graphiques avec le nouveau type
        recreateAllCharts();
    });
    
}

// Recréer tous les graphiques avec le type actuel
function recreateAllCharts() {
    
    // Détruire tous les graphiques existants
    destroyAllCharts();
    
    // Forcer le mode initial load pour recréer tous les graphiques
    isInitialLoad = true;
    
    // Attendre un court délai pour s'assurer que la destruction est complète
    setTimeout(() => {
        // Obtenir les données actuelles des boissons et forcer la recréation
        fetchPrices().then(() => {
        }).catch(error => {
            console.error('Debug: Error recreating charts:', error);
        });
    }, 100);
}

// Fonction pour synchroniser l'affichage du bouton de tri
function initSortToggle() {
    const sortToggleButton = document.getElementById('sort-type-toggle');
    if (!sortToggleButton) {
        return;
    }
    
    // Synchroniser l'état initial du bouton avec sortMode
    const label = sortToggleButton.querySelector('span');
    if (label) {
        label.textContent = sortMode === 'price' ? 'Prix' : 'A-Z';
    }
    sortToggleButton.setAttribute('data-sort-mode', sortMode);
    
    // Ajouter l'événement click
    sortToggleButton.addEventListener('click', toggleSortMode);
}

document.addEventListener('DOMContentLoaded', () => {
    
    // Initialiser l'état de connexion immédiatement
    if (marketStatus) {
        marketStatus.innerHTML = '🟡 CONNEXION...';
        marketStatus.style.color = '#ffa500';
    }
    
    // Initialiser le thème
    initTheme();
    initParticles();
    initChartToggle();
    
    // Initialiser le bouton de tri avec synchronisation
    initSortToggle();
    
    // Pas besoin d'initCharts pour le mur de bourse - les graphiques sont créés individuellement
    
    // Vérifier le mode d'intervalle
    if (refreshIntervalMs === 0) {
        
        // Faire un fetch initial avec un petit délai pour laisser le DOM se stabiliser
        setTimeout(async () => {
            try {
                await fetchPrices();
            } catch (error) {
                console.error('❌ Erreur lors du chargement initial:', error);
                // Maintenir l'état de connexion pour ne pas inquiéter l'utilisateur
                if (marketStatus) {
                    marketStatus.innerHTML = '🟢 ACTIF';
                    marketStatus.style.color = '#00ff41';
                }
            }
        }, 100);
        
        // Afficher le mode dans le timer
        if (timerElement) {
            timerElement.textContent = 'IMMÉDIAT';
            timerElement.style.color = '#ff6b6b';
        }
    } else {
        startAutoRefresh();
        startTimer();
    }
    
    // Afficher un message de bienvenue
    
});

// Écouter les changements de localStorage (depuis admin.html ou autres onglets)
window.addEventListener('storage', (e) => {
    // Synchronisation de l'intervalle de rafraîchissement
    if (e.key === 'refreshInterval') {
        const newMs = parseInt(e.newValue, 10);
        if (!isNaN(newMs) && newMs >= 0) {  // Permettre 0
            refreshIntervalMs = newMs;
            
            if (newMs === 0) {
                // Mode transaction immédiate : arrêter tous les timers
                stopAutoRefresh();
                stopTimer();
                
                // Cacher le timer visuel
                const timerElement = document.getElementById('timer-countdown');
                if (timerElement) {
                    timerElement.textContent = 'IMMÉDIAT';
                    timerElement.style.color = '#ff6b6b';
                }
            } else {
                // Mode timer normal : redémarrer les intervalles
                stopAutoRefresh();
                startAutoRefresh();
                startTimer();
                
                // Restaurer le timer visuel
                const timerElement = document.getElementById('timer-countdown');
                if (timerElement) {
                    timerElement.style.color = '';
                }
            }
        }
    }
    // Nouvelle clé pour forcer la synchronisation
    if (e.key === 'refreshUpdate') {
        // Relire la valeur au cas où l'événement refreshInterval n'a pas été déclenché
        const storedMs = parseInt(localStorage.getItem('refreshInterval'), 10);
        if (!isNaN(storedMs) && storedMs >= 0) {  // Permettre 0
            refreshIntervalMs = storedMs;
            
            if (storedMs === 0) {
                stopAutoRefresh();
                stopTimer();
                
                const timerElement = document.getElementById('timer-countdown');
                if (timerElement) {
                    timerElement.textContent = 'IMMÉDIAT';
                    timerElement.style.color = '#ff6b6b';
                }
            } else {
                stopAutoRefresh();
                startAutoRefresh();
                startTimer();
                
                const timerElement = document.getElementById('timer-countdown');
                if (timerElement) {
                    timerElement.style.color = '';
                }
            }
        }
    }
    
    // Nouvelle clé pour détecter les achats depuis l'admin
    if (e.key === 'purchaseUpdate') {
        if (isImmediateMode()) {
            fetchPrices();
        } else {
            // En mode timer, ne pas actualiser immédiatement
            // L'actualisation se fera lors du prochain cycle automatique
        }
    }
    
    // Synchronisation du thème principal depuis l'admin
    if (e.key === 'main-theme-signal') {
        const currentTheme = localStorage.getItem('main-theme') || 'dark';
        const allowed = new Set(['light', 'dark']);
        const val = allowed.has(currentTheme) ? currentTheme : 'dark';
        applyTheme(val);
    }
    
    // Synchronisation du toggle de graphique depuis l'admin
    if (e.key === 'chart-toggle-signal') {
        // Changer directement le type de graphique
        if (currentChartType === 'candlestick') {
            currentChartType = 'line';
        } else {
            currentChartType = 'candlestick';
        }
        
        // Sauvegarder dans localStorage
        localStorage.setItem('chart-type', currentChartType);
        
        
        // Recréer tous les graphiques avec le nouveau type
        recreateAllCharts();
    }
    
    // Synchronisation du toggle de tri depuis l'admin
    if (e.key === 'sort-toggle-signal') {
        // Lire l'état actuel du tri depuis localStorage pour savoir comment basculer
        const currentSortMode = localStorage.getItem('sort-mode') || 'price';
        const newSortMode = currentSortMode === 'price' ? 'alphabetical' : 'price';
        
        // Mettre à jour la variable locale
        sortMode = newSortMode;
        
        
        // Mettre à jour le texte du bouton si il existe
        const toggleButton = document.getElementById('sort-type-toggle');
        if (toggleButton) {
            const label = toggleButton.querySelector('span');
            if (label) {
                label.textContent = sortMode === 'price' ? 'Prix' : 'A-Z';
            }
            toggleButton.setAttribute('data-sort-mode', sortMode);
        }
        
        // Refaire le rendu avec le nouveau tri
        if (lastDrinksData && lastDrinksData.length > 0) {
            const sortedDrinks = getSortedDrinks(lastDrinksData);
            reorderStockTiles(sortedDrinks);
        }
    }
    
    // Appliquer immédiatement si une personnalisation de thème a été modifiée dans l'admin
    if (e.key === 'theme_custom_light' || e.key === 'theme_custom_dark') {
        try { applyCustomThemeFromStorage(); } catch {}
    }
});

// Variable pour tracker la dernière mise à jour d'achat
let lastPurchaseUpdate = localStorage.getItem('purchaseUpdate') || '0';

// Fonction de vérification périodique des achats (alternative à l'événement storage)
function checkForPurchaseUpdates() {
    const currentUpdate = localStorage.getItem('purchaseUpdate') || '0';
    if (currentUpdate !== lastPurchaseUpdate) {
        lastPurchaseUpdate = currentUpdate;
        if (isImmediateMode()) {
            fetchPrices();
        } else {
            // En mode timer, ne pas actualiser immédiatement
        }
    }
}

// Vérifier toutes les 2 secondes s'il y a eu un achat
setInterval(checkForPurchaseUpdates, 2000);

// Gestion des erreurs globales
window.addEventListener('error', (event) => {
    console.error('Erreur JavaScript:', event.error);
    handleConnectionError();
});

// Fonctions pour les boutons de démonstration
async function triggerCrash() {
    try {
        const response = await fetch(`${API_BASE}/crash`, { method: 'POST' });
        if (response.ok) {
            // Rafraîchir immédiatement après le krach
            await fetchPrices();
        } else {
            console.error('Erreur lors du déclenchement du krach');
        }
    } catch (error) {
        console.error('Erreur réseau:', error);
    }
}

async function resetPrices() {
    if (confirm('Êtes-vous sûr de vouloir réinitialiser tous les prix à leur valeur de base ?')) {
        try {
            const response = await fetch(`${API_BASE}/reset`, { method: 'POST' });
            if (response.ok) {
                // Rafraîchir immédiatement après la réinitialisation
                await fetchPrices();
            } else {
                console.error('Erreur lors de la réinitialisation');
            }
        } catch (error) {
            console.error('Erreur réseau:', error);
        }
    }
}

// Fonctions simplifiées pour compatibilité
function initCharts() {
    // Les graphiques sont maintenant créés individuellement dans chaque tuile
}

function updateCharts(prices, history) {
    // Mise à jour gérée directement dans renderStockWall
}

function createMiniChart(drinkName, history) {
    // Plus utilisé dans le mur de bourse
    return '<div class="mini-chart">--</div>';
}

// ==========================
// Gestion des thèmes (2)
// ==========================

function initTheme() {
    const savedRaw = localStorage.getItem('main-theme'); // Utiliser main-theme au lieu de theme
    const allowed = new Set(['light', 'dark']);
    const saved = allowed.has(savedRaw) ? savedRaw : 'dark'; // Par défaut sombre pour l'interface principale
    applyTheme(saved);
    // Appliquer une éventuelle personnalisation (couleurs) sauvegardée pour ce thème
    applyCustomThemeFromStorage();
    // Note: Le sélecteur de thème est maintenant uniquement dans l'interface admin
}

function applyTheme(themeName) {
    document.body.setAttribute('data-theme', themeName);
    localStorage.setItem('main-theme', themeName); // Sauvegarder sous main-theme
    // Mettre à jour les graphiques si présents
    if (wallStreetCharts && typeof wallStreetCharts.updateTheme === 'function') {
        wallStreetCharts.updateTheme();
    }
    // Appliquer les couleurs personnalisées (si présentes) du thème actif
    try { applyCustomThemeFromStorage(); } catch {}
}

// ==============================
// Application des couleurs custom
// ==============================
function hexToRgbTriplet(hex) {
    const h = hex.replace('#', '');
    const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
    const bigint = parseInt(full, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return `${r}, ${g}, ${b}`;
}

function setCssVar(name, triplet) {
    document.body.style.setProperty(name, triplet);
}

function applyCustomThemeFromStorage() {
    const theme = document.body.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    const key = `theme_custom_${theme}`;
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(key) || 'null'); } catch {}
    if (!saved || typeof saved !== 'object') return; // rien à appliquer

    if (saved.title) setCssVar('--title', hexToRgbTriplet(saved.title));
    if (saved.accent) setCssVar('--accent', hexToRgbTriplet(saved.accent));
    if (saved.text) setCssVar('--text', hexToRgbTriplet(saved.text));
    if (saved.danger) setCssVar('--danger', hexToRgbTriplet(saved.danger));
    if (saved.bg) {
        const t = hexToRgbTriplet(saved.bg);
        setCssVar('--bg-start', t);
        setCssVar('--bg-mid', t);
        setCssVar('--bg-end', t);
    }
    if (saved.surface) setCssVar('--surface', hexToRgbTriplet(saved.surface));
    if (saved.grid) setCssVar('--grid', hexToRgbTriplet(saved.grid));

    // Notifier les charts d'un changement potentiel d'accent/texte
    if (wallStreetCharts && typeof wallStreetCharts.updateTheme === 'function') {
        wallStreetCharts.updateTheme();
    }
}

// Export pour tests (si nécessaire)
if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
    module.exports = {
        fetchPrices,
        calculateTrend,
        calculateVariation,
        triggerCrash,
        resetPrices,
        initCharts,
        updateCharts
    };
}
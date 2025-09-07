// Configuration
const API_BASE = window.location.origin;
const REFRESH_INTERVAL = 10000; // 10 secondes
const ANIMATION_DURATION = 500;

// État global
let lastPrices = {};
let isConnected = false;
let refreshIntervalMs = null; // durée en ms entre deux rafraîchissements
let refreshIntervalId = null; // handle de setInterval pour le fetch auto
let timerIntervalId = null;   // handle de setInterval pour le compteur 1s
let wallStreetCharts = null;

// Éléments DOM
const tbody = document.querySelector('#prices tbody');
const connectionStatus = document.getElementById('connectionStatus');
const statusText = document.getElementById('statusText');
const lastUpdate = document.getElementById('lastUpdate');
const marketStatus = document.getElementById('marketStatus');
const timerElement = document.getElementById('timer-countdown');

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

// Mise à jour du statut de connexion
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

// Mise à jour de l'horodatage
function updateTimestamp() {
    const now = new Date();
    lastUpdate.textContent = now.toLocaleTimeString('fr-FR');
}

// Récupération des prix depuis l'API
async function fetchPrices() {
    try {
        const res = await fetch(`${API_BASE}/prices`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        
        const data = await res.json();
        renderTable(data.prices);
        updateConnectionStatus(true);
        updateTimestamp();
        
        // Mettre à jour les graphiques
        updateCharts(data.prices);
        
        // Réinitialiser le compteur après une actualisation réussie
        countdown = Math.ceil(refreshIntervalMs / 1000);
        if (timerElement) {
            timerElement.textContent = countdown;
        }
        
    } catch (error) {
        console.error('Erreur lors de la récupération des prix:', error);
        updateConnectionStatus(false);
    }
}

// Rendu du tableau avec animations
function renderTable(prices) {
    if (!tbody) return;
    
    // Créer un fragment pour éviter les reflows
    const fragment = document.createDocumentFragment();
    
    prices.forEach(drink => {
        const row = createPriceRow(drink);
        fragment.appendChild(row);
    });
    
    // Remplacer le contenu du tbody
    tbody.innerHTML = '';
    tbody.appendChild(fragment);
}

// Création d'une ligne de prix avec animations
function createPriceRow(drink) {
    const row = document.createElement('tr');
    
    // Calculer la tendance
    const trend = calculateTrend(drink);
    const variation = calculateVariation(drink);
    
    // Mettre à jour le prix précédent
    lastPrices[drink.id] = drink.price;
    
    const miniChart = createMiniChart(drink.name, wallStreetCharts?.priceHistory?.get(drink.name) || []);
    
    row.innerHTML = `
        <td class="name-cell">${drink.name}</td>
        <td class="price-cell ${trend.class}">${drink.price.toFixed(2)}</td>
        <td class="trend-cell">${trend.icon}</td>
        <td class="${trend.class}">${variation}</td>
        <td class="chart-cell">${miniChart}</td>
    `;
    
    // Ajouter l'animation si le prix a changé
    if (trend.hasChanged) {
        row.classList.add('price-change');
        setTimeout(() => row.classList.remove('price-change'), ANIMATION_DURATION);
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
    updateConnectionStatus(false);
    marketStatus.innerHTML = '🔴 DÉCONNECTÉ';
    marketStatus.style.color = '#ff0040';
}

// Gestion de la reconnexion
function handleReconnection() {
    updateConnectionStatus(true);
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
document.addEventListener('DOMContentLoaded', () => {
    initParticles();
    initCharts();
    startAutoRefresh();
    startTimer();
    
    // Afficher un message de bienvenue
    console.log('🍺 Wall Street Bar - Marché des boissons en temps réel');
    console.log(`📊 Mise à jour automatique toutes les ${Math.ceil(refreshIntervalMs / 1000)} secondes`);
});

// Écouter les changements de localStorage (depuis admin.html ou autres onglets)
window.addEventListener('storage', (e) => {
    if (e.key === 'refreshInterval') {
        const newMs = parseInt(e.newValue, 10);
        if (!isNaN(newMs) && newMs >= 1000) {
            refreshIntervalMs = newMs;
            // Redémarrer les intervalles avec la nouvelle valeur
            stopAutoRefresh();
            startAutoRefresh();
            startTimer();
            console.log(`🔁 Nouvel intervalle appliqué: ${Math.ceil(refreshIntervalMs / 1000)}s`);
        }
    }
});

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
            console.log('💥 Krach déclenché !');
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
                console.log('🔄 Prix réinitialisés !');
            } else {
                console.error('Erreur lors de la réinitialisation');
            }
        } catch (error) {
            console.error('Erreur réseau:', error);
        }
    }
}

// Fonctions pour les graphiques
function initCharts() {
    wallStreetCharts = new WallStreetCharts();
}

function updateCharts(prices, history) {
    if (wallStreetCharts) {
        // Update price history for each drink
        const now = new Date();
        const timePoint = now.getTime();
        
        prices.forEach(drink => {
            // Get or initialize history array for this drink
            if (!wallStreetCharts.priceHistory.has(drink.name)) {
                wallStreetCharts.priceHistory.set(drink.name, []);
            }
            
            const drinkHistory = wallStreetCharts.priceHistory.get(drink.name);
            
            // Add new price point
            drinkHistory.push({
                time: timePoint,
                price: drink.price
            });
            
            // Limit history size (optional)
            if (drinkHistory.length > wallStreetCharts.maxDataPoints) {
                drinkHistory.shift(); // Remove oldest point
            }
        });
        
        // Now update the chart with the updated history
        wallStreetCharts.updatePriceChart(prices);
        
        if (history) {
            wallStreetCharts.updateVolumeChart(history);
        }
    }
}

function createMiniChart(drinkName, history) {
    if (wallStreetCharts) {
        return wallStreetCharts.createMiniChart(drinkName, history);
    }
    return '<div class="mini-chart">--</div>';
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
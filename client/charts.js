// File: charts.js
/**
 * Système de graphiques avancés pour le Wall Street Bar
 * Utilise Chart.js pour des graphiques en temps réel
 */

class WallStreetCharts {
    constructor() {
        this.priceChart = null;
        this.volumeChart = null;
        this.priceHistory = new Map(); // Stockage de l'historique des prix
        this.volumeHistory = new Map(); // Stockage de l'historique des volumes
        this.maxDataPoints = 50; // Nombre maximum de points de données
        this.chartColors = {
            pilsner: '#00ff41',
            ipa: '#ff6b35',
            cocktail: '#ffd700',
            soft: '#00bfff',
            shot: '#ff1493'
        };
        
        this.initCharts();
    }
    
    initCharts() {
        this.initPriceChart();
        this.initVolumeChart();
    }
    
    initPriceChart() {
        const chartEl = document.getElementById('priceChart');
        
        // Si l'élément n'existe pas, sortir de la fonction
        if (!chartEl) {
            console.log('Price chart element not found, skipping initialization');
            return;
        }
        
        const ctx = chartEl.getContext('2d');
        
        this.priceChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: []
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: {
                            color: '#00ff41',
                            font: {
                                family: 'Courier New, monospace'
                            }
                        }
                    },
                    title: {
                        display: false
                    }
                },
                scales: {
                    x: {
                        type: 'linear',
                        ticks: {
                            maxTicksLimit: 10
                        },
                        grid: {
                            color: 'rgba(0, 255, 65, 0.1)'
                        }
                    },
                    y: {
                        beginAtZero: true,
                        max: 100,
                        ticks: {
                            color: '#00ff41',
                            font: {
                                family: 'Courier New, monospace'
                            },
                            callback: function(value) {
                                return value;
                            }
                        },
                        grid: {
                            color: 'rgba(0, 255, 65, 0.1)'
                        }
                    }
                },
                elements: {
                    line: {
                        tension: 0.4
                    },
                    point: {
                        radius: 3,
                        hoverRadius: 6
                    }
                },
                animation: false // Disable animation to prevent curves from starting at the bottom
            }
        });
    }
    
    initVolumeChart() {
        const volumeChartEl = document.getElementById('volumeChart');
    
        // Si l'élément n'existe pas, simplement sortir de la fonction
        if (!volumeChartEl) {
            console.log('Volume chart element not found, skipping initialization');
            return;
        }
        
        const ctx = volumeChartEl.getContext('2d');

        this.volumeChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: [],
                datasets: [{
                    label: 'Volume des Transactions',
                    data: [],
                    backgroundColor: 'rgba(0, 255, 65, 0.3)',
                    borderColor: '#00ff41',
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false, /* Empêche les déformations */
                scales: {
                    x: {
                        ticks: {
                            maxTicksLimit: 10
                        }
                    },
                    y: {
                        beginAtZero: true,
                        max: 100 /* Exemple de limite supérieure */
                    }
                }
            }
        });
    }
    
    updatePriceChart(prices) {
        const labels = [];
        const datasets = [];
        let globalMinPrice = Infinity;
        let globalMaxPrice = 0;

        // Créer les labels de temps (avec une limite)
        if (this.priceHistory.size > 0) {
            const firstDrink = this.priceHistory.values().next().value;
            // Limiter le nombre de points à afficher
            const limitedPoints = firstDrink.slice(-this.maxDataPoints);
            labels.push(...limitedPoints.map(point => point.time));
        }

        // Créer les datasets pour chaque boisson et déterminer les min/max globaux
        this.priceHistory.forEach((history, drinkName) => {
            const color = this.getDrinkColor(drinkName);
            // Limiter le nombre de points
            const limitedHistory = history.slice(-this.maxDataPoints);
            const prices = limitedHistory.map(point => point.price);

            // Filtrer les valeurs aberrantes seulement si nous avons assez de données
            let filteredPrices = prices;
            if (prices.length >= 4) {
                const sorted = [...prices].sort((a, b) => a - b);
                const q1 = sorted[Math.floor(sorted.length / 4)];
                const q3 = sorted[Math.floor((3 * sorted.length) / 4)];
                const iqr = q3 - q1;
                const lowerBound = q1 - 1.5 * iqr;
                const upperBound = q3 + 1.5 * iqr;
                filteredPrices = prices.filter(price => price >= lowerBound && price <= upperBound);
                // Si tout est filtré, revenir aux données originales pour éviter l'effacement des courbes
                if (filteredPrices.length === 0) {
                    filteredPrices = prices;
                }
            }

            // Mettre à jour les min/max globaux
            if (filteredPrices.length > 0) {
                const minPrice = Math.min(...filteredPrices);
                const maxPrice = Math.max(...filteredPrices);
                globalMinPrice = Math.min(globalMinPrice, minPrice);
                globalMaxPrice = Math.max(globalMaxPrice, maxPrice);
            }

            datasets.push({
                label: drinkName,
                data: filteredPrices,
                borderColor: color,
                backgroundColor: color + '20',
                fill: false,
                tension: 0.4
            });
        });

        // Définir les limites d'axes Y une seule fois, après avoir traité toutes les boissons
        if (globalMinPrice !== Infinity && globalMaxPrice !== 0) {
            // Définir des limites plus strictes avec une marge fixe
            this.priceChart.options.scales.y.min = Math.max(0, Math.floor(globalMinPrice) - 1);
            this.priceChart.options.scales.y.max = Math.ceil(globalMaxPrice) + 1;
        } else {
            // Valeurs par défaut si aucune donnée
            this.priceChart.options.scales.y.min = 0;
            this.priceChart.options.scales.y.max = 10;
        }

        this.priceChart.data.labels = labels;
        this.priceChart.data.datasets = datasets;
        this.priceChart.update(); // Cette ligne manquante est cruciale
    }

    updateVolumeChart(historyData) {
        const labels = [];
        const datasets = [];
        let globalMinVolume = Infinity;
        let globalMaxVolume = 0;

        // Créer les labels de temps
        if (this.volumeHistory.size > 0) {
            const firstDrink = this.volumeHistory.values().next().value;
            labels.push(...firstDrink.map(point => point.time));
        }

        // Créer les datasets pour chaque boisson
        this.volumeHistory.forEach((history, drinkName) => {
            const color = this.getDrinkColor(drinkName);
            let volumes = history.map(point => point.volume);

            // Filtrer les valeurs aberrantes seulement si nous avons assez de données
            if (volumes.length >= 4) {
                const sorted = [...volumes].sort((a, b) => a - b);
                const q1 = sorted[Math.floor(sorted.length / 4)];
                const q3 = sorted[Math.floor((3 * sorted.length) / 4)];
                const iqr = q3 - q1;
                const lowerBound = q1 - 1.5 * iqr;
                const upperBound = q3 + 1.5 * iqr;
                volumes = volumes.filter(volume => volume >= lowerBound && volume <= upperBound);
                if (volumes.length === 0) {
                    volumes = history.map(point => point.volume);
                }
            }

            if (volumes.length > 0) {
                const minVolume = Math.min(...volumes);
                const maxVolume = Math.max(...volumes);
                globalMinVolume = Math.min(globalMinVolume, minVolume);
                globalMaxVolume = Math.max(globalMaxVolume, maxVolume);
            }

            datasets.push({
                label: drinkName,
                data: volumes,
                backgroundColor: color + '50',
                borderColor: color,
                borderWidth: 1
            });
        });

        // Définir les limites d'axes Y une seule fois, après avoir traité toutes les boissons
        if (globalMinVolume !== Infinity && globalMaxVolume !== 0) {
            this.volumeChart.options.scales.y.min = Math.max(0, Math.floor(globalMinVolume));
            this.volumeChart.options.scales.y.max = Math.ceil(globalMaxVolume) + 1;
        } else {
            this.volumeChart.options.scales.y.min = 0;
            this.volumeChart.options.scales.y.max = 10;
        }

        this.volumeChart.data.labels = labels;
        this.volumeChart.data.datasets = datasets;
        this.volumeChart.update();
    }
    
    getDrinkColor(drinkName) {
        const name = drinkName.toLowerCase();
        if (name.includes('pilsner')) return this.chartColors.pilsner;
        if (name.includes('ipa')) return this.chartColors.ipa;
        if (name.includes('cocktail')) return this.chartColors.cocktail;
        if (name.includes('soft')) return this.chartColors.soft;
        if (name.includes('shot')) return this.chartColors.shot;
        return '#00ff41'; // Couleur par défaut
    }
    
    createMiniChart(drinkName, history) {
        if (!history || history.length < 2) {
            return '<div class="mini-chart">--</div>';
        }
        
        const width = 60;
        const height = 30;
        const padding = 2;
        
        // Calculer les points du graphique
        const prices = history.map(point => point.price);
        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);
        const priceRange = maxPrice - minPrice || 1;
        
        const points = prices.map((price, index) => {
            const x = padding + (index / (prices.length - 1)) * (width - 2 * padding);
            const y = height - padding - ((price - minPrice) / priceRange) * (height - 2 * padding);
            return `${x},${y}`;
        }).join(' ');
        
        const areaPoints = `${points} L${width - padding},${height - padding} L${padding},${height - padding} Z`;
        
        const color = this.getDrinkColor(drinkName);
        
        return `
            <div class="mini-chart">
                <svg viewBox="0 0 ${width} ${height}">
                    <path class="area" d="${areaPoints}" fill="${color}20"/>
                    <path class="line" d="M ${points}" stroke="${color}" fill="none"/>
                </svg>
            </div>
        `;
    }
    
    addPriceAlert(drinkName, currentPrice, previousPrice) {
        const change = currentPrice - previousPrice;
        const changePercent = (change / previousPrice) * 100;
        
        // Alerte pour les changements significatifs (> 5%)
        if (Math.abs(changePercent) > 5) {
            this.showPriceAlert(drinkName, currentPrice, changePercent);
        }
    }
    
    showPriceAlert(drinkName, price, changePercent) {
        const alert = document.createElement('div');
        alert.className = 'price-alert';
        alert.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${changePercent > 0 ? 'rgba(0, 255, 65, 0.9)' : 'rgba(255, 0, 64, 0.9)'};
            color: white;
            padding: 15px 20px;
            border-radius: 10px;
            font-family: 'Courier New', monospace;
            font-weight: bold;
            box-shadow: 0 0 20px rgba(0, 0, 0, 0.5);
            z-index: 1000;
            animation: slideInRight 0.5s ease-out;
        `;
        
        alert.innerHTML = `
            <div style="font-size: 1.2em;">${changePercent > 0 ? '📈' : '📉'} ${drinkName}</div>
            <div style="font-size: 1.1em;">€${price.toFixed(2)}</div>
            <div style="font-size: 0.9em; opacity: 0.8;">
                ${changePercent > 0 ? '+' : ''}${changePercent.toFixed(1)}%
            </div>
        `;
        
        document.body.appendChild(alert);
        
        // Supprimer l'alerte après 3 secondes
        setTimeout(() => {
            alert.style.animation = 'slideOutRight 0.5s ease-in';
            setTimeout(() => {
                if (alert.parentNode) {
                    alert.parentNode.removeChild(alert);
                }
            }, 500);
        }, 3000);
    }
    
    exportChartData() {
        const data = {
            priceHistory: Object.fromEntries(this.priceHistory),
            volumeHistory: Object.fromEntries(this.volumeHistory),
            exportTime: new Date().toISOString()
        };
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `wallstreet_chart_data_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}

// Ajouter les animations CSS pour les alertes
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOutRight {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);



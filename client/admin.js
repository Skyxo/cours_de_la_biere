// Variables globales pour la synchronisation
let currentChartType = localStorage.getItem('chart-type') || 'candlestick';
let sortMode = localStorage.getItem('sort-mode') || 'price';

// Supprimer tout l'historique
async function clearHistory() {
    try {
        const res = await fetch(`${API_BASE}/admin/history/clear`, {
            method: 'POST',
            headers: { 'Authorization': 'Basic ' + authToken }
        });
        if (res.ok) {
            showMessage('history-message', '🧹 Historique supprimé', 'success');
            await loadHistory();
            // loadPurchaseTable(); // SUPPRIMÉ - pas besoin de recharger les prix
            // loadAdminDrinksList(); // SUPPRIMÉ - pas besoin de recharger les boissons
        } else {
            const err = await res.json();
            showMessage('history-message', 'Erreur: ' + err.detail, 'error');
        }
    } catch (e) {
        showMessage('history-message', 'Erreur réseau lors de la suppression de l\'historique', 'error');
    }
}

// Gestion des boissons (CRUD)
async function addDrink() {
    const name = document.getElementById('new-drink-name')?.value?.trim();
    const base = parseFloat(document.getElementById('new-drink-base')?.value);
    const minp = parseFloat(document.getElementById('new-drink-min')?.value);
    const maxp = parseFloat(document.getElementById('new-drink-max')?.value);
    if (!name || isNaN(base) || isNaN(minp) || isNaN(maxp)) {
        showMessage('history-message', 'Champs boisson invalides', 'error');
        return;
    }
    try {
        const res = await fetch(`${API_BASE}/admin/drinks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Basic ' + authToken },
            body: JSON.stringify({ name, base_price: base, min_price: minp, max_price: maxp })
        });
        if (res.ok) {
            showMessage('history-message', '🍺 Boisson ajoutée', 'success');
            document.getElementById('new-drink-name').value = '';
            document.getElementById('new-drink-base').value = '';
            document.getElementById('new-drink-min').value = '';
            document.getElementById('new-drink-max').value = '';
            
            // Après ajout d'une nouvelle boisson, recharger les tableaux nécessaires
            await loadPurchaseTable(); // Nécessaire car nouvelle boisson
            await loadAdminDrinksList(); // Nécessaire pour la nouvelle boisson
        } else {
            const err = await res.json();
            showMessage('history-message', 'Erreur ajout: ' + err.detail, 'error');
        }
    } catch (e) {
        showMessage('history-message', 'Erreur réseau ajout boisson', 'error');
    }
}

async function loadAdminDrinksList() {
    const container = document.getElementById('drinks-admin-list');
    if (!container) return;
    try {
        // Récupérer les données admin ET publiques pour synchroniser les prix
        const [adminRes, publicRes] = await Promise.all([
            fetch(`${API_BASE}/admin/drinks`, { headers: { 'Authorization': 'Basic ' + authToken } }),
            fetch(`${API_BASE}/prices`)
        ]);
        
        const adminData = await adminRes.json();
        const publicData = await publicRes.json();
        
        // Créer un map des prix publics pour référence rapide
        const publicPrices = {};
        (publicData.prices || []).forEach(drink => {
            publicPrices[drink.id] = drink.price;
        });
        
        container.innerHTML = '';
        
        // Trier les bières par ordre alphabétique
        const sortedDrinks = (adminData.drinks || []).sort((a, b) => a.name.localeCompare(b.name));
        
        sortedDrinks.forEach(d => {
            const publicPrice = publicPrices[d.id] || d.price;
            const div = document.createElement('div');
            div.className = 'drinks-table-row';
            div.innerHTML = `
                <input type="text" value="${d.name}" data-field="name">
                <input type="number" step="0.01" value="${d.base_price}" data-field="base_price">
                <input type="number" step="0.01" value="${d.min_price}" data-field="min_price">
                <input type="number" step="0.01" value="${d.max_price}" data-field="max_price">
                <span class="public-price" style="color: #00ff41; font-weight: bold; padding: 8px; display: flex; align-items: center;">
                    ${publicPrice.toFixed(2)} €
                </span>
                <div style="display: flex; gap: 5px;">
                  <button class="btn" data-action="save">💾</button>
                  <button class="btn btn-danger btn-icon" data-action="delete" title="Supprimer" aria-label="Supprimer">🗑️</button>
                </div>
            `;
            const saveBtn = div.querySelector('[data-action="save"]');
            const delBtn = div.querySelector('[data-action="delete"]');
            saveBtn.addEventListener('click', async () => {
                const payload = {};
                div.querySelectorAll('input').forEach(inp => {
                    const key = inp.getAttribute('data-field');
                    const val = inp.type === 'number' ? parseFloat(inp.value) : inp.value;
                    payload[key] = val;
                });
                try {
                    const res = await fetch(`${API_BASE}/admin/drinks/${d.id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json', 'Authorization': 'Basic ' + authToken },
                        body: JSON.stringify(payload)
                    });
                    if (res.ok) {
                        showMessage('history-message', '✅ Boisson mise à jour', 'success');
                        await updatePurchaseTablePricesFromAPI(); // Plus efficace
                        // loadHistory(); // SUPPRIMÉ - sera mis à jour par refreshData()
                    } else {
                        const err = await res.json();
                        showMessage('history-message', 'Erreur maj: ' + err.detail, 'error');
                    }
                } catch (e) {
                    showMessage('history-message', 'Erreur réseau maj boisson', 'error');
                }
            });
            delBtn.addEventListener('click', async () => {
                try {
                    const res = await fetch(`${API_BASE}/admin/drinks/${d.id}`, {
                        method: 'DELETE',
                        headers: { 'Authorization': 'Basic ' + authToken }
                    });
                    if (res.ok) {
                        showMessage('history-message', '🗑️ Boisson supprimée', 'success');
                        await loadPurchaseTable(); // Garder ici car la boisson n'existe plus
                        await loadAdminDrinksList();
                    } else {
                        const err = await res.json();
                        showMessage('history-message', 'Erreur suppression boisson: ' + err.detail, 'error');
                    }
                } catch (e) {
                    showMessage('history-message', 'Erreur réseau suppression boisson', 'error');
                }
            });
            container.appendChild(div);
        });
    } catch (e) {
        console.error('Erreur chargement liste boissons admin:', e);
    }
}
// Configuration
const API_BASE = window.location.origin;
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'wallstreet2024';

// État global
let isAuthenticated = false;
let authToken = null;
let priceUpdateMode = 'transaction'; // Mode par défaut

// Variables pour le timer admin synchronisé
let adminTimerInterval = null;
let adminCountdown = 0;
let currentPrices = {};
let nextPrices = {};

// Éléments DOM
const authForm = document.getElementById('auth-form');
const adminInterface = document.getElementById('admin-interface');
const loginForm = document.getElementById('login-form');
const authMessage = document.getElementById('auth-message');

// Initialisation
document.addEventListener('DOMContentLoaded', () => {
    // Appliquer le thème CLC (light/dark) depuis localStorage
    try {
        const saved = localStorage.getItem('theme');
        const theme = saved === 'dark' ? 'dark' : 'light';
        document.body.setAttribute('data-theme', theme);
    } catch (e) { /* no-op */ }

    // Vérifier si on est déjà authentifié
    const savedAuth = localStorage.getItem('admin_auth');
    if (savedAuth) {
        try {
            const auth = JSON.parse(savedAuth);
            if (auth.username === ADMIN_USERNAME && auth.password === ADMIN_PASSWORD) {
                authenticate(auth.username, auth.password);
                return;
            }
        } catch (e) {
            localStorage.removeItem('admin_auth');
        }
    }
    
    showAuthForm();

    // Initialiser les sélecteurs de thème séparés
    const themeSelect = document.getElementById('theme-select'); // Thème admin
    const adminThemeSelect = document.getElementById('admin-theme-select'); // Thème interface principale
    
    // Thème de l'admin (local)
    if (themeSelect) {
        const currentAdminTheme = (localStorage.getItem('admin-theme') === 'dark') ? 'dark' : 'light';
        themeSelect.value = currentAdminTheme;
        document.body.setAttribute('data-theme', currentAdminTheme);
        
        themeSelect.addEventListener('change', (e) => {
            const theme = e.target.value === 'dark' ? 'dark' : 'light';
            document.body.setAttribute('data-theme', theme);
            localStorage.setItem('admin-theme', theme);
            console.log(`🎨 Thème admin changé: ${theme}`);
        });
    }
    
    // Thème de l'interface principale (contrôlé depuis l'admin)
    if (adminThemeSelect) {
        const currentMainTheme = (localStorage.getItem('main-theme') === 'dark') ? 'dark' : 'light';
        adminThemeSelect.value = currentMainTheme;
        
        adminThemeSelect.addEventListener('change', (e) => {
            const theme = e.target.value === 'dark' ? 'dark' : 'light';
            localStorage.setItem('main-theme', theme);
            localStorage.setItem('main-theme-signal', Date.now().toString());
            console.log(`🎨 Thème interface principale changé: ${theme}`);
        });
    }
});

// Synchroniser les thèmes si modifiés depuis une autre page/onglet
window.addEventListener('storage', (e) => {
    // Synchroniser le thème admin
    if (e.key === 'admin-theme' && e.newValue) {
        const theme = e.newValue === 'dark' ? 'dark' : 'light';
        document.body.setAttribute('data-theme', theme);
        const themeSelect = document.getElementById('theme-select');
        if (themeSelect) themeSelect.value = theme;
    }
    
    // Synchroniser l'affichage du sélecteur du thème interface principale
    if (e.key === 'main-theme' && e.newValue) {
        const theme = e.newValue === 'dark' ? 'dark' : 'light';
        const adminThemeSelect = document.getElementById('admin-theme-select');
        if (adminThemeSelect) adminThemeSelect.value = theme;
    }
    
    // Synchroniser le bouton de graphique depuis l'interface principale
    if (e.key === 'chart-toggle-signal') {
        // Mettre à jour currentChartType depuis localStorage
        currentChartType = localStorage.getItem('chart-type') || 'candlestick';
        
        const adminChartToggle = document.getElementById('admin-chart-toggle');
        if (adminChartToggle && !adminChartToggle.dataset.adminTriggered) {
            // Synchroniser l'état du bouton admin avec currentChartType
            adminChartToggle.setAttribute('data-type', currentChartType);
            adminChartToggle.textContent = currentChartType === 'candlestick' ? '📊 Candlestick' : '📈 Linéaire';
            console.log('🔄 Bouton graphique admin synchronisé depuis interface principale:', currentChartType);
        }
    }
    
    // Synchroniser le bouton de tri depuis l'interface principale
    if (e.key === 'sort-toggle-signal') {
        // Mettre à jour sortMode depuis localStorage
        sortMode = localStorage.getItem('sort-mode') || 'price';
        
        const adminSortToggle = document.getElementById('admin-sort-toggle');
        if (adminSortToggle && !adminSortToggle.dataset.adminTriggered) {
            // Synchroniser l'état du bouton admin avec sortMode
            adminSortToggle.setAttribute('data-sort', sortMode);
            adminSortToggle.textContent = sortMode === 'price' ? '💰 Prix' : '🔤 A-Z';
            console.log('🔄 Bouton tri admin synchronisé depuis interface principale:', sortMode);
        }
    }
});

// Personnalisation détaillée supprimée: seules les palettes Light/Dark sont disponibles.

// Gestion de l'authentification
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    try {
        await authenticate(username, password);
    } catch (error) {
        showMessage('auth-message', 'Identifiants incorrects', 'error');
    }
});

async function authenticate(username, password) {
    try {
        // Tester l'authentification avec un endpoint admin
        const response = await fetch(`${API_BASE}/admin/status`, {
            method: 'GET',
            headers: {
                'Authorization': 'Basic ' + btoa(username + ':' + password)
            }
        });
        
        if (response.ok) {
            isAuthenticated = true;
            authToken = btoa(username + ':' + password);
            
            // Sauvegarder l'authentification
            localStorage.setItem('admin_auth', JSON.stringify({ username, password }));
            
            showAdminInterface();
            updateConnectionStatus(true); // Explicitement indiquer la connexion
            loadInitialData();
        } else {
            throw new Error('Authentification échouée');
        }
    } catch (error) {
        console.error("Erreur d'authentification:", error);
        updateConnectionStatus(false);
        throw error;
    }
}

function showAuthForm() {
    authForm.classList.remove('hidden');
    adminInterface.classList.add('hidden');
}

function showAdminInterface() {
    authForm.classList.add('hidden');
    adminInterface.classList.remove('hidden');
    updateConnectionStatus(true); // Forcer l'état connecté
    
    // Initialiser les contrôles admin maintenant que l'interface est visible
    initializeAdminControls();
}

// Fonction pour initialiser les contrôles admin après authentification
function initializeAdminControls() {
    console.log('🔧 Initialisation des contrôles admin...');
    
    // Initialiser les boutons de graphique et de tri
    const adminChartToggle = document.getElementById('admin-chart-toggle');
    const adminSortToggle = document.getElementById('admin-sort-toggle');
    const adminThemeSelect = document.getElementById('admin-theme-select');
    
    console.log('📋 Éléments trouvés:', {
        adminChartToggle: !!adminChartToggle,
        adminSortToggle: !!adminSortToggle,
        adminThemeSelect: !!adminThemeSelect
    });
    
    // Initialiser le sélecteur de thème admin
    if (adminThemeSelect) {
        const currentTheme = (localStorage.getItem('theme') === 'dark') ? 'dark' : 'light';
        adminThemeSelect.value = currentTheme;
        adminThemeSelect.addEventListener('change', (e) => {
            const t = e.target.value === 'dark' ? 'dark' : 'light';
            document.body.setAttribute('data-theme', t);
            localStorage.setItem('theme', t);
            // Synchroniser avec l'autre sélecteur
            const themeSelect = document.getElementById('theme-select');
            if (themeSelect) themeSelect.value = t;
            // Envoyer signal à l'interface principale
            localStorage.setItem('theme-sync-signal', Date.now().toString());
            console.log('🎨 Thème admin changé:', t);
        });
        console.log('✅ Sélecteur de thème admin initialisé');
    } else {
        console.warn('⚠️ Sélecteur de thème admin non trouvé');
    }
    
    // Initialiser le bouton de graphique admin
    if (adminChartToggle) {
        // Synchroniser l'état initial avec currentChartType depuis localStorage
        adminChartToggle.setAttribute('data-type', currentChartType);
        adminChartToggle.textContent = currentChartType === 'candlestick' ? '📊 Candlestick' : '📈 Linéaire';
        console.log('🔄 État initial du graphique admin synchronisé:', currentChartType);
        
        adminChartToggle.addEventListener('click', () => {
            // Marquer que le changement vient de l'admin pour éviter la boucle
            adminChartToggle.dataset.adminTriggered = 'true';
            
            // Changer le type de graphique
            if (currentChartType === 'candlestick') {
                currentChartType = 'line';
                adminChartToggle.setAttribute('data-type', 'line');
                adminChartToggle.textContent = '📈 Linéaire';
            } else {
                currentChartType = 'candlestick';
                adminChartToggle.setAttribute('data-type', 'candlestick');
                adminChartToggle.textContent = '📊 Candlestick';
            }
            
            // Sauvegarder dans localStorage
            localStorage.setItem('chart-type', currentChartType);
            
            // Synchroniser avec l'interface principale
            localStorage.setItem('chart-toggle-signal', Date.now().toString());
            console.log(`🔄 Bouton graphique admin cliqué: ${currentChartType}, signal envoyé`);
            
            // Nettoyer le marqueur après un délai
            setTimeout(() => {
                delete adminChartToggle.dataset.adminTriggered;
            }, 100);
        });
        console.log('✅ Bouton graphique admin initialisé');
    } else {
        console.warn('⚠️ Bouton admin-chart-toggle non trouvé');
    }
    
    // Initialiser le bouton de tri admin
    if (adminSortToggle) {
        // Synchroniser l'état initial avec sortMode depuis localStorage
        adminSortToggle.setAttribute('data-sort', sortMode);
        adminSortToggle.textContent = sortMode === 'price' ? '💰 Prix' : '🔤 A-Z';
        console.log('🔄 État initial du tri admin synchronisé:', sortMode);
        
        adminSortToggle.addEventListener('click', () => {
            // Marquer que le changement vient de l'admin pour éviter la boucle
            adminSortToggle.dataset.adminTriggered = 'true';
            
            // Changer le mode de tri
            if (sortMode === 'price') {
                sortMode = 'alphabetical';
                adminSortToggle.setAttribute('data-sort', 'alphabetical');
                adminSortToggle.textContent = '🔤 A-Z';
            } else {
                sortMode = 'price';
                adminSortToggle.setAttribute('data-sort', 'price');
                adminSortToggle.textContent = '💰 Prix';
            }
            
            // Sauvegarder dans localStorage
            localStorage.setItem('sort-mode', sortMode);
            
            // Synchroniser avec l'interface principale
            localStorage.setItem('sort-toggle-signal', Date.now().toString());
            console.log(`🔄 Bouton tri admin cliqué: ${sortMode}, signal envoyé`);
            
            // Nettoyer le marqueur après un délai
            setTimeout(() => {
                delete adminSortToggle.dataset.adminTriggered;
            }, 100);
        });
        console.log('✅ Bouton tri admin initialisé');
    } else {
        console.warn('⚠️ Bouton admin-sort-toggle non trouvé');
    }
}

function logout() {
    isAuthenticated = false;
    authToken = null;
    localStorage.removeItem('admin_auth');
    showAuthForm();
    stopAdminTimer(); // Arrêter le timer d'affichage
}

// Fonctions d'affichage des messages
function showMessage(elementId, message, type) {
    return;
//     const element = document.getElementById(elementId);
//     element.textContent = message;
//     element.className = `message ${type}`;
//     element.classList.remove('hidden');
//     // Affichage prolongé avec fondu
//     element.style.opacity = '1';
//     element.style.transition = 'opacity 0.6s ease';
//     setTimeout(() => {
//         element.style.opacity = '0';
//         setTimeout(() => {
//             element.classList.add('hidden');
//             // Reset pour prochains messages
//             element.style.opacity = '';
//             element.style.transition = '';
//         }, 600);
//     }, 10000);
}

// Chargement des données initiales
async function loadInitialData() {
  await Promise.all([
    loadDrinks(),
    loadPriceControls(),
    loadPurchaseTable(), // Contient déjà les prix, donc pas besoin de loadHistory() ici
    loadAdminDrinksList(),
  ]);
  
  // Charger les données Happy Hour après que le DOM soit prêt
  await loadHappyHourDrinks();
  
  // Charger l'historique et les Happy Hours actives séparément après un délai pour éviter la surcharge
  setTimeout(() => {
    loadHistory();
    loadActiveHappyHours();
  }, 1000);
  
  // Initialiser les graphiques
  initCharts();
  
  // SUPPRIMÉ : Pas de rafraîchissement automatique - seulement manuel
  // startAutoRefresh();
  
  // Rafraîchissement périodique de l'historique (toutes les 30 secondes)
  setInterval(() => {
    loadHistory();
  }, 30000);
  
  // Initialiser le timer admin synchronisé
  initAdminTimer();
}

// Remplir la liste déroulante avec les boissons
async function loadDrinks() {
  try {
        const res = await fetch(`${API_BASE}/admin/drinks`, {
            headers: { 'Authorization': 'Basic ' + authToken }
        });
    const data = await res.json();

    // Ancienne liste (pour compatibilité)
    const select = document.getElementById("drink");
    if (!select) {
      // Ignorer sans erreur si l'élément n'existe pas
      console.log("Élément select #drink non trouvé (normal si non utilisé)");
    } else {
      select.innerHTML = "";
      data.drinks.forEach(drink => {
        const option = document.createElement("option");
        option.value = drink.id;
        option.textContent = `${drink.name} – ${drink.price.toFixed(2)} €`;
        select.appendChild(option);
      });
    }

    updateConnectionStatus(true);
  } catch (error) {
    console.error("Erreur chargement boissons:", error);
        updateConnectionStatus(false);
    }
}

// Charger les statistiques
async function loadStats() {
    try {
        const res = await fetch(`${API_BASE}/admin/stats`, {
            headers: { 'Authorization': 'Basic ' + authToken }
        });
        const data = await res.json();

        const statsGrid = document.getElementById('stats-grid');
        if (!statsGrid) return; // Section stats retirée → no-op

        statsGrid.innerHTML = `
            <div class="stat-card">
                <div class="stat-value">${data.total_drinks}</div>
                <div class="stat-label">Boissons</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${data.total_transactions}</div>
                <div class="stat-label">Transactions</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${data.total_volume}</div>
                <div class="stat-label">Volume Total</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${data.average_price}€</div>
                <div class="stat-label">Prix Moyen</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${data.highest_price}€</div>
                <div class="stat-label">Prix Max</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${data.lowest_price}€</div>
                <div class="stat-label">Prix Min</div>
            </div>
        `;

        updateConnectionStatus(true);
    } catch (error) {
        console.error("Erreur chargement stats:", error);
        updateConnectionStatus(false);
    }
}

// Charger les contrôles de prix
async function loadPriceControls() {
    try {
        const res = await fetch(`${API_BASE}/admin/drinks`, {
            headers: { 'Authorization': 'Basic ' + authToken }
        });
        const data = await res.json();
        
        const priceControls = document.getElementById('price-controls');
        if (!priceControls) return; // Section supprimée dans l'UI simplifiée
        priceControls.innerHTML = '';
        
        data.drinks.forEach(drink => {
            const control = document.createElement('div');
            control.className = 'form-group';
            control.innerHTML = `
                <label>${drink.name} (${drink.min_price}€ - ${drink.max_price}€):</label>
                <div class="price-input">
                    <input type="number" 
                           id="price-${drink.id}" 
                           value="${drink.price.toFixed(2)}" 
                           min="${drink.min_price}" 
                           max="${drink.max_price}" 
                           step="0.01">
                    <button onclick="updatePrice(${drink.id})" class="btn">Mettre à jour</button>
                </div>
            `;
            priceControls.appendChild(control);
        });
    } catch (error) {
        console.error("Erreur chargement contrôles prix:", error);
    }
}

// Charger l'historique
async function loadHistory() {
    try {
        const res = await fetch(`${API_BASE}/admin/history?limit=50`, {
            headers: { 'Authorization': 'Basic ' + authToken }
        });
        const data = await res.json();
    // Ne garder que les achats (exclure variations: balance, correlation, crash, reset, etc.)
    const history = (data.history || [])
        .filter(entry => (entry.event || '').toLowerCase() === 'buy')
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        const tbody = document.getElementById('history-tbody');
        tbody.innerHTML = '';
        history.forEach(entry => {
            const row = document.createElement('tr');
            const time = new Date(entry.timestamp).toLocaleTimeString('fr-FR');
            const changeClass = entry.change > 0 ? 'up' : entry.change < 0 ? 'down' : 'neutral';
            const changeText = entry.change > 0 ? `+${entry.change.toFixed(2)}€` : 
                              entry.change < 0 ? `${entry.change.toFixed(2)}€` : '--';

            row.innerHTML = `
                <td data-label="Heure">${time}</td>
                <td data-label="Boisson">${entry.name}</td>
                <td data-label="Prix">${entry.price.toFixed(2)}€</td>
                <td data-label="Variation" class="${changeClass}">${changeText}</td>
                <td data-label="Actions">
                    <button class="btn btn-danger btn-icon btn-delete" title="Supprimer" aria-label="Supprimer">
                        🗑️
                    </button>
                </td>
            `;

            const deleteBtn = row.querySelector('.btn-delete');

            deleteBtn.addEventListener('click', async () => {
                try {
                    const res = await fetch(`${API_BASE}/admin/history/${entry.id}`, {
                        method: 'DELETE',
                        headers: { 'Authorization': 'Basic ' + authToken }
                    });
                    if (res.ok) {
                        
                        await loadHistory();
                        // loadPurchaseTable(); // SUPPRIMÉ - pas besoin de recharger les prix
                        // loadAdminDrinksList(); // SUPPRIMÉ - pas besoin de recharger les boissons
                    } else {
                        const err = await res.json();
                        showMessage('history-message', 'Erreur: ' + err.detail, 'error');
                    }
                } catch (error) {
                    showMessage('history-message', 'Erreur réseau lors de la suppression', 'error');
                }
            });

            tbody.appendChild(row);
        });
        
        document.getElementById('last-update').textContent = new Date().toLocaleTimeString('fr-FR');
    } catch (error) {
        console.error("Erreur chargement historique:", error);
    }
}

// Mettre à jour le prix d'une boisson
async function updatePrice(drinkId) {
    const priceInput = document.getElementById(`price-${drinkId}`);
    const newPrice = parseFloat(priceInput.value);
    
    if (isNaN(newPrice)) {
        showMessage('buy-message', 'Prix invalide', 'error');
        return;
    }
    
    try {
        const res = await fetch(`${API_BASE}/admin/drinks/${drinkId}/price`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Basic ' + authToken
            },
            body: JSON.stringify({ new_price: newPrice })
        });
        
        if (res.ok) {
            const data = await res.json();
            showMessage('buy-message', `Prix mis à jour: ${data.old_price}€ → ${data.new_price}€`, 'success');
            loadDrinks();
            loadPriceControls();
        } else {
            const err = await res.json();
            showMessage('buy-message', 'Erreur: ' + err.detail, 'error');
        }
    } catch (error) {
        showMessage('buy-message', 'Erreur de connexion', 'error');
    }
}

// Envoi d'un achat
// Note: L'ancien gestionnaire #buy-form a été supprimé car l'UI utilise une table avec un bouton #validate-purchase.

// Contrôles du marché
async function triggerCrash() {
    if (confirm('Êtes-vous sûr de vouloir déclencher un krach ? Tous les prix vont chuter brutalement !')) {
        try {
            const res = await fetch(`${API_BASE}/admin/market/crash`, {
                method: 'POST',
                headers: { 'Authorization': 'Basic ' + authToken }
            });
            
            if (res.ok) {
                showMessage('buy-message', '💥 Krach déclenché !', 'success');
                loadDrinks();
                loadPriceControls();
                loadStats();
            }
        } catch (error) {
            showMessage('buy-message', 'Erreur lors du déclenchement du krach', 'error');
        }
    }
}

async function resetMarket() {
    if (confirm('Êtes-vous sûr de vouloir réinitialiser tous les prix à leur valeur de base ?')) {
        try {
            const res = await fetch(`${API_BASE}/admin/market/reset`, {
                method: 'POST',
                headers: { 'Authorization': 'Basic ' + authToken }
            });
            
            if (res.ok) {
                showMessage('buy-message', '🔄 Marché réinitialisé !', 'success');
                loadDrinks();
                loadPriceControls();
                loadStats();
            }
        } catch (error) {
            showMessage('buy-message', 'Erreur lors de la réinitialisation', 'error');
        }
    }
}

async function refreshData() {
    try {
        // Une seule requête pour les prix publics (plus efficace)
        const pricesRes = await fetch(`${API_BASE}/prices`);
        const pricesData = await pricesRes.json();
        const drinks = pricesData.prices || [];

        // Mettre à jour le tableau d'achat avec les nouveaux prix
        updatePurchaseTablePrices(drinks);

        if (typeof wallStreetCharts !== 'undefined' && wallStreetCharts) {
            const beerPrices = drinks.filter(d => (d.type || '').toLowerCase() === 'beer').map(d => d.price);
            wallStreetCharts.updatePriceChart(beerPrices, true);
            // wallStreetCharts.updateVolumeChart(history); // SUPPRIMÉ pour éviter la requête histoire
        }
        
        // Message discret - pas à chaque refresh
        // showMessage('buy-message', '🔄 Données actualisées !', 'success'); // SUPPRIMÉ
    } catch (e) {
        console.error('Erreur refreshData:', e);
    }
}

// Rafraîchissement manuel simple (1 seule requête)
async function manualRefresh() {
    try {
        const response = await fetch(`${API_BASE}/prices`);
        if (!response.ok) throw new Error('Erreur réseau');
        
        const data = await response.json();
        const drinks = data.prices || [];
        
        updatePurchaseTablePrices(drinks);
        showMessage('buy-message', '🔄 Prix actualisés !', 'success');
        
    } catch (error) {
        console.error('Erreur lors du rafraîchissement:', error);
        showMessage('buy-message', '❌ Erreur de rafraîchissement', 'error');
    }
}

// Mise à jour du statut de connexion
function updateConnectionStatus(connected) {
    const indicator = document.getElementById('connection-status');
    const text = document.getElementById('connection-text');
    
    if (connected) {
        indicator.className = 'status-indicator status-connected';
        text.textContent = 'Connecté';
    } else {
        indicator.className = 'status-indicator status-disconnected';
        text.textContent = 'Déconnecté';
    }
}

// (Simplified) Plus de statut de marché détaillé dans l'UI

// (Simplified) Événements spéciaux retirés de l'UI


// (Simplified) Export et rapports retirés de l'UI

function initCharts() {
  if (typeof WallStreetCharts !== 'undefined') {
    wallStreetCharts = new WallStreetCharts();
  }
}

// (Simplified) Export des graphiques retiré

// (Simplified) Système de notifications retiré

// (Simplified) Suppression du duplicat de startAutoRefresh et de l'ID inexistant 'refresh-timer'

// Gestion des erreurs globales
window.addEventListener('error', (event) => {
    console.error('Erreur JavaScript:', event.error);
    updateConnectionStatus(false);
});

// Gestion du compteur d'actualisation des prix
let timerInterval = null;

function startPriceRefreshTimer() { return; }

// Ajouter un écouteur d'événement pour le bouton
const startTimerButton = document.getElementById('start-timer');
if (startTimerButton) {
    startTimerButton.addEventListener('click', startPriceRefreshTimer);
}

// Gestion des modes d'évolution des prix
const transactionModeElement = document.getElementById('transaction-mode');
if (transactionModeElement) {
    transactionModeElement.addEventListener('change', () => {
        priceUpdateMode = 'transaction';
        stopAdminTimer(); // Arrêter le timer d'affichage si actif
    });
}

const timerModeElement = document.getElementById('timer-mode');
if (timerModeElement) {
    timerModeElement.addEventListener('change', () => {
        priceUpdateMode = 'timer';
        // SUPPRIMÉ : Pas de rafraîchissement automatique 
        // startAutoRefresh(); // Démarrer le timer
    });
}

// Gestion de l'intervalle d'actualisation
const refreshIntervalForm = document.getElementById('refresh-interval-form');
if (refreshIntervalForm) {
    refreshIntervalForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const intervalInput = document.getElementById('refresh-interval');
        if (!intervalInput) return;
        
        const intervalSec = parseInt(intervalInput.value, 10);
        const intervalMs = intervalSec * 1000; // Convertir en millisecondes

        if (isNaN(intervalSec) || intervalSec < 0) {
            alert('Veuillez entrer un intervalle valide (0 ou plus).');
            return;
        }

        try {
            // Envoyer la configuration au serveur
            const response = await fetch(`${API_BASE}/config/interval`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Basic ' + authToken
                },
                body: JSON.stringify({ interval_ms: intervalMs })
            });

            if (!response.ok) {
                throw new Error('Erreur serveur');
            }

            // 1. Stocker l'intervalle en millisecondes (même format que app.js)
            localStorage.setItem('refreshInterval', intervalMs);
            
            // 2. Gérer les différents modes
            if (intervalMs === 0) {
                // Mode transaction immédiate
                stopAdminTimer();
                alert(`✅ Mode TRANSACTION IMMÉDIATE activé!\n🚀 Tous les prix s'actualisent à chaque achat\n📈 Effet de marché complet instantané\nTimer désactivé`);
            } else {
                // Mode timer normal
                // 3. Pour forcer la synchronisation avec d'autres onglets, utiliser une clé temporaire
                localStorage.setItem('refreshUpdate', Date.now());
                
                // 4. Démarrer le timer d'affichage du countdown
                startAdminTimer();
                
                alert(`✅ Mode TIMER activé: ${intervalSec} secondes\n🕒 Les prix évoluent automatiquement\nLes autres onglets seront synchronisés automatiquement.`);
            }
            
        } catch (error) {
            console.error('Erreur lors de la mise à jour de l\'intervalle:', error);
            alert('❌ Erreur lors de la mise à jour de l\'intervalle');
        }
    });
}

// Charger les boissons dans le tableau d'achat (dynamique)
async function loadPurchaseTable() {
    const tableBody = document.querySelector('#purchase-table tbody');
    if (!tableBody) return;
    tableBody.innerHTML = '';

    try {
        // Récupérer les prix publics ET les infos admin pour les min/max
        const [publicRes, adminRes] = await Promise.all([
            fetch(`${API_BASE}/prices`),
            fetch(`${API_BASE}/admin/drinks`, { headers: { 'Authorization': 'Basic ' + authToken } })
        ]);
        
        const publicData = await publicRes.json();
        const adminData = await adminRes.json();
        
        // Créer un map des infos admin pour référence rapide
        const adminInfo = {};
        (adminData.drinks || []).forEach(drink => {
            adminInfo[drink.id] = drink;
        });
        
        // Trier les bières par ordre alphabétique
        const sortedDrinks = (publicData.prices || []).sort((a, b) => a.name.localeCompare(b.name));
        
        sortedDrinks.forEach(drink => {
            const adminInfo_drink = adminInfo[drink.id] || { min_price: 0, max_price: 100 };
            const row = document.createElement('tr');
            row.innerHTML = `
                <td data-label="Boisson">${drink.name} <span class="alcohol-degree">${drink.alcohol_degree || 0}°</span></td>
                <td data-label="Prix Min/Max (€)">
                  <span class="price-range">
                    <span class="min-price">${adminInfo_drink.min_price}€</span> - 
                    <span class="max-price">${adminInfo_drink.max_price}€</span>
                  </span>
                </td>
                <td data-label="Prix Exact (€)">
                  <span class="price-exact-display" data-id="${drink.id}">${drink.price.toFixed(2)}€</span>
                  <input class="price-edit hidden" data-id="${drink.id}" type="number" step="0.01" min="${adminInfo_drink.min_price}" max="${adminInfo_drink.max_price}" value="${drink.price.toFixed(2)}">
                </td>
                <td data-label="Prix Affiché (€)">
                  <span class="price-rounded-display" data-id="${drink.id}">${drink.price_rounded.toFixed(1)}€</span>
                </td>
                <td data-label="Actions">
                  <button class="btn" data-action="buy" data-id="${drink.id}" data-name="${drink.name}">Ajouter</button>
                </td>
            `;

            const priceExactDisplay = row.querySelector('.price-exact-display');
            const priceInput = row.querySelector('.price-edit');
            const buyBtn = row.querySelector('[data-action="buy"]');

            // Inline edit on price click
            priceExactDisplay.addEventListener('click', () => {
                priceExactDisplay.classList.add('hidden');
                priceInput.classList.remove('hidden');
                priceInput.focus();
                priceInput.select();
            });

            async function savePrice() {
                const newPrice = parseFloat(priceInput.value);
                if (isNaN(newPrice) || newPrice < parseFloat(adminInfo_drink.min_price) || newPrice > parseFloat(adminInfo_drink.max_price)) {
                    showMessage('buy-message', `Prix invalide pour ${drink.name}. Doit être entre ${adminInfo_drink.min_price}€ et ${adminInfo_drink.max_price}€.`, 'error');
                    priceInput.value = drink.price.toFixed(2);
                    return;
                }

                try {
                    const res = await fetch(`${API_BASE}/admin/drinks/${drink.id}/price`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': 'Basic ' + authToken
                        },
                        body: JSON.stringify({ new_price: newPrice })
                    });

                    if (res.ok) {
                        drink.price = newPrice;
                        priceView.textContent = `${newPrice.toFixed(2)}€`;
                        priceInput.value = newPrice.toFixed(2);
                        
                        // Remettre l'affichage normal après la sauvegarde
                        priceInput.classList.add('hidden');
                        priceExactDisplay.classList.remove('hidden');
                        
                        showMessage('buy-message', `Prix de ${drink.name} mis à jour: ${newPrice.toFixed(2)}€`, 'success');
                    } else {
                        throw new Error('Erreur serveur');
                    }
                } catch (error) {
                    showMessage('buy-message', `Erreur lors de la mise à jour du prix de ${drink.name}`, 'error');
                    priceInput.value = drink.price.toFixed(2);
                    
                    // Remettre l'affichage normal même en cas d'erreur
                    priceInput.classList.add('hidden');
                    priceExactDisplay.classList.remove('hidden');
                }
            }

            priceInput.addEventListener('blur', savePrice);
            priceInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    savePrice();
                }
                if (e.key === 'Escape') {
                    priceInput.value = drink.price.toFixed(2);
                    priceInput.classList.add('hidden');
                    priceExactDisplay.classList.remove('hidden');
                }
            });

            buyBtn.addEventListener('click', (e) => {
                // Empêcher le comportement par défaut et le scroll automatique
                e.preventDefault();
                e.stopPropagation();
                
                // Ajouter l'animation de clic
                buyBtn.classList.add('btn-click-animation');
                
                // Retirer l'animation après qu'elle soit terminée
                setTimeout(() => {
                    buyBtn.classList.remove('btn-click-animation');
                }, 300);
                
                priceInput.classList.add('hidden');
                priceExactDisplay.classList.remove('hidden');
                recordPurchase(drink.id, drink.name, drink.price);
            });

            tableBody.appendChild(row);
        });
    } catch (error) {
        console.error('Erreur loadPurchaseTable:', error);
    }
}

// Mettre à jour seulement les prix dans le tableau d'achat (synchronisation automatique)
function updatePurchaseTablePrices(drinks) {
    const tableBody = document.querySelector('#purchase-table tbody');
    if (!tableBody || !drinks) return;

    drinks.forEach(drink => {
        // Sélecteurs pour les nouvelles colonnes séparées
        const priceExactDisplay = tableBody.querySelector(`.price-exact-display[data-id="${drink.id}"]`);
        const priceRoundedDisplay = tableBody.querySelector(`.price-rounded-display[data-id="${drink.id}"]`);
        const priceInput = tableBody.querySelector(`.price-edit[data-id="${drink.id}"]`);
        
        if (priceExactDisplay && priceRoundedDisplay && priceInput) {
            // Mettre à jour les prix affichés seulement si l'input n'est pas en cours d'édition
            if (priceInput.classList.contains('hidden')) {
                priceExactDisplay.textContent = `${drink.price.toFixed(2)}€`;
                priceRoundedDisplay.textContent = `${drink.price_rounded.toFixed(1)}€`;
                priceInput.value = drink.price.toFixed(2);
            }
            
            // Mettre à jour les limites min/max au cas où elles auraient changé
            if (drink.min_price !== undefined) priceInput.min = drink.min_price;
            if (drink.max_price !== undefined) priceInput.max = drink.max_price;
            // S'assurer que l'état d'affichage est cohérent
            if (!priceInput.classList.contains('hidden') && !priceExactDisplay.classList.contains('hidden')) {
                // Si les deux sont visibles, cacher le prix exact (priorité à l'édition)
                priceExactDisplay.classList.add('hidden');
            }
        }
    });
    
    // Ajouter un indicateur visuel de mise à jour
    const tableContainer = tableBody.closest('.admin-card');
    if (tableContainer) {
        tableContainer.style.border = '2px solid #00ff41';
        setTimeout(() => {
            tableContainer.style.border = '';
        }, 1000);
    }
    
    // Nettoyer l'état d'affichage après la mise à jour
    setTimeout(() => cleanupPriceDisplay(), 100);
}

// Fonction pour enregistrer un achat
async function recordPurchase(drinkId, drinkName, drinkPrice) {
    // Sauvegarder la position de scroll avant l'achat
    const scrollPosition = window.pageYOffset || document.documentElement.scrollTop;
    
    try {
        const response = await fetch(`${API_BASE}/buy`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                drink_id: drinkId,
                quantity: 1
            })
        });

        if (response.ok) {
            const result = await response.json();
            showMessage('buy-message', `✅ Achat enregistré: ${drinkName} - ${drinkPrice.toFixed(2)}€`, 'success');
            
            // Mettre à jour seulement les prix dans le tableau (sans recharger tout)
            await updatePurchaseTablePricesFromAPI();
            
            // NOUVEAU : Recharger l'historique après un achat
            await loadHistory();
            
            // NOUVEAU : Déclencher la mise à jour des graphiques dans app.js
            console.log('📡 Envoi du signal de mise à jour vers app.js');
            localStorage.setItem('purchaseUpdate', Date.now());
            
            // Restaurer l'état des sections accordéon
            setTimeout(() => {
                restoreSectionStates();
                window.scrollTo(0, scrollPosition);
            }, 50);
            
        } else {
            const error = await response.json();
            showMessage('buy-message', `❌ Erreur achat: ${error.detail || 'Erreur inconnue'}`, 'error');
        }
        
    } catch (error) {
        console.error('Erreur lors de l\'enregistrement de l\'achat:', error);
        showMessage('buy-message', '❌ Erreur de connexion lors de l\'achat', 'error');
    }
}

// Nouvelle fonction pour mettre à jour seulement les prix sans recharger le tableau
async function updatePurchaseTablePricesFromAPI() {
    try {
        const response = await fetch(`${API_BASE}/prices`);
        if (!response.ok) return;
        
        const data = await response.json();
        const drinks = data.prices || [];
        
        // Utiliser la fonction existante pour mettre à jour les prix
        updatePurchaseTablePrices(drinks);
        
        // Nettoyer l'état d'affichage pour éviter les doublons
        cleanupPriceDisplay();
        
    } catch (error) {
        console.error('Erreur lors de la mise à jour des prix:', error);
    }
}

// Fonction utilitaire pour nettoyer l'état d'affichage des prix
function cleanupPriceDisplay() {
    const tableBody = document.querySelector('#purchase-table tbody');
    if (!tableBody) return;
    
    // S'assurer qu'il n'y a pas de doublons d'affichage
    tableBody.querySelectorAll('tr').forEach(row => {
        const priceView = row.querySelector('.price-view');
        const priceInput = row.querySelector('.price-edit');
        
        if (priceView && priceInput) {
            // Si les deux sont visibles, privilégier l'input (mode édition)
            if (!priceInput.classList.contains('hidden') && !priceView.classList.contains('hidden')) {
                priceView.classList.add('hidden');
            }
            // Si les deux sont cachés, afficher le price-view
            else if (priceInput.classList.contains('hidden') && priceView.classList.contains('hidden')) {
                priceView.classList.remove('hidden');
            }
        }
    });
}

// Fonctions pour les événements de marché
async function triggerMarketCrash(level = 'medium') {
    const levelMessages = {
        'small': 'un PETIT CRASH (baisse de 5% à 15%)',
        'medium': 'un CRASH MOYEN (baisse de 10% à 30%)', 
        'large': 'un GROS CRASH (baisse de 20% à 50%)',
        'maximum': 'un CRASH MAXIMAL (prix minimum pour toutes les boissons)'
    };
    
    const message = levelMessages[level] || levelMessages['medium'];
    
    if (!confirm(`💥 Déclencher ${message} ? Tous les prix vont chuter !`)) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/admin/market/crash?level=${level}`, {
            method: 'POST',
            headers: { 
                'Authorization': 'Basic ' + authToken,
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            const result = await response.json();
            showMessage('history-message', `📉 CRASH ${level.toUpperCase()} DÉCLENCHÉ ! Toutes les bières impactées`, 'success');
            
            // Rafraîchir toutes les données admin
            await loadPurchaseTable();
            await loadHistory();
            await loadAdminDrinksList();
            
            // Déclencher actualisation immédiate côté client + reset compteur
            await triggerImmediateRefresh();
            
        } else {
            const error = await response.json();
            showMessage('history-message', `❌ Erreur crash: ${error.detail || 'Erreur inconnue'}`, 'error');
        }
        
    } catch (error) {
        console.error('Erreur lors du déclenchement du krash:', error);
        showMessage('history-message', '❌ Erreur de connexion lors du krash', 'error');
    }
}

async function triggerMarketBoom(level = 'medium') {
    const levelMessages = {
        'small': 'un PETIT BOOM (hausse de 5% à 15%)',
        'medium': 'un BOOM MOYEN (hausse de 10% à 30%)', 
        'large': 'un GROS BOOM (hausse de 20% à 50%)',
        'maximum': 'un BOOM MAXIMAL (prix maximum pour toutes les boissons)'
    };
    
    const message = levelMessages[level] || levelMessages['medium'];
    
    if (!confirm(`🚀 Déclencher ${message} ? Tous les prix vont exploser à la hausse !`)) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/admin/market/boom?level=${level}`, {
            method: 'POST',
            headers: { 
                'Authorization': 'Basic ' + authToken,
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            const result = await response.json();
            showMessage('history-message', `📈 BOOM ${level.toUpperCase()} DÉCLENCHÉ ! Toutes les bières impactées`, 'success');
            
            // Rafraîchir toutes les données admin
            await loadPurchaseTable();
            await loadHistory();
            await loadAdminDrinksList();
            
            // Déclencher actualisation immédiate côté client + reset compteur
            await triggerImmediateRefresh();
            
        } else {
            const error = await response.json();
            showMessage('history-message', `❌ Erreur boom: ${error.detail || 'Erreur inconnue'}`, 'error');
        }
        
    } catch (error) {
        console.error('Erreur lors du déclenchement du boom:', error);
        showMessage('history-message', '❌ Erreur de connexion lors du boom', 'error');
    }
}

async function triggerMarketFluctuations() {
    if (!confirm('📊 Déclencher des fluctuations naturelles du marché ? Cela va appliquer des variations légères (-2% à +2%) sur environ 30% des boissons.')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/admin/market/fluctuate`, {
            method: 'POST',
            headers: { 
                'Authorization': 'Basic ' + authToken,
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            const result = await response.json();
            showMessage('history-message', `📊 Fluctuations appliquées ! ${result.changes_count} prix modifiés`, 'success');
            
            // Rafraîchir toutes les données admin
            await loadPurchaseTable();
            await loadHistory();
            await loadAdminDrinksList();
            
            // Déclencher actualisation immédiate côté client + reset compteur
            await triggerImmediateRefresh();
            
        } else {
            const error = await response.json();
            showMessage('history-message', `❌ Erreur fluctuations: ${error.detail || 'Erreur inconnue'}`, 'error');
        }
        
    } catch (error) {
        console.error('Erreur lors des fluctuations:', error);
        showMessage('history-message', '❌ Erreur de connexion lors des fluctuations', 'error');
    }
}

// ========== Fonctions Happy Hour ==========

async function loadHappyHourDrinks() {
    try {
        const response = await fetch(`${API_BASE}/admin/drinks`, {
            headers: { 'Authorization': 'Basic ' + authToken }
        });
        
        if (response.ok) {
            const data = await response.json();
            const drinks = data.drinks || []; // Accéder à la propriété drinks
            const select = document.getElementById('happyHourDrinkSelect');
            
            if (!select) {
                console.error('Element happyHourDrinkSelect not found');
                return;
            }
            
            // Vider la liste
            select.innerHTML = '<option value="">Sélectionner une boisson...</option>';
            
            // Ajouter chaque boisson
            drinks.forEach(drink => {
                const option = document.createElement('option');
                option.value = drink.id;
                option.textContent = `${drink.name} (${drink.price.toFixed(2)}€)`;
                select.appendChild(option);
            });
            
            console.log(`Loaded ${drinks.length} drinks for Happy Hour selector`);
        } else {
            console.error('Failed to load drinks for Happy Hour');
        }
    } catch (error) {
        console.error('Erreur lors du chargement des boissons pour Happy Hour:', error);
    }
}

async function startHappyHour() {
    const drinkId = document.getElementById('happyHourDrinkSelect').value;
    const duration = parseInt(document.getElementById('happyHourDuration').value);
    
    if (!drinkId) {
        showMessage('history-message', '❌ Veuillez sélectionner une boisson', 'error');
        return;
    }
    
    if (!duration || duration < 10 || duration > 7200) {
        showMessage('history-message', '❌ Durée invalide (10-7200 secondes)', 'error');
        return;
    }
    
    const drinkName = document.getElementById('happyHourDrinkSelect').selectedOptions[0].textContent;
    
    if (!confirm(`🌟 Démarrer une Happy Hour pour ${drinkName} pendant ${duration} secondes ?`)) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/admin/happy-hour/start`, {
            method: 'POST',
            headers: {
                'Authorization': 'Basic ' + authToken,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                drink_id: parseInt(drinkId),
                duration: duration
            })
        });

        if (response.ok) {
            const result = await response.json();
            showMessage('history-message', `🌟 Happy Hour démarrée pour ${result.data.drink_name} !`, 'success');
            
            // Signal pour l'interface publique d'actualiser ce graphique spécifique
            localStorage.setItem('happy-hour-started', JSON.stringify({
                drinkId: parseInt(drinkId),
                timestamp: Date.now()
            }));
            
            // Actualiser les données
            await loadActiveHappyHours();
            await loadHistory();
            
            // Réinitialiser le formulaire
            document.getElementById('happyHourDrinkSelect').value = '';
            document.getElementById('happyHourDuration').value = '300';
            
        } else {
            const error = await response.json();
            showMessage('history-message', `❌ Erreur Happy Hour: ${error.detail || 'Erreur inconnue'}`, 'error');
        }
        
    } catch (error) {
        console.error('Erreur lors du démarrage de la Happy Hour:', error);
        showMessage('history-message', '❌ Erreur de connexion lors du démarrage', 'error');
    }
}

async function stopAllHappyHours() {
    if (!confirm('🛑 Arrêter toutes les Happy Hours actives ?')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/admin/happy-hour/stop-all`, {
            method: 'POST',
            headers: {
                'Authorization': 'Basic ' + authToken,
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            const result = await response.json();
            showMessage('history-message', `🛑 ${result.count} Happy Hour(s) arrêtée(s)`, 'success');
            
            // Signal pour l'interface publique d'actualiser tous les graphiques
            localStorage.setItem('happy-hour-all-stopped', JSON.stringify({
                timestamp: Date.now()
            }));
            
            // Actualiser les données
            await loadActiveHappyHours();
            await loadHistory();
            
        } else {
            const error = await response.json();
            showMessage('history-message', `❌ Erreur: ${error.detail || 'Erreur inconnue'}`, 'error');
        }
        
    } catch (error) {
        console.error('Erreur lors de l\'arrêt des Happy Hours:', error);
        showMessage('history-message', '❌ Erreur de connexion', 'error');
    }
}

async function stopHappyHour(drinkId) {
    try {
        const response = await fetch(`${API_BASE}/admin/happy-hour/stop/${drinkId}`, {
            method: 'POST',
            headers: {
                'Authorization': 'Basic ' + authToken,
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            showMessage('history-message', '🛑 Happy Hour arrêtée', 'success');
            
            // Signal pour l'interface publique d'actualiser ce graphique spécifique
            localStorage.setItem('happy-hour-stopped', JSON.stringify({
                drinkId: parseInt(drinkId),
                timestamp: Date.now()
            }));
            
            await loadActiveHappyHours();
            await loadHistory();
        } else {
            const error = await response.json();
            showMessage('history-message', `❌ Erreur: ${error.detail || 'Erreur inconnue'}`, 'error');
        }
        
    } catch (error) {
        console.error('Erreur lors de l\'arrêt de la Happy Hour:', error);
        showMessage('history-message', '❌ Erreur de connexion', 'error');
    }
}

let happyHourAdminTimerIntervalId = null; // Timer pour l'interface admin

async function loadActiveHappyHours() {
    try {
        const response = await fetch(`${API_BASE}/admin/happy-hour/active`, {
            headers: { 'Authorization': 'Basic ' + authToken }
        });
        
        if (response.ok) {
            const data = await response.json();
            const container = document.getElementById('happy-hours-list');
            
            if (data.active_happy_hours.length === 0) {
                container.innerHTML = '<p style="color: #666; font-style: italic; margin: 0; font-size: 0.9em;">Aucune Happy Hour active</p>';
                // Arrêter le timer s'il n'y a plus de Happy Hours
                if (happyHourAdminTimerIntervalId) {
                    clearInterval(happyHourAdminTimerIntervalId);
                    happyHourAdminTimerIntervalId = null;
                }
            } else {
                container.innerHTML = data.active_happy_hours.map(hh => {
                    // Utiliser les données du serveur directement
                    const remaining = Math.max(0, hh.remaining || 0);
                    const minutes = Math.floor(remaining / 60);
                    const seconds = remaining % 60;
                    
                    return `
                        <div style="background: white; padding: 8px; margin: 4px 0; border-radius: 5px; display: flex; justify-content: space-between; align-items: center; border-left: 4px solid #FFD700; font-size: 0.9em;" data-remaining="${remaining}">
                            <div>
                                <strong>🌟 ${hh.drink_name}</strong><br>
                                <small class="happy-hour-countdown">⏱️ ${minutes}:${seconds.toString().padStart(2,'0')}</small>
                            </div>
                            <button onclick="stopHappyHour(${hh.drink_id})" class="btn btn-danger" style="font-size: 0.8em; padding: 4px 8px;">
                                🛑 Arrêter
                            </button>
                        </div>
                    `;
                }).join('');
                
                // Démarrer le timer de mise à jour si pas déjà actif
                if (!happyHourAdminTimerIntervalId) {
                    startHappyHourAdminTimer();
                }
            }
        }
    } catch (error) {
        console.error('Erreur lors du chargement des Happy Hours actives:', error);
    }
}

// Timer pour mettre à jour l'interface admin en temps réel
function startHappyHourAdminTimer() {
    happyHourAdminTimerIntervalId = setInterval(() => {
        const happyHourElements = document.querySelectorAll('[data-remaining]');
        let activeCount = 0;
        
        happyHourElements.forEach(element => {
            const remaining = parseInt(element.getAttribute('data-remaining'));
            
            if (!isNaN(remaining) && remaining > 0) {
                // Décrémenter le temps restant
                const newRemaining = Math.max(0, remaining - 1);
                element.setAttribute('data-remaining', newRemaining);
                
                const minutes = Math.floor(newRemaining / 60);
                const seconds = newRemaining % 60;
                const countdownElement = element.querySelector('.happy-hour-countdown');
                if (countdownElement) {
                    countdownElement.textContent = `⏱️ ${minutes}:${seconds.toString().padStart(2,'0')}`;
                }
                
                if (newRemaining > 0) {
                    activeCount++;
                }
            } else if (remaining === 0) {
                // Happy Hour terminé, recharger la liste
                loadActiveHappyHours();
                return;
            }
        });
        
        // Si plus de Happy Hours actives, arrêter le timer
        if (activeCount === 0) {
            clearInterval(happyHourAdminTimerIntervalId);
            happyHourAdminTimerIntervalId = null;
        }
    }, 1000);
}

// Fonction pour le toggle du menu déroulant des boissons existantes
function toggleDrinksTable() {
    const container = document.getElementById('drinks-table-container');
    const icon = document.getElementById('drinks-toggle-icon');
    
    if (container.style.display === 'none') {
        container.style.display = 'block';
        icon.textContent = '▲';
        icon.classList.add('rotated');
        // Charger les données si le menu s'ouvre
        loadAdminDrinksList();
    } else {
        container.style.display = 'none';
        icon.textContent = '▼';
        icon.classList.remove('rotated');
    }
}

function adjustQuantity() { return; }

async function validatePurchase() { return; }

// Le tableau d'achat et la liste admin sont chargés après authentification via loadInitialData()

// ============ SYSTÈME DE TIMER ET PRÉDICTION DE PRIX ============

// Fonction pour calculer le prix suivant basé sur l'historique
function calculateNextPrice(drinkId, currentPrice, minPrice, maxPrice) {
    // Algorithme simplifié de prédiction basé sur la tendance récente
    // En production, ceci pourrait être plus sophistiqué
    const variation = (Math.random() - 0.5) * 0.5; // Variation de ±0.25€
    const nextPrice = Math.max(minPrice, Math.min(maxPrice, currentPrice + variation));
    return parseFloat(nextPrice.toFixed(2));
}

// Fonction pour synchroniser l'intervalle avec app.js
function syncRefreshInterval() {
    const storedInterval = localStorage.getItem('refreshInterval');
    if (storedInterval) {
        const intervalMs = parseInt(storedInterval, 10);
        if (!isNaN(intervalMs) && intervalMs > 0) {
            return intervalMs;
        }
    }
    return 10000; // Défaut: 10 secondes
}

// Fonction pour mettre à jour le timer admin
function updateAdminTimer() {
    const timerElement = document.getElementById('admin-timer');
    if (!timerElement) {
        console.warn('⚠️ Élément timer admin introuvable');
        return;
    }
    
    if (adminCountdown <= 1) {
        adminCountdown = Math.ceil(syncRefreshInterval() / 1000);
        // Lors du changement, actualiser les prix prédits
        console.log('🔄 Mise à jour des prédictions de prix...');
        updatePricePredictions();
    } else {
        adminCountdown = adminCountdown - 1;
    }
    
    timerElement.textContent = `${adminCountdown}s`;
}

// Fonction pour démarrer le timer admin
function startAdminTimer() {
    stopAdminTimer();
    adminCountdown = Math.ceil(syncRefreshInterval() / 1000);
    adminTimerInterval = setInterval(updateAdminTimer, 1000);
    updateAdminTimer(); // Mise à jour immédiate
}

// Fonction pour arrêter le timer admin
function stopAdminTimer() {
    if (adminTimerInterval) {
        clearInterval(adminTimerInterval);
        adminTimerInterval = null;
    }
}

// Fonction pour charger et afficher les prédictions de prix
async function updatePricePredictions() {
    try {
        console.log('📊 Chargement des prédictions de prix...');
        
        // Récupérer les prix actuels depuis l'API publique
        const publicRes = await fetch(`${API_BASE}/prices`);
        const publicData = await publicRes.json();
        
        // Récupérer les informations admin pour min/max
        const adminRes = await fetch(`${API_BASE}/admin/drinks`, {
            headers: { 'Authorization': 'Basic ' + authToken }
        });
        const adminData = await adminRes.json();
        
        // Créer un map des infos admin
        const adminInfo = {};
        (adminData.drinks || []).forEach(drink => {
            adminInfo[drink.id] = drink;
        });
        
        // Calculer les prix suivants
        (publicData.prices || []).forEach(drink => {
            const admin = adminInfo[drink.id];
            if (admin) {
                currentPrices[drink.id] = drink.price;
                nextPrices[drink.id] = calculateNextPrice(
                    drink.id, 
                    drink.price, 
                    admin.min_price, 
                    admin.max_price
                );
            }
        });
        
        console.log('💰 Prix actuels:', currentPrices);
        console.log('🔮 Prix prédits:', nextPrices);
        
        // Mettre à jour l'affichage dans le tableau d'achat
        updatePriceDisplayInTable();
        
    } catch (error) {
        console.error('❌ Erreur lors de la mise à jour des prédictions:', error);
    }
}

// Fonction pour mettre à jour l'affichage des prix dans le tableau
function updatePriceDisplayInTable() {
    const tableBody = document.querySelector('#purchase-table tbody');
    if (!tableBody) return;
    
    tableBody.querySelectorAll('tr').forEach(row => {
        const priceCell = row.querySelector('td[data-label="Prix (€)"]');
        if (!priceCell) return;
        
        const priceView = priceCell.querySelector('.price-view');
        if (!priceView) return;
        
        const drinkId = priceView.getAttribute('data-id');
        if (!drinkId || !currentPrices[drinkId]) return;
        
        const currentPrice = currentPrices[drinkId];
        
        // Afficher seulement le prix actuel, sans les flèches et prix suivants
        priceView.innerHTML = `${currentPrice.toFixed(2)}€`;
    });
}

// Fonction pour écouter les changements d'intervalle depuis localStorage
function listenForIntervalChanges() {
    window.addEventListener('storage', (e) => {
        if (e.key === 'refreshInterval' || e.key === 'refreshUpdate') {
            // Redémarrer le timer avec le nouvel intervalle
            startAdminTimer();
            updatePricePredictions();
        }
    });
}

// Fonction pour initialiser le système de timer admin
function initAdminTimer() {
    console.log('🚀 Initialisation du timer admin...');
    
    // Démarrer le timer
    startAdminTimer();
    
    // Charger les prédictions initiales
    updatePricePredictions();
    
    // Écouter les changements d'intervalle
    listenForIntervalChanges();
    
    // SUPPRIMÉ : Pas de mise à jour automatique des prédictions
    // setInterval(updatePricePredictions, syncRefreshInterval());
    
    console.log('✅ Timer admin initialisé avec succès');
}

// Fonction de débogage (accessible via console)
window.debugAdminTimer = function() {
    console.log('🔧 DEBUG - État du Timer Admin:');
    console.log('- Timer actif:', !!adminTimerInterval);
    console.log('- Countdown actuel:', adminCountdown);
    console.log('- Intervalle sync:', syncRefreshInterval(), 'ms');
    console.log('- Prix actuels:', currentPrices);
    console.log('- Prix prédits:', nextPrices);
    console.log('- Élément timer DOM:', !!document.getElementById('admin-timer'));
};

// Gestion des sections accordéon avec sauvegarde d'état
let sectionStates = {};

function toggleSection(sectionId) {
    const section = document.getElementById(sectionId);
    const toggleIcon = document.getElementById(sectionId.replace('-section', '-toggle'));
    
    if (!section || !toggleIcon) return;
    
    const isActive = section.classList.contains('active');
    
    if (isActive) {
        // Fermer la section
        section.classList.remove('active');
        toggleIcon.classList.remove('rotated');
        toggleIcon.textContent = '▼';
        sectionStates[sectionId] = false;
    } else {
        // Ouvrir la section
        section.classList.add('active');
        toggleIcon.classList.add('rotated');
        toggleIcon.textContent = '▲';
        sectionStates[sectionId] = true;
    }
}

// Fonction pour restaurer l'état des sections
function restoreSectionStates() {
    Object.keys(sectionStates).forEach(sectionId => {
        if (sectionStates[sectionId]) {
            const section = document.getElementById(sectionId);
            const toggleIcon = document.getElementById(sectionId.replace('-section', '-toggle'));
            
            if (section && toggleIcon && !section.classList.contains('active')) {
                section.classList.add('active');
                toggleIcon.classList.add('rotated');
                toggleIcon.textContent = '▲';
            }
        }
    });
}

// Fonction pour la section des boissons (garde la compatibilité)
function toggleDrinksTable() {
    const tableContent = document.getElementById('drinks-table-content');
    const toggleIcon = document.getElementById('drinks-table-toggle');
    
    if (!tableContent || !toggleIcon) return;
    
    const isVisible = tableContent.style.display !== 'none';
    
    if (isVisible) {
        tableContent.style.display = 'none';
        toggleIcon.textContent = '▼';
    } else {
        tableContent.style.display = 'block';
        toggleIcon.textContent = '▲';
    }
}

// Initialisation des sections (ouvrir les sections importantes par défaut)
document.addEventListener('DOMContentLoaded', function() {
    // Ouvrir les sections importantes par défaut
    setTimeout(() => {
        toggleSection('purchase-section');
        toggleSection('history-section');
    }, 100);
});

// Fonction pour déclencher une actualisation immédiate côté client
async function triggerImmediateRefresh() {
    try {
        // Envoyer un signal pour déclencher une actualisation immédiate sur l'interface publique
        // Utiliser localStorage pour communiquer entre les onglets
        localStorage.setItem('trigger-immediate-refresh', Date.now().toString());
        
        // Signal pour indiquer qu'un événement de marché s'est produit
        localStorage.setItem('market-event-signal', JSON.stringify({
            timestamp: Date.now(),
            type: 'market_event'
        }));
        
        console.log('Signal d\'actualisation immédiate envoyé');
        
    } catch (error) {
        console.error('Erreur lors de l\'envoi du signal d\'actualisation:', error);
    }
}

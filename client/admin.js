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
            await loadPurchaseTable();
            await loadAdminDrinksList();
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
            await loadPurchaseTable();
            await loadAdminDrinksList();
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
        const res = await fetch(`${API_BASE}/admin/drinks`, { headers: { 'Authorization': 'Basic ' + authToken } });
        const data = await res.json();
        container.innerHTML = '';
        (data.drinks || []).forEach(d => {
            const div = document.createElement('div');
            div.className = 'form-group';
            div.innerHTML = `
                <div style="display:grid; grid-template-columns: 2fr repeat(4,1fr) auto; gap:10px; align-items:center;">
                  <input type="text" value="${d.name}" data-field="name">
                  <input type="number" step="0.01" value="${d.base_price}" data-field="base_price">
                  <input type="number" step="0.01" value="${d.min_price}" data-field="min_price">
                  <input type="number" step="0.01" value="${d.max_price}" data-field="max_price">
                  <input type="number" step="0.01" value="${d.price}" data-field="price">
                  <div>
                    <button class="btn" data-action="save">Enregistrer</button>
                    <button class="btn btn-danger" data-action="delete">Supprimer</button>
                  </div>
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
                        await loadPurchaseTable();
                        await loadHistory();
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
                        await loadPurchaseTable();
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
let refreshInterval = null;
let priceUpdateMode = 'transaction'; // Mode par défaut

// Éléments DOM
const authForm = document.getElementById('auth-form');
const adminInterface = document.getElementById('admin-interface');
const loginForm = document.getElementById('login-form');
const authMessage = document.getElementById('auth-message');

// Initialisation
document.addEventListener('DOMContentLoaded', () => {
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
});

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
            loadInitialData();
        } else {
            throw new Error('Authentification échouée');
        }
    } catch (error) {
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
}

function logout() {
    isAuthenticated = false;
    authToken = null;
    localStorage.removeItem('admin_auth');
    showAuthForm();
    if (refreshInterval) {
        clearInterval(refreshInterval);
    }
}

// Fonctions d'affichage des messages
function showMessage(elementId, message, type) {
    const element = document.getElementById(elementId);
    element.textContent = message;
    element.className = `message ${type}`;
    element.classList.remove('hidden');
    // Affichage prolongé avec fondu
    element.style.opacity = '1';
    element.style.transition = 'opacity 0.6s ease';
    setTimeout(() => {
        element.style.opacity = '0';
        setTimeout(() => {
            element.classList.add('hidden');
            // Reset pour prochains messages
            element.style.opacity = '';
            element.style.transition = '';
        }, 600);
    }, 10000);
}

// Chargement des données initiales
async function loadInitialData() {
  await Promise.all([
    loadDrinks(),
    loadPriceControls(),
    loadHistory(),
    loadPurchaseTable(),
    loadAdminDrinksList(),
    // Backups retirés de l'UI
  ]);
  
  // Initialiser les graphiques
  initCharts();
  
  // Démarrer le rafraîchissement automatique
  startAutoRefresh();
}

// Remplir la liste déroulante avec les boissons
async function loadDrinks() {
  try {
        const res = await fetch(`${API_BASE}/admin/drinks`, {
            headers: { 'Authorization': 'Basic ' + authToken }
        });
    const data = await res.json();

    const select = document.getElementById("drink");
    if (!select) return; // Pas de liste déroulante dans l'UI simplifiée
    select.innerHTML = "";

        data.drinks.forEach(drink => {
      const option = document.createElement("option");
      option.value = drink.id;
      option.textContent = `${drink.name} – ${drink.price.toFixed(2)} €`;
      select.appendChild(option);
    });
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
        // Trier par timestamp décroissant (plus récent d'abord)
        const history = (data.history || []).slice().sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
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
                <td data-label="Quantité">
                    <span class="qty-view">${entry.quantity}</span>
                    <input class="qty-edit hidden" type="number" min="0" value="${entry.quantity}" style="width: 70px;" />
                </td>
                <td data-label="Variation" class="${changeClass}">${changeText}</td>
                <td data-label="Actions">
                    <button class="btn btn-danger btn-delete">Supprimer</button>
                </td>
            `;

            const qtyView = row.querySelector('.qty-view');
            const qtyInput = row.querySelector('.qty-edit');
            const deleteBtn = row.querySelector('.btn-delete');

            deleteBtn.addEventListener('click', async () => {
                try {
                    const res = await fetch(`${API_BASE}/admin/history/${entry.id}`, {
                        method: 'DELETE',
                        headers: { 'Authorization': 'Basic ' + authToken }
                    });
                    if (res.ok) {
                        showMessage('history-message', '🗑️ Transaction supprimée', 'success');
                        await loadHistory();
                        await loadPurchaseTable();
                        await loadAdminDrinksList();
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
        const [pricesRes, historyRes] = await Promise.all([
            fetch(`${API_BASE}/admin/drinks`, { headers: { 'Authorization': 'Basic ' + authToken } }),
            fetch(`${API_BASE}/admin/history?limit=50`, { headers: { 'Authorization': 'Basic ' + authToken } })
        ]);
        const pricesData = await pricesRes.json();
        const historyData = await historyRes.json();
        const drinks = pricesData.drinks || [];
        const history = historyData.history || [];

        if (typeof wallStreetCharts !== 'undefined' && wallStreetCharts) {
            const beerPrices = drinks.filter(d => (d.type || '').toLowerCase() === 'beer').map(d => d.price);
            wallStreetCharts.updatePriceChart(beerPrices, true);
            wallStreetCharts.updateVolumeChart(history);
        }
        showMessage('buy-message', '🔄 Données actualisées !', 'success');
    } catch (e) {
        console.error('Erreur refreshData:', e);
    }
}

// Rafraîchissement automatique
function startAutoRefresh() {
  if (refreshInterval) clearInterval(refreshInterval);
  const refreshTimerElement = document.getElementById('refresh-interval');
  const interval = refreshTimerElement ? parseInt(refreshTimerElement.value, 10) * 1000 : 10000;
  refreshInterval = setInterval(() => {
    if (isAuthenticated) {
      refreshData();
    }
  }, interval);
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

// Backups supprimés → fonctions no-op
async function loadBackupStatus() { return; }
async function loadBackupList() { return; }
async function createBackup() { return; }
async function restoreBackup() { return; }
async function validateData() { return; }

// Charger la liste des sauvegardes
async function loadBackupList() {
    try {
        const res = await fetch(`${API_BASE}/admin/backup/list`, {
            headers: { 'Authorization': 'Basic ' + authToken }
        });
        const data = await res.json();
        
        const backupList = document.getElementById('backup-list');
        if (data.backups.length === 0) {
            backupList.innerHTML = '<p style="text-align: center; color: #888;">Aucune sauvegarde disponible</p>';
            return;
        }
        
        let html = '<h4>📋 Sauvegardes Disponibles:</h4><div style="max-height: 200px; overflow-y: auto;">';
        
        data.backups.forEach(backup => {
            const date = new Date(backup.timestamp.replace(/(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})/, '$1-$2-$3 $4:$5:$6'));
            const typeIcon = backup.backup_type === 'manual' ? '👤' : '🤖';
            
            html += `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; margin: 5px 0; background: rgba(0, 255, 65, 0.1); border-radius: 5px;">
                    <div>
                        <strong>${typeIcon} ${backup.name}</strong><br>
                        <small>${date.toLocaleString()}</small>
                    </div>
                    <div>
                        <button onclick="restoreBackup('${backup.name}')" class="btn" style="background: linear-gradient(45deg, #ff8800, #ff6600); padding: 5px 10px; font-size: 12px;">
                            🔄 Restaurer
                        </button>
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        backupList.innerHTML = html;
        
    } catch (error) {
        console.error("Erreur chargement liste sauvegardes:", error);
    }
}

// Créer une sauvegarde manuelle
async function createBackup() {
    try {
        const res = await fetch(`${API_BASE}/admin/backup/create`, {
            method: 'POST',
            headers: { 'Authorization': 'Basic ' + authToken }
        });
        
        if (res.ok) {
            showMessage('buy-message', '💾 Sauvegarde créée avec succès !', 'success');
            loadBackupStatus();
        } else {
            showMessage('buy-message', 'Erreur lors de la création de la sauvegarde', 'error');
        }
    } catch (error) {
        showMessage('buy-message', 'Erreur lors de la création de la sauvegarde', 'error');
    }
}

// Restaurer une sauvegarde
async function restoreBackup(backupName) {
    if (confirm(`Êtes-vous sûr de vouloir restaurer la sauvegarde "${backupName}" ?\n\nCette action remplacera toutes les données actuelles.`)) {
        try {
            const res = await fetch(`${API_BASE}/admin/backup/restore/${backupName}`, {
                method: 'POST',
                headers: { 'Authorization': 'Basic ' + authToken }
            });
            
            if (res.ok) {
                showMessage('buy-message', `🔄 Sauvegarde "${backupName}" restaurée !`, 'success');
                // Recharger toutes les données
                loadInitialData();
            } else {
                showMessage('buy-message', 'Erreur lors de la restauration de la sauvegarde', 'error');
            }
        } catch (error) {
            showMessage('buy-message', 'Erreur lors de la restauration de la sauvegarde', 'error');
        }
    }
}

// Valider les données
async function validateData() {
    try {
        const res = await fetch(`${API_BASE}/admin/backup/validate`, {
            headers: { 'Authorization': 'Basic ' + authToken }
        });
        const data = await res.json();
        
        if (data.valid) {
            showMessage('buy-message', '✅ Données validées avec succès !', 'success');
        } else {
            showMessage('buy-message', `❌ Problèmes détectés: ${data.issues.join(', ')}`, 'error');
        }
    } catch (error) {
        showMessage('buy-message', 'Erreur lors de la validation des données', 'error');
    }
}

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
document.getElementById('transaction-mode').addEventListener('change', () => {
    priceUpdateMode = 'transaction';
    if (refreshInterval) clearInterval(refreshInterval); // Arrêter le timer si actif
});

document.getElementById('timer-mode').addEventListener('change', () => {
    priceUpdateMode = 'timer';
    startAutoRefresh(); // Démarrer le timer
});

// Gestion de l'intervalle d'actualisation
document.getElementById('refresh-interval-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const intervalInput = document.getElementById('refresh-interval').value;
    const interval = parseInt(intervalInput, 10) * 1000; // Convertir en millisecondes

    if (isNaN(interval) || interval <= 0) {
        alert('Veuillez entrer un intervalle valide.');
        return;
    }

    localStorage.setItem('refreshInterval', interval);
    alert(`Intervalle d'actualisation mis à jour à ${interval / 1000} secondes.`);
});

// Charger les boissons dans le tableau d'achat (dynamique)
async function loadPurchaseTable() {
    const tableBody = document.querySelector('#purchase-table tbody');
    if (!tableBody) return;
    tableBody.innerHTML = '';

    try {
        const res = await fetch(`${API_BASE}/admin/drinks`, {
            headers: { 'Authorization': 'Basic ' + authToken }
        });
        const data = await res.json();
        (data.drinks || []).forEach(drink => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td data-label="Boisson">${drink.name}</td>
                <td data-label="Prix (€)">
                  <span class="price-view" data-id="${drink.id}">${drink.price.toFixed(2)}</span>
                  <input class="price-edit hidden" type="number" step="0.01" min="${drink.min_price}" max="${drink.max_price}" value="${drink.price.toFixed(2)}">
                </td>
                <td data-label="Actions">
                  <button class="btn" data-action="buy" data-id="${drink.id}" data-name="${drink.name}">Acheter</button>
                </td>
            `;

            const priceView = row.querySelector('.price-view');
            const priceInput = row.querySelector('.price-edit');
            const buyBtn = row.querySelector('[data-action="buy"]');

            // Inline edit on price click
            priceView.addEventListener('click', () => {
                priceView.classList.add('hidden');
                priceInput.classList.remove('hidden');
                priceInput.focus();
                priceInput.select();
            });

            async function savePrice() {
                const newPrice = parseFloat(priceInput.value);
                if (isNaN(newPrice)) {
                    showMessage('history-message', 'Prix invalide', 'error');
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
                        const data = await res.json();
                        priceView.textContent = data.new_price.toFixed ? data.new_price.toFixed(2) : data.new_price;
                        showMessage('history-message', `Prix mis à jour: ${data.old_price}€ → ${data.new_price}€`, 'success');
                        // Rafraîchir les vues pour refléter d'éventuelles corrélations
                        await loadPurchaseTable();
                        await loadHistory();
                        await loadAdminDrinksList();
                    } else {
                        const err = await res.json();
                        showMessage('history-message', 'Erreur: ' + err.detail, 'error');
                    }
                } catch (e) {
                    showMessage('history-message', 'Erreur de connexion', 'error');
                } finally {
                    priceInput.classList.add('hidden');
                    priceView.classList.remove('hidden');
                }
            }

            priceInput.addEventListener('blur', savePrice);
            priceInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') savePrice();
                if (e.key === 'Escape') { priceInput.classList.add('hidden'); priceView.classList.remove('hidden'); }
            });

            // Buy button
            buyBtn.addEventListener('click', async () => {
                try {
                    const resp = await fetch(`${API_BASE}/buy`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ drink_id: drink.id, quantity: 1 })
                    });
                    if (resp.ok) {
                        const out = await resp.json();
                        const details = `${drink.name} x1`;
                        showMessage('history-message', `Achat validé ! 1 boisson: ${details}`, 'success');
                        // Rafraîchir prix/historique
                        loadPurchaseTable();
                        loadHistory();
                    } else {
                        const err = await resp.json();
                        showMessage('history-message', 'Erreur achat: ' + err.detail, 'error');
                    }
                } catch (e) {
                    showMessage('history-message', 'Erreur réseau achat', 'error');
                }
            });

            tableBody.appendChild(row);
        });
    } catch (error) {
        console.error('Erreur lors du chargement des boissons:', error);
    }
}

function adjustQuantity() { return; }

async function validatePurchase() { return; }

// Le tableau d'achat et la liste admin sont chargés après authentification via loadInitialData()

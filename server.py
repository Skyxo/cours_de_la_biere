# File: server.py
"""
Step 1 implementation for the "Wall Street Bar" project.
FastAPI backend with three endpoints implemented:
 - GET /prices    -> current prices
 - POST /buy      -> register a purchase
 - GET /history   -> full history

Persistence: CSV files in ./data/ directory
"""
from fastapi import FastAPI, HTTPException, Request, Depends, status
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse, RedirectResponse
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
import os
import secrets
from csv_data import CSVDataManager

# Initialiser le gestionnaire de données CSV
data_manager = CSVDataManager()

app = FastAPI(title="Wall Street Bar - Step 1 Backend")

# Configuration de l'authentification
security = HTTPBasic()

# Credentials admin (en production, utiliser des variables d'environnement)
ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "wallstreet2024"

def get_current_admin(credentials: HTTPBasicCredentials = Depends(security)):
    """Vérifie les credentials admin"""
    is_correct_username = secrets.compare_digest(credentials.username, ADMIN_USERNAME)
    is_correct_password = secrets.compare_digest(credentials.password, ADMIN_PASSWORD)
    
    if not (is_correct_username and is_correct_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Identifiants incorrects",
            headers={"WWW-Authenticate": "Basic"},
        )
    return credentials.username

# Serve frontend from client/ - will be mounted after API routes

# --- Pydantic models ---
class BuyRequest(BaseModel):
    drink_id: int
    quantity: int = 1

class PriceItem(BaseModel):
    id: int
    name: str
    price: float
    base_price: float
    min_price: float
    max_price: float

class HistoryItem(BaseModel):
    id: int
    drink_id: int
    name: str
    price: float
    quantity: int
    change: float
    event: str
    timestamp: str

# --- CSV Data helpers ---
# Toutes les fonctions de base de données sont maintenant gérées par CSVDataManager

# --- API endpoints ---

# --- Routes API ---
@app.get("/prices")
async def get_prices():
    """Retourne les prix actuels depuis les fichiers CSV"""
    prices = data_manager.get_all_prices()
    return {"prices": [{"id": p['id'], "name": p['name'], "price": p['price']} for p in prices]}


@app.post("/buy")
async def buy(request: Request):
    """Enregistre un achat et met à jour les prix"""
    try:
        data = await request.json()
        drink_id = int(data.get("drink_id"))
        quantity = int(data.get("quantity", 1))
        
        print(f"DEBUG: Processing buy request - drink_id: {drink_id}, quantity: {quantity}")
        
        updated_drink = data_manager.apply_buy(drink_id, quantity)
        print(f"DEBUG: Buy successful - new_price: {updated_drink['price']}")
        
        return {"status": "ok", "drink_id": drink_id, "quantity": quantity, "new_price": updated_drink['price']}
    except ValueError as e:
        print(f"DEBUG: ValueError in buy: {e}")
        return JSONResponse(status_code=400, content={"detail": str(e)})
    except Exception as e:
        print(f"DEBUG: Unexpected error in buy: {e}")
        import traceback
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"detail": str(e)})

@app.get("/history")
async def get_history():
    """Retourne l'historique complet depuis les fichiers CSV"""
    history = data_manager.get_history(limit=100)
    return {"history": history}


# --- Optional: simple health check and reset endpoint (non-authenticated for step 1) ---
@app.get('/health')
def health():
    return {'status': 'ok', 'time': datetime.utcnow().isoformat()}

@app.post('/reset')
def reset():
    """Remet tous les prix à leur valeur de base"""
    data_manager.reset_prices()
    return {'status': 'reset'}

@app.post('/crash')
def crash():
    """Déclenche un krach : baisse brutale de tous les prix"""
    data_manager.trigger_crash()
    return {'status': 'crash_triggered'}

# --- Endpoints Admin Protégés ---

@app.get('/admin/status')
async def admin_status(admin: str = Depends(get_current_admin)):
    """Statut de l'administration"""
    prices = data_manager.get_all_prices()
    history = data_manager.get_history(limit=10)
    
    return {
        'admin': admin,
        'total_drinks': len(prices),
        'recent_transactions': len(history),
        'market_status': 'active',
        'timestamp': datetime.now().isoformat()
    }

@app.get('/admin/drinks')
async def admin_get_drinks(admin: str = Depends(get_current_admin)):
    """Récupère toutes les boissons avec détails complets"""
    drinks = data_manager.get_all_prices()
    return {'drinks': drinks}

class CreateDrinkRequest(BaseModel):
    name: str
    base_price: float
    min_price: float
    max_price: float

@app.post('/admin/drinks')
async def admin_create_drink(payload: CreateDrinkRequest, admin: str = Depends(get_current_admin)):
    try:
        drink = data_manager.add_drink(payload.name, payload.base_price, payload.min_price, payload.max_price)
        return {'status': 'created', 'drink': drink}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.patch('/admin/drinks/{drink_id}')
async def admin_patch_drink(drink_id: int, request: Request, admin: str = Depends(get_current_admin)):
    data = await request.json()
    try:
        updated = data_manager.update_drink_fields(
            drink_id,
            name=data.get('name'),
            base_price=data.get('base_price'),
            min_price=data.get('min_price'),
            max_price=data.get('max_price'),
            price=data.get('price')
        )
        if not updated:
            raise HTTPException(status_code=404, detail="Boisson introuvable")
        return {'status': 'updated', 'drink': updated}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.delete('/admin/drinks/{drink_id}')
async def admin_delete_drink(drink_id: int, admin: str = Depends(get_current_admin)):
    success = data_manager.delete_drink(drink_id)
    if not success:
        raise HTTPException(status_code=404, detail="Boisson introuvable")
    return {'status': 'deleted', 'drink_id': drink_id}

@app.post('/admin/drinks/{drink_id}/price')
async def admin_update_price(drink_id: int, request: Request, admin: str = Depends(get_current_admin)):
    """Met à jour manuellement le prix d'une boisson"""
    data = await request.json()
    new_price = data.get('new_price')
    
    if new_price is None:
        raise HTTPException(status_code=400, detail="new_price requis")
    
    drink = data_manager.get_drink_by_id(drink_id)
    if not drink:
        raise HTTPException(status_code=404, detail="Boisson introuvable")
    
    # Vérifier que le nouveau prix est dans les bornes
    if new_price < drink['min_price'] or new_price > drink['max_price']:
        raise HTTPException(
            status_code=400, 
            detail=f"Prix doit être entre {drink['min_price']}€ et {drink['max_price']}€"
        )
    
    old_price = drink['price']
    data_manager.update_drink_price(drink_id, new_price)
    change = new_price - old_price
    data_manager.add_history_entry(drink_id, drink['name'], new_price, 0, change, 'manual_update')
    
    return {
        'status': 'updated',
        'drink_id': drink_id,
        'old_price': old_price,
        'new_price': new_price,
        'change': change
    }

@app.get('/admin/history')
async def admin_get_history(limit: int = 100, admin: str = Depends(get_current_admin)):
    """Récupère l'historique complet des transactions"""
    history = data_manager.get_history(limit=limit)
    return {'history': history}

@app.post('/admin/history/update/{entry_id}')
async def admin_update_history(entry_id: int, request: Request, admin: str = Depends(get_current_admin)):
    """Met à jour une entrée de l'historique (quantité / événement). Ne re-calcule pas rétroactivement les prix."""
    data = await request.json()
    quantity = data.get('quantity')
    event = data.get('event')
    if quantity is None and event is None:
        raise HTTPException(status_code=400, detail="Aucun champ à mettre à jour (quantity ou event)")
    try:
        updated = data_manager.update_history_entry(entry_id, quantity=quantity, event=event)
        if not updated:
            raise HTTPException(status_code=404, detail="Entrée d'historique introuvable")
        return {'status': 'updated', 'entry': updated}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.delete('/admin/history/{entry_id}')
async def admin_delete_history(entry_id: int, admin: str = Depends(get_current_admin)):
    """Supprime une entrée d'historique par ID"""
    success = data_manager.revert_and_delete_history_entry(entry_id)
    if not success:
        raise HTTPException(status_code=404, detail="Entrée d'historique introuvable")
    return {'status': 'deleted', 'entry_id': entry_id}

@app.post('/admin/history/clear')
async def admin_clear_history(admin: str = Depends(get_current_admin)):
    data_manager.clear_history()
    return {'status': 'cleared'}

@app.post('/admin/market/crash')
async def admin_trigger_crash(admin: str = Depends(get_current_admin)):
    """Déclenche un krach (admin seulement)"""
    data_manager.trigger_crash()
    return {'status': 'crash_triggered', 'admin': admin}

@app.post('/admin/market/reset')
async def admin_reset_market(admin: str = Depends(get_current_admin)):
    """Remet tous les prix à leur valeur de base (admin seulement)"""
    data_manager.reset_prices()
    return {'status': 'market_reset', 'admin': admin}

@app.get('/admin/stats')
async def admin_get_stats(admin: str = Depends(get_current_admin)):
    """Statistiques du marché (simplifiées)"""
    prices = data_manager.get_all_prices()
    history = data_manager.get_history(limit=1000)
    # Calculer les statistiques de base
    total_transactions = len([h for h in history if h['event'] == 'buy'])
    total_volume = sum(h['quantity'] for h in history if h['event'] == 'buy')
    avg_price = sum(p['price'] for p in prices) / len(prices)
    max_price = max(p['price'] for p in prices)
    min_price = min(p['price'] for p in prices)
    return {
        'total_drinks': len(prices),
        'total_transactions': total_transactions,
        'total_volume': total_volume,
        'average_price': round(avg_price, 2),
        'highest_price': max_price,
        'lowest_price': min_price,
        'market_volatility': round(max_price - min_price, 2)
    }

# Endpoints de statut/événements/évolution supprimés pour simplification

## Gestion des sauvegardes supprimée pour simplification

# --- Static frontend ---
client_path = os.path.join(os.path.dirname(__file__), 'client')
if os.path.isdir(client_path):
    app.mount("/", StaticFiles(directory=client_path, html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)
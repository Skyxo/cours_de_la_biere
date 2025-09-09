from fastapi import FastAPI, HTTPException, Request, Depends, status
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse, FileResponse
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
import os
import secrets
import uvicorn
import json
from csv_data import CSVDataManager

app = FastAPI()
data_manager = CSVDataManager()

current_refresh_interval = 10000
active_drinks = set()
timer_start_time = datetime.now()

app = FastAPI(title="Wall Street Bar")
security = HTTPBasic()

ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "wallstreet2024"

def get_current_admin(credentials: HTTPBasicCredentials = Depends(security)):
    is_correct_username = secrets.compare_digest(credentials.username, ADMIN_USERNAME)
    is_correct_password = secrets.compare_digest(credentials.password, ADMIN_PASSWORD)
    
    if not (is_correct_username and is_correct_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Identifiants incorrects",
            headers={"WWW-Authenticate": "Basic"},
        )
    return credentials.username
class BuyRequest(BaseModel):
    drink_id: int
    quantity: int = 1

class IntervalRequest(BaseModel):
    interval_ms: int

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

class CreateDrinkRequest(BaseModel):
    name: str
    base_price: float
    min_price: float
    max_price: float
@app.get("/prices")
async def get_prices():
    prices = data_manager.get_all_prices()
    return {
        "prices": prices,
        "active_drinks": list(active_drinks),
        "timer_start": timer_start_time.isoformat(),
        "interval_ms": current_refresh_interval
    }

@app.get("/config/interval")
async def get_refresh_interval():
    return {"interval_ms": current_refresh_interval}

@app.post("/config/interval")
async def set_refresh_interval(request: IntervalRequest, admin: str = Depends(get_current_admin)):
    global current_refresh_interval, active_drinks, timer_start_time
    
    current_refresh_interval = max(0, request.interval_ms)
    active_drinks.clear()
    timer_start_time = datetime.now()
    
    return {"status": "ok", "interval_ms": current_refresh_interval}


@app.post("/buy")
async def buy(request: Request):
    global active_drinks
    
    try:
        data = await request.json()
        drink_id = int(data.get("drink_id"))
        quantity = int(data.get("quantity", 1))
        
        active_drinks.add(drink_id)
        
        if current_refresh_interval == 0:
            updated_drink = data_manager.apply_buy(drink_id, quantity)
        else:
            updated_drink = data_manager.apply_buy(drink_id, quantity)
            
        return {
            "status": "ok", 
            "drink_id": drink_id, 
            "quantity": quantity, 
            "new_price": updated_drink['price'],
            "mode": "immediate" if current_refresh_interval == 0 else "market",
            "active_drinks": list(active_drinks)
        }
    except ValueError as e:
        return JSONResponse(status_code=400, content={"detail": str(e)})
    except Exception as e:
        return JSONResponse(status_code=500, content={"detail": str(e)})

@app.get("/history")
async def get_history():
    history = data_manager.get_history(limit=10)
    return {"history": history}

@app.get('/health')
def health():
    return {'status': 'ok', 'time': datetime.utcnow().isoformat()}

@app.post('/reset')
def reset():
    data_manager.reset_prices()
    return {'status': 'reset'}

@app.post('/crash')
def crash():
    data_manager.trigger_crash()
    return {'status': 'crash_triggered'}

@app.get('/admin/status')
async def admin_status(admin: str = Depends(get_current_admin)):
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
    drinks = data_manager.get_all_prices()
    return {'drinks': drinks}

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
    data = await request.json()
    new_price = data.get('new_price')
    
    if new_price is None:
        raise HTTPException(status_code=400, detail="new_price requis")
    
    drink = data_manager.get_drink_by_id(drink_id)
    if not drink:
        raise HTTPException(status_code=404, detail="Boisson introuvable")
    
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
async def admin_get_history(limit: int = 10, admin: str = Depends(get_current_admin)):
    history = data_manager.get_history(limit=limit)
    return {'history': history}

@app.post('/admin/history/update/{entry_id}')
async def admin_update_history(entry_id: int, request: Request, admin: str = Depends(get_current_admin)):
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
    data_manager.trigger_crash()
    return {'status': 'crash_triggered', 'admin': admin}

@app.post('/admin/market/boom')
async def admin_trigger_boom(admin: str = Depends(get_current_admin)):
    data_manager.trigger_boom()
    return {'status': 'boom_triggered', 'admin': admin}

@app.post('/admin/market/reset')
async def admin_reset_market(admin: str = Depends(get_current_admin)):
    data_manager.reset_prices()
    return {'status': 'market_reset', 'admin': admin}

@app.get('/admin/stats')
async def admin_get_stats(admin: str = Depends(get_current_admin)):
    prices = data_manager.get_all_prices()
    history = data_manager.get_history(limit=10)
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

client_path = os.path.join(os.path.dirname(__file__), 'client')
if os.path.isdir(client_path):
    app.mount("/", StaticFiles(directory=client_path, html=True), name="static")

if __name__ == "__main__":
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)
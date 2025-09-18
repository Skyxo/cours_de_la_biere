from fastapi import FastAPI, HTTPException, Request, Depends, status
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse, FileResponse, StreamingResponse
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timedelta
from contextlib import asynccontextmanager
import os
import secrets
import uvicorn
import io
import json
import threading
import time
import csv
from csv_data import CSVDataManager
app = FastAPI()

data_manager = CSVDataManager()
data_manager.volatility = 1.0 # Initialiser l'attribut de volatilité

current_refresh_interval = 10000
market_volatility = 1.0
active_drinks = set()
timer_start_time = datetime.now()
market_timer_start = datetime.now()  # Timer global du marché, indépendant des clients

# Fonction pour charger/sauvegarder l'état du timer persistant
def load_timer_state():
    """Charger l'état du timer depuis le fichier de sauvegarde"""
    global market_timer_start, current_refresh_interval, market_volatility
    try:
        if os.path.exists('data/timer_state.json'):
            with open('data/timer_state.json', 'r') as f:
                timer_data = json.load(f)
                market_timer_start = datetime.fromisoformat(timer_data.get('market_timer_start', datetime.now().isoformat()))
                current_refresh_interval = timer_data.get('refresh_interval', 10000)
                market_volatility = timer_data.get('market_volatility', 1.0)
                data_manager.volatility = market_volatility # Transmettre au data_manager
                # Réduire les logs au démarrage
                if not hasattr(load_timer_state, '_logged'):
                    print(f"⏰ Timer universel chargé: démarré le {market_timer_start}, intervalle {current_refresh_interval}ms")
                    load_timer_state._logged = True
        else:
            if not hasattr(load_timer_state, '_logged'):
                print(f"⏰ Aucun état de timer sauvegardé trouvé, démarrage nouveau timer universel")
                load_timer_state._logged = True
            # Créer immédiatement un état initial
            save_timer_state()
    except Exception as e:
        print(f"❌ Erreur lors du chargement du timer: {e}")
        market_timer_start = datetime.now()
        save_timer_state()

def save_timer_state():
    """Sauvegarder l'état du timer dans un fichier"""
    global market_timer_start, current_refresh_interval, market_volatility
    try:
        os.makedirs('data', exist_ok=True)
        timer_data = {
            'market_timer_start': market_timer_start.isoformat(),
            'refresh_interval': current_refresh_interval,
            'market_volatility': market_volatility,
            'last_saved': datetime.now().isoformat()
        }
        with open('data/timer_state.json', 'w') as f:
            json.dump(timer_data, f, indent=2)
        # Réduire les logs : seulement afficher de temps en temps
        if not hasattr(save_timer_state, '_last_log') or (datetime.now() - save_timer_state._last_log).seconds > 300:
            print(f"💾 État du timer universel sauvegardé: {market_timer_start.isoformat()}")
            save_timer_state._last_log = datetime.now()
    except Exception as e:
        print(f"❌ Erreur lors de la sauvegarde du timer: {e}")

# Variables de session
current_session = None
session_sales = []  # Liste des ventes de la session en cours

def load_session_if_exists():
    """Charger la session sauvegardée s'il y en a une"""
    global current_session, session_sales
    try:
        if os.path.exists('data/current_session.json'):
            with open('data/current_session.json', 'r') as f:
                session_data = json.load(f)
                current_session = session_data.get('session')
                # S'assurer que is_active est bien un booléen
                if current_session:
                    current_session['is_active'] = bool(current_session.get('is_active'))
                session_sales = session_data.get('sales', [])
    except Exception as e:
        print(f"Erreur lors du chargement de la session: {e}")

def save_session():
    """Sauvegarder la session courante"""
    global current_session, session_sales
    if current_session:
        try:
            session_data = {
                'session': current_session,
                'sales': session_sales
            }
            with open('data/current_session.json', 'w') as f:
                json.dump(session_data, f, indent=2)
        except Exception as e:
            print(f"Erreur lors de la sauvegarde de la session: {e}")

# Sauvegarde périodique pour la robustesse en cas de crash
def periodic_save_thread():
    """Thread qui sauvegarde l'état du timer et de la session toutes les 30 secondes."""
    while True:
        time.sleep(30)
        save_timer_state()
        save_session()

# --- Démarrage de l'application ---

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Gère le cycle de vie de l'application (démarrage et arrêt)."""
    # Code à exécuter au démarrage
    load_timer_state()
    load_session_if_exists()
    
    save_thread = threading.Thread(target=periodic_save_thread, daemon=True)
    save_thread.start()
    print("🔄 Sauvegarde périodique de l'état démarrée (30s)")
    
    yield
    # Code à exécuter à l'arrêt (si nécessaire)

# --- Fin du Démarrage ---

app = FastAPI(title="Wall Street Bar", lifespan=lifespan)
security = HTTPBasic()

ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "admin"

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

def check_session_active():
    """Vérifier si une session est actuellement active"""
    global current_session
    if not current_session or not current_session.get('is_active'):
        raise HTTPException(
            status_code=423,  # Locked
            detail="Impossible d'ajouter des boissons sans session active. Veuillez d'abord démarrer une session."
        )
    return True
class BuyRequest(BaseModel):
    drink_id: int
    quantity: int = 1

class IntervalRequest(BaseModel):
    interval_ms: int

class VolatilityRequest(BaseModel):
    factor: float

class PriceItem(BaseModel):
    id: int
    name: str
    price: float
    base_price: float
    min_price: float
    max_price: float

class HistoryItem(BaseModel):
    id: int
    drink_id: Optional[int] = None
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
    alcohol_degree: Optional[float] = 0.0

class SessionStartRequest(BaseModel):
    session_name: str

class SessionSale(BaseModel):
    drink_id: int
    drink_name: str
    quantity: int
    unit_price: float
    base_price: float
    total_price: float
    profit_loss: float
    timestamp: str

class SessionStats(BaseModel):
    session_id: Optional[str]
    session_name: Optional[str]
    start_time: Optional[str]
    total_sales: float
    total_profit_loss: float
    drinks_sold: int
    is_active: bool
    sales: List[SessionSale]
@app.get("/prices")
async def get_prices():
    try:
        prices = data_manager.get_all_prices()
        
        # Calculer le temps écoulé depuis le début du cycle du timer
        current_time = datetime.now()
        elapsed_ms = int((current_time - market_timer_start).total_seconds() * 1000)
        
        # Calculer le temps restant jusqu'au prochain cycle
        if current_refresh_interval > 0:
            remaining_ms = current_refresh_interval - (elapsed_ms % current_refresh_interval)
        else:
            remaining_ms = 0  # Mode manuel, pas de temps restant
        
        return {
            "prices": prices,
            "active_drinks": list(active_drinks),
            "timer_start": timer_start_time.isoformat(),
            "interval_ms": current_refresh_interval,
            "server_time": current_time.isoformat(),
            "timer_remaining_ms": remaining_ms,
            "market_timer_start": market_timer_start.isoformat()
        }
    except Exception as e:
        print(f"Erreur dans get_prices: {e}")
        # En cas d'erreur, retourner une structure valide
        current_time = datetime.now()
        return {
            "prices": [],
            "active_drinks": [],
            "timer_start": current_time.isoformat(),
            "interval_ms": current_refresh_interval,
            "server_time": current_time.isoformat(),
            "timer_remaining_ms": current_refresh_interval,
            "market_timer_start": market_timer_start.isoformat()
        }

@app.get("/diagnostic")
async def get_diagnostic():
    """Endpoint de diagnostic pour troubleshooting production"""
    import sys
    import os
    from pathlib import Path
    
    try:
        # Test basique de lecture CSV
        csv_status = "OK"
        csv_count = 0
        try:
            prices = data_manager.get_all_prices()
            csv_count = len(prices)
        except Exception as e:
            csv_status = f"ERROR: {e}"
        
        return {
            "status": "OK",
            "python_version": sys.version,
            "working_directory": os.getcwd(),
            "csv_status": csv_status,
            "csv_drinks_count": csv_count,
            "drinks_file_exists": os.path.exists("data/drinks.csv"),
            "history_file_exists": os.path.exists("data/history.csv"),
            "active_drinks": list(active_drinks),
            "current_session": current_session is not None,
            "timer_start": timer_start_time.isoformat(),
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        return {
            "status": "ERROR",
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }

@app.get("/config/interval")
async def get_refresh_interval():
    return {"interval_ms": current_refresh_interval}

@app.get("/admin/config/volatility")
async def get_volatility(admin: str = Depends(get_current_admin)):
    """Obtenir le facteur de volatilité actuel du marché."""
    return {"factor": market_volatility}

@app.post("/admin/config/volatility")
async def set_volatility(request: VolatilityRequest, admin: str = Depends(get_current_admin)):
    """Définir le facteur de volatilité du marché."""
    global market_volatility
    # Limiter la valeur pour la sécurité, correspondant au slider
    market_volatility = max(0.25, min(request.factor, 4.0))
    data_manager.volatility = market_volatility
    save_timer_state()
    save_timer_state() # Sauvegarde immédiate
    return {"status": "ok", "factor": market_volatility}

@app.get("/sync/timer")
async def get_timer_sync():
    """Endpoint pour synchroniser le timer entre tous les clients"""
    current_time = datetime.now()
    elapsed_ms = int((current_time - market_timer_start).total_seconds() * 1000)
    if current_refresh_interval > 0:
        remaining_ms = current_refresh_interval - (elapsed_ms % current_refresh_interval)
    else:
        remaining_ms = 0  # Mode manuel, pas de temps restant

    # Debug info pour diagnostiquer les problèmes de synchronisation
    timer_age_minutes = (current_time - market_timer_start).total_seconds() / 60
    
    return {
        "server_time": current_time.isoformat(),
        "market_timer_start": market_timer_start.isoformat(),
        "interval_ms": current_refresh_interval,
        "timer_remaining_ms": remaining_ms,
        "elapsed_since_start_ms": elapsed_ms,
        "timer_age_minutes": round(timer_age_minutes, 2),
        "timer_state_file_exists": os.path.exists('data/timer_state.json'),
        "debug_info": f"Timer actif depuis {timer_age_minutes:.1f}min, reste {remaining_ms/1000:.1f}s"
    }

@app.post("/admin/sync/refresh-all")
async def force_refresh_all_clients(admin: str = Depends(get_current_admin)):
    """Force tous les clients à se synchroniser immédiatement"""
    global market_timer_start
    market_timer_start = datetime.now() # Redémarre le cycle
    save_timer_state()  # Sauvegarder immédiatement
    
    return {
        "status": "refresh_forced",
        "message": "Tous les clients vont se synchroniser au prochain appel API",
        "new_timer_start": market_timer_start.isoformat()
    }

@app.post("/admin/timer/restart")
async def restart_universal_timer(admin: str = Depends(get_current_admin)):
    """Redémarre uniquement le timer universel sans changer l'intervalle"""
    global market_timer_start
    market_timer_start = datetime.now() # Redémarre le cycle
    save_timer_state()  # Sauvegarder immédiatement
    
    return {
        "status": "timer_restarted",
        "message": f"Timer universel redémarré avec intervalle de {current_refresh_interval}ms",
        "new_timer_start": market_timer_start.isoformat(),
        "interval_ms": current_refresh_interval
    }

@app.get("/admin/initial-data")
async def get_initial_admin_data(admin: str = Depends(get_current_admin)):
    """
    Endpoint to provide all necessary data for the admin interface in a single call.
    """
    try:
        # 1. Get all drinks info (prices, min, max, etc.)
        all_drinks = data_manager.get_all_prices()

        # 2. Get purchase history
        history = data_manager.get_history(limit=50)

        # 3. Get active happy hours
        active_happy_hours = data_manager.get_active_happy_hours()

        # 4. Get previous sessions (logic from list_previous_sessions)
        import glob
        import pandas as pd
        
        sessions = []
        session_files = glob.glob("data/session_*.csv")
        
        for file_path in session_files:
            try:
                if not os.path.exists(file_path):
                    continue
                filename = os.path.basename(file_path)
                if filename.startswith("session_session_"):
                    timestamp_str = filename.replace("session_session_", "").replace(".csv", "")
                    created_at = datetime.strptime(timestamp_str, "%Y%m%d_%H%M%S")
                else:
                    created_at = datetime.fromtimestamp(os.path.getctime(file_path))
                
                df = pd.read_csv(file_path)
                df = df.dropna(how='all').fillna(0)
                
                if len(df) > 0:
                    data_rows = df[df['drink_id'] != 'SESSION_SUMMARY']
                    summary_rows = df[df['drink_id'] == 'SESSION_SUMMARY']
                    
                    total_sales = data_rows['total_price'].sum()
                    total_profit_loss = data_rows['profit_loss'].sum()
                    total_drinks_sold = data_rows['quantity'].sum()
                    
                    session_name = "Session inconnue"
                    if len(summary_rows) > 0:
                        session_info = summary_rows.iloc[0]['drink_name']
                        if session_info and 'Session: ' in str(session_info):
                            session_name = str(session_info).replace('Session: ', '')
                        elif session_info and 'Barman: ' in str(session_info):
                             session_name = str(session_info).replace('Barman: ', '')
                        else:
                            session_name = str(session_info)

                    duration_hours = None
                    if len(summary_rows) > 0:
                        try:
                            start_str = str(summary_rows.iloc[0]['unit_price'])
                            end_str = str(summary_rows.iloc[0]['base_price'])
                            if start_str.startswith('Start: ') and end_str.startswith('End: '):
                                start_time = pd.to_datetime(start_str.replace('Start: ', ''))
                                end_time = pd.to_datetime(end_str.replace('End: ', ''))
                                duration_hours = (end_time - start_time).total_seconds() / 3600
                        except Exception:
                            duration_hours = None
                else:
                    total_sales, total_profit_loss, total_drinks_sold, session_name, duration_hours = 0, 0, 0, "Session vide", None

                sessions.append({
                    "filename": filename,
                    "created_at": created_at.isoformat(),
                    "session_name": session_name,
                    "total_sales": float(total_sales) if not pd.isna(total_sales) else 0.0,
                    "total_profit_loss": float(total_profit_loss) if not pd.isna(total_profit_loss) else 0.0,
                    "total_drinks_sold": int(total_drinks_sold) if not pd.isna(total_drinks_sold) else 0,
                    "duration_hours": float(duration_hours) if duration_hours is not None and not pd.isna(duration_hours) else None
                })
            except Exception:
                continue
        
        # 5. Get current session status
        current_session_status = None
        if current_session and current_session.get('is_active'):
             current_session_status = current_session

        # 6. Get volatility
        volatility_factor = market_volatility

        return {
            "drinks": all_drinks,
            "history": history,
            "active_happy_hours": active_happy_hours,
            "previous_sessions": sessions,
            "current_session": current_session_status,
            "volatility_factor": volatility_factor
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur lors de la récupération des données initiales: {str(e)}")

@app.post("/config/interval")
async def set_refresh_interval(request: IntervalRequest, admin: str = Depends(get_current_admin)):
    global current_refresh_interval, active_drinks, timer_start_time, market_timer_start
    
    current_refresh_interval = max(0, request.interval_ms)
    active_drinks.clear()
    timer_start_time = datetime.now()
    market_timer_start = datetime.now()  # Redémarrer le timer global du marché
    save_timer_state() # Sauvegarde immédiate
    
    return {"status": "ok", "interval_ms": current_refresh_interval}


@app.post("/buy")
async def buy(request: Request):
    global active_drinks, session_sales
    
    try:
        data = await request.json()
        drink_id = int(data.get("drink_id"))
        quantity = int(data.get("quantity", 1))
        
        active_drinks.add(drink_id)
        
        # Obtenir le prix avant la transaction pour calculer le profit/perte
        current_drink = data_manager.get_drink_by_id(drink_id)
        if not current_drink:
            raise ValueError(f"Boisson avec ID {drink_id} non trouvée")
        
        unit_price = current_drink['price']  # Prix exact pour les calculs internes
        displayed_price = current_drink['price_rounded']  # Prix affiché arrondi aux 10 centimes
        base_price = current_drink['base_price']
        
        if current_refresh_interval == 0:
            # Mode immédiat : effet de marché complet
            updated_drink = data_manager.apply_buy(drink_id, quantity)
        else:
            # Mode timer : seul le prix de la boisson achetée augmente simplement
            updated_drink = data_manager.apply_buy_simple(drink_id, quantity)
        
        # Enregistrer la vente dans la session si une session est active
        if current_session:
            # Utiliser le prix affiché (arrondi) pour le calcul du profit/loss et du total
            total_price = displayed_price * quantity
            profit_loss = (displayed_price - base_price) * quantity
            
            sale = {
                "drink_id": drink_id,
                "drink_name": current_drink['name'],
                "quantity": quantity,
                "unit_price": displayed_price,  # Utiliser le prix affiché arrondi
                "base_price": base_price,
                "total_price": total_price,
                "profit_loss": profit_loss,
                "timestamp": datetime.now().isoformat()
            }
            
            session_sales.append(sale)
            save_session()  # Sauvegarder l'état de la session après chaque vente
            
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

@app.get("/api/session/status")
async def get_session_status():
    """Obtenir le statut de la session courante (endpoint public)"""
    load_session_if_exists() # Recharger pour être sûr d'avoir l'état le plus récent
    if not current_session:
        return {"session": None}
    
    # Retourner uniquement les informations de base de la session
    return {
        "session": {
            "session_id": current_session.get('session_id'),
            "session_name": current_session.get('session_name'),
            "is_active": current_session.get('is_active', False),
            "start_time": current_session.get('start_time')
        }
    }

@app.post('/reset')
def reset():
    data_manager.reset_prices()
    return {'status': 'reset'}

# ==========================================
# ENDPOINTS DE SESSION POUR LES BARMANS
# ==========================================

@app.post("/admin/session/start")
async def start_session(request: SessionStartRequest, admin: str = Depends(get_current_admin)):
    """Démarrer une nouvelle session de service"""
    global current_session, session_sales
    
    if current_session and current_session.get('is_active'):
        raise HTTPException(status_code=400, detail="Une session est déjà active")
    
    session_id = f"session_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    
    current_session = {
        "session_id": session_id,
        "session_name": request.session_name,
        "start_time": datetime.now().isoformat(),
        "is_active": True
    }
    
    session_sales = []
    save_session() # Sauvegarde immédiate de la nouvelle session
    
    return {"status": "success", "session": current_session}

@app.get("/admin/session/current")
async def get_current_session(admin: str = Depends(get_current_admin)):
    """Obtenir les statistiques de la session courante"""
    if not current_session:
        return {"session": None, "stats": None}
    
    # Calculer les statistiques
    total_sales = sum(sale['total_price'] for sale in session_sales)
    total_profit_loss = sum(sale['profit_loss'] for sale in session_sales)
    drinks_sold = sum(sale['quantity'] for sale in session_sales)
    
    stats = SessionStats(
        session_id=current_session.get('session_id'),
        session_name=current_session.get('session_name'),
        start_time=current_session.get('start_time'),
        total_sales=total_sales,
        total_profit_loss=total_profit_loss,
        drinks_sold=drinks_sold,
        is_active=current_session.get('is_active', False),
        sales=[SessionSale(**sale) for sale in session_sales]
    )
    
    return {"session": current_session, "stats": stats}

@app.post("/admin/session/end")
async def end_session(admin: str = Depends(get_current_admin)):
    """Terminer la session courante et sauvegarder dans un fichier CSV"""
    global current_session, session_sales
    
    if not current_session or not current_session.get('is_active'):
        raise HTTPException(status_code=400, detail="Aucune session active")
    
    # Calculer les totaux finaux
    total_sales = sum(sale['total_price'] for sale in session_sales)
    total_profit_loss = sum(sale['profit_loss'] for sale in session_sales)
    drinks_sold = sum(sale['quantity'] for sale in session_sales)
    
    # Créer le fichier CSV de la session
    session_id = current_session.get('session_id')
    if not session_id:
        # Générer un ID si manquant (cas de reprise de session ancienne)
        session_id = datetime.now().strftime("%Y%m%d_%H%M%S")
        current_session['session_id'] = session_id

    # Si c'est une session reprise, utiliser le nom de fichier original
    resumed_from = current_session.get('resumed_from')
    if resumed_from:
        session_filename = f"data/{resumed_from}"
    else:
        session_filename = f"data/session_{session_id}.csv"
    
    try:
        with open(session_filename, 'w', newline='', encoding='utf-8') as csvfile:
            fieldnames = ['drink_id', 'drink_name', 'quantity', 'unit_price', 'base_price', 
                         'total_price', 'profit_loss', 'timestamp']
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
            
            # En-tête avec infos de session
            writer.writeheader()
            
            # Ligne de résumé de session
            start_time = current_session.get("start_time") or current_session.get("created_at", datetime.now().isoformat())
            writer.writerow({
                'drink_id': 'SESSION_SUMMARY',
                'drink_name': f'Session: {current_session["session_name"]}',
                'quantity': drinks_sold,
                'unit_price': f'Start: {start_time}',
                'base_price': f'End: {datetime.now().isoformat()}',
                'total_price': total_sales,
                'profit_loss': total_profit_loss,
                'timestamp': '' # Anciennement 'Starting Cash'
            })
            
            # Ligne vide pour séparer
            writer.writerow({k: '' for k in fieldnames})
            
            # Toutes les ventes
            for sale in session_sales:
                writer.writerow(sale)
    
        # Marquer la session comme terminée
        current_session['is_active'] = False
        current_session['end_time'] = datetime.now().isoformat()
        current_session['total_sales'] = total_sales
        current_session['total_profit_loss'] = total_profit_loss
        current_session['drinks_sold'] = drinks_sold
        
        # Supprimer le fichier de session temporaire
        if os.path.exists('data/current_session.json'):
            os.remove('data/current_session.json')
            print("Fichier de session temporaire supprimé.")
        
        session_data = {
            "session": current_session,
            "stats": {
                "total_sales": total_sales,
                "total_profit_loss": total_profit_loss,
                "drinks_sold": drinks_sold,
                "session_file": session_filename
            }
        }
        
        # Réinitialiser pour la prochaine session
        current_session = None
        session_sales = []
        
        return {"status": "success", "message": f"Session sauvegardée dans {session_filename}", "data": session_data}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur lors de la sauvegarde: {str(e)}")

@app.post("/admin/session/resume")
async def resume_session(admin: str = Depends(get_current_admin)):
    """Reprendre une session interrompue (en cas de crash)"""
    global current_session, session_sales
    
    if current_session and current_session.get('is_active'):
        return {"status": "already_active", "session": current_session}
    
    # Charger la session sauvegardée
    load_session_if_exists()

    if current_session and current_session.get('is_active'):
        return {"status": "resumed", "session": current_session, "sales_count": len(session_sales)}
    else:
        return {"status": "no_session", "message": "Aucune session à reprendre"}

@app.get("/admin/sessions/list")
async def list_previous_sessions(admin: str = Depends(get_current_admin)):
    """Lister toutes les sessions précédentes"""
    import glob
    import os
    import pandas as pd
    
    sessions = []
    session_files = glob.glob("data/session_*.csv")
    
    for file_path in session_files:
        try:
            # Vérifier que le fichier existe toujours
            if not os.path.exists(file_path):
                continue
                
            filename = os.path.basename(file_path)
            # Parse le nom de fichier pour extraire les infos
            if filename.startswith("session_session_"):
                timestamp_str = filename.replace("session_session_", "").replace(".csv", "")
                created_at = datetime.strptime(timestamp_str, "%Y%m%d_%H%M%S")
            else:
                # Fallback sur les stats du fichier
                created_at = datetime.fromtimestamp(os.path.getctime(file_path))
            
            # Lire les données de la session depuis le CSV
            try:
                df = pd.read_csv(file_path)
                
                # Nettoyer les données : supprimer les lignes vides et les valeurs NaN
                df = df.dropna(how='all')  # Supprimer les lignes complètement vides
                df = df.fillna(0)  # Remplacer les NaN par 0
                
                if len(df) > 0:
                    # Filtrer les lignes qui ne sont pas SESSION_SUMMARY pour les calculs
                    data_rows = df[df['drink_id'] != 'SESSION_SUMMARY']
                    summary_rows = df[df['drink_id'] == 'SESSION_SUMMARY']
                    
                    # Gérer les valeurs NaN avec fillna() et valeurs par défaut
                    total_sales = data_rows['total_price'].fillna(0).sum()
                    total_profit_loss = data_rows['profit_loss'].fillna(0).sum() 
                    total_drinks_sold = data_rows['quantity'].fillna(0).sum()
                    
                    # Extraire le nom de session depuis SESSION_SUMMARY
                    if len(summary_rows) > 0:
                        session_info = summary_rows.iloc[0]['drink_name']  # "Session: Alice" ou "Barman: Alice" (rétrocompatibilité)
                        if session_info and session_info.startswith('Session: '):
                            session_name = session_info.replace('Session: ', '')
                        elif session_info and session_info.startswith('Barman: '):
                            session_name = session_info.replace('Barman: ', '')
                        else:
                            session_name = session_info or "Session inconnue"
                    else:
                        # Fallback: extraire depuis le nom de fichier
                        if filename.startswith("session_session_"):
                            timestamp_str = filename.replace("session_session_", "").replace(".csv", "")
                            session_name = f"Session {timestamp_str}"
                        else:
                            session_name = filename.replace("session_", "").replace(".csv", "")
                    
                    # Calculer la durée depuis SESSION_SUMMARY si disponible
                    duration_hours = None
                    if len(summary_rows) > 0:
                        try:
                            # Extraire les timestamps de début/fin du SESSION_SUMMARY
                            start_str = str(summary_rows.iloc[0]['unit_price'])  # Start: timestamp
                            end_str = str(summary_rows.iloc[0]['base_price'])    # End: timestamp
                            
                            if start_str and end_str and start_str.startswith('Start: ') and end_str.startswith('End: '):
                                start_time_str = start_str.replace('Start: ', '')
                                end_time_str = end_str.replace('End: ', '')
                                
                                start_time = pd.to_datetime(start_time_str)
                                end_time = pd.to_datetime(end_time_str)
                                duration_hours = (end_time - start_time).total_seconds() / 3600
                        except Exception as e:
                            print(f"Erreur calcul durée session {filename}: {e}")
                            duration_hours = None
                    
                    # Fallback: calculer depuis les ventes si pas de SESSION_SUMMARY
                    if duration_hours is None and len(data_rows) > 1:
                        try:
                            first_sale = pd.to_datetime(data_rows['timestamp'].iloc[0])
                            last_sale = pd.to_datetime(data_rows['timestamp'].iloc[-1])
                            duration_hours = (last_sale - first_sale).total_seconds() / 3600
                        except:
                            duration_hours = None
                else:
                    total_sales = 0
                    total_profit_loss = 0
                    total_drinks_sold = 0
                    session_name = "Session vide"
                    duration_hours = None
                    
            except Exception as e:
                # Si erreur de lecture CSV, utiliser des valeurs par défaut
                total_sales = 0
                total_profit_loss = 0
                total_drinks_sold = 0
                session_name = "Données indisponibles"
                duration_hours = None
            
            sessions.append({
                "filename": filename,
                "created_at": created_at.isoformat(),
                "session_name": session_name,  # Changé de barman_name à session_name
                "total_sales": float(total_sales) if not pd.isna(total_sales) else 0.0,
                "total_profit_loss": float(total_profit_loss) if not pd.isna(total_profit_loss) else 0.0,
                "total_drinks_sold": int(total_drinks_sold) if not pd.isna(total_drinks_sold) else 0,
                "duration_hours": float(duration_hours) if duration_hours is not None and not pd.isna(duration_hours) else None
            })
            
        except Exception as e:
            print(f"Erreur lors de l'analyse de {file_path}: {e}")
            continue
    
    return {"sessions": sessions}

@app.post("/admin/session/resume/{filename:path}")
async def resume_specific_session(filename: str, admin: str = Depends(get_current_admin)):
    """Reprendre une session spécifique à partir de son fichier CSV."""
    global current_session, session_sales
    
    import os
    import pandas as pd

    if current_session and current_session.get('is_active'):
        raise HTTPException(status_code=409, detail="Une autre session est déjà active. Veuillez la terminer d'abord.")

    if not filename.endswith('.csv') or '..' in filename:
        raise HTTPException(status_code=400, detail="Nom de fichier invalide")
    
    file_path = f"data/{filename}"
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail=f"Session {filename} non trouvée.")

    try:
        df = pd.read_csv(file_path)
        df = df.dropna(how='all').fillna(0)
        
        summary_rows = df[df['drink_id'] == 'SESSION_SUMMARY']
        if summary_rows.empty:
            raise HTTPException(status_code=400, detail="Fichier de session invalide (pas de résumé).")

        summary = summary_rows.iloc[0]
        
        session_name_info = summary['drink_name']
        if session_name_info and 'Session: ' in str(session_name_info):
            session_name = str(session_name_info).replace('Session: ', '')
        else:
            session_name = "Session Reprise"

        start_time_info = summary['unit_price']
        if start_time_info and 'Start: ' in str(start_time_info):
            start_time = str(start_time_info).replace('Start: ', '')
        else:
            start_time = datetime.now().isoformat()

        current_session = {
            "session_id": f"session_{filename.replace('.csv', '')}",
            "session_name": session_name,
            "start_time": start_time,
            "is_active": True,
            "resumed_from": filename
        }

        sales_df = df[df['drink_id'] != 'SESSION_SUMMARY'].dropna(subset=['drink_id'])
        sales_df['quantity'] = pd.to_numeric(sales_df['quantity'], errors='coerce').fillna(0).astype(int)
        sales_df['unit_price'] = pd.to_numeric(sales_df['unit_price'], errors='coerce').fillna(0).astype(float)
        sales_df['base_price'] = pd.to_numeric(sales_df['base_price'], errors='coerce').fillna(0).astype(float)
        sales_df['total_price'] = pd.to_numeric(sales_df['total_price'], errors='coerce').fillna(0).astype(float)
        sales_df['profit_loss'] = pd.to_numeric(sales_df['profit_loss'], errors='coerce').fillna(0).astype(float)
        
        session_sales = sales_df.to_dict('records')
        
        save_session()

        return {"status": "resumed", "session": current_session}

    except Exception as e:
        current_session = None
        session_sales = []
        raise HTTPException(status_code=500, detail=f"Erreur lors de la reprise de session: {str(e)}")

@app.delete("/admin/session/delete/{filename:path}")
async def delete_session(filename: str, admin: str = Depends(get_current_admin)):
    """Supprimer une session spécifique"""
    import os
    
    # Sécurité : vérifier que le fichier existe et est valide
    if not filename.endswith('.csv') or '..' in filename:
        raise HTTPException(status_code=400, detail="Nom de fichier invalide")
    
    file_path = f"data/{filename}"
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Session non trouvée")
    
    try:
        os.remove(file_path)
        return {"status": "deleted", "message": f"Session {filename} supprimée avec succès"}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur lors de la suppression: {str(e)}")

@app.get("/admin/session/export/{filename:path}")
async def export_session_treasury(filename: str, admin: str = Depends(get_current_admin)):
    """Exporter la trésorerie d'une session en CSV."""
    import os
    import pandas as pd

    # Sécurité
    if not filename.endswith('.csv') or '..' in filename:
        raise HTTPException(status_code=400, detail="Nom de fichier invalide")
    
    file_path = f"data/{filename}"
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Session non trouvée")

    try:
        df = pd.read_csv(file_path)
        
        # Filtrer les ventes réelles
        sales_df = df[df['drink_id'] != 'SESSION_SUMMARY'].dropna(subset=['drink_id'])
        sales_df['quantity'] = pd.to_numeric(sales_df['quantity'], errors='coerce').fillna(0)
        sales_df['total_price'] = pd.to_numeric(sales_df['total_price'], errors='coerce').fillna(0)
        sales_df['profit_loss'] = pd.to_numeric(sales_df['profit_loss'], errors='coerce').fillna(0)

        # Agréger les données par boisson
        treasury_df = sales_df.groupby('drink_name').agg(
            Quantite_Vendue=('quantity', 'sum'),
            Chiffre_Affaires_Total=('total_price', 'sum'),
            Profit_Perte_Total=('profit_loss', 'sum')
        ).reset_index()

        # Renommer la colonne
        treasury_df.rename(columns={'drink_name': 'Boisson'}, inplace=True)

        # Ajouter une ligne de totaux
        total_row = pd.DataFrame({
            'Boisson': ['TOTAL'],
            'Quantite_Vendue': [treasury_df['Quantite_Vendue'].sum()],
            'Chiffre_Affaires_Total': [treasury_df['Chiffre_Affaires_Total'].sum()],
            'Profit_Perte_Total': [treasury_df['Profit_Perte_Total'].sum()]
        })
        
        treasury_df = pd.concat([treasury_df, total_row], ignore_index=True)

        output = io.StringIO()
        treasury_df.to_csv(output, index=False, sep=';', encoding='utf-8-sig')
        output.seek(0)

        download_filename = f"tresorerie_{filename}"
        return StreamingResponse(iter([output.getvalue()]), media_type="text/csv", headers={"Content-Disposition": f"attachment; filename={download_filename}"})

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur lors de la génération du CSV: {str(e)}")

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
    # Vérifier qu'une session est active avant d'ajouter une boisson
    check_session_active()
    
    try:
        drink = data_manager.add_drink(
            payload.name, 
            payload.base_price, 
            payload.min_price, 
            payload.max_price, 
            payload.alcohol_degree
        )
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

@app.post("/admin/history/undo")
async def admin_undo_transaction(admin: str = Depends(get_current_admin)):
    undone = data_manager.undo_last_transaction()
    if not undone:
        raise HTTPException(status_code=404, detail="Aucune transaction à annuler")
    return {"status": "undone", "details": undone}

@app.post('/admin/market/crash')
async def admin_trigger_crash(level: str = "medium", admin: str = Depends(get_current_admin)):
    """
    Déclenche un crash du marché avec différents niveaux
    level: small, medium, large, maximum
    """
    valid_levels = ['small', 'medium', 'large', 'maximum']
    if level not in valid_levels:
        raise HTTPException(status_code=400, detail=f"Niveau invalide. Utilisez: {', '.join(valid_levels)}")
    
    data_manager.trigger_crash(level)
    return {'status': 'crash_triggered', 'level': level, 'admin': admin}

@app.post('/admin/market/boom')
async def admin_trigger_boom(level: str = "medium", admin: str = Depends(get_current_admin)):
    """
    Déclenche un boom du marché avec différents niveaux
    level: small, medium, large, maximum
    """
    valid_levels = ['small', 'medium', 'large', 'maximum']
    if level not in valid_levels:
        raise HTTPException(status_code=400, detail=f"Niveau invalide. Utilisez: {', '.join(valid_levels)}")
    
    data_manager.trigger_boom(level)
    return {'status': 'boom_triggered', 'level': level, 'admin': admin}

@app.post('/admin/market/reset')
async def admin_reset_market(admin: str = Depends(get_current_admin)):
    data_manager.reset_prices()
    return {'status': 'market_reset', 'admin': admin}

@app.post('/admin/happy-hour/start')
async def admin_start_happy_hour(request: Request, admin: str = Depends(get_current_admin)):
    data = await request.json()
    drink_id = data.get('drink_id')
    duration = data.get('duration', 300)  # 5 minutes par défaut
    
    if not drink_id:
        raise HTTPException(status_code=400, detail="drink_id requis")
    
    if duration <= 0 or duration > 7200:  # Maximum 2 heures
        raise HTTPException(status_code=400, detail="Durée invalide (1-7200 secondes)")
    
    try:
        result = data_manager.start_happy_hour(drink_id, duration)
        return {'status': 'happy_hour_started', 'data': result, 'admin': admin}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post('/admin/happy-hour/stop/{drink_id}')
async def admin_stop_happy_hour(drink_id: int, admin: str = Depends(get_current_admin)):
    success = data_manager.stop_happy_hour(drink_id)
    if not success:
        raise HTTPException(status_code=404, detail="Happy Hour non trouvée pour cette boisson")
    return {'status': 'happy_hour_stopped', 'drink_id': drink_id, 'admin': admin}

@app.post('/admin/happy-hour/stop-all')
async def admin_stop_all_happy_hours(admin: str = Depends(get_current_admin)):
    count = data_manager.stop_all_happy_hours()
    return {'status': 'all_happy_hours_stopped', 'count': count, 'admin': admin}

@app.get('/admin/happy-hour/active')
async def admin_get_active_happy_hours(admin: str = Depends(get_current_admin)):
    active_hours = data_manager.get_active_happy_hours()
    return {'active_happy_hours': active_hours}

@app.get('/happy-hour/active')
async def get_public_active_happy_hours():
    """Endpoint public pour que le client puisse connaître les Happy Hours actives"""
    active_hours = data_manager.get_active_happy_hours()
    return {'active_happy_hours': active_hours}

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

# --- Static Files and SPA Handling ---
client_path = os.path.join(os.path.dirname(__file__), 'client')
if os.path.isdir(client_path):
    # This mount should be the last thing in the file. It will serve index.html for "/"
    # and will pass requests to API routes if no file is found.
    app.mount("/", StaticFiles(directory=client_path, html=True), name="static")

if __name__ == "__main__":
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=False)
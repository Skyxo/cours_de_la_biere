#!/usr/bin/env python3
"""
Script de test pour vérifier la synchronisation du timer
"""

import requests
import json
import time
from datetime import datetime

BASE_URL = "http://localhost:8000"

def test_sync_timer():
    """Test de l'endpoint de synchronisation du timer"""
    try:
        response = requests.get(f"{BASE_URL}/sync/timer")
        if response.status_code == 200:
            data = response.json()
            print("✅ Endpoint /sync/timer fonctionne")
            print(f"   - Intervalle: {data['interval_ms']}ms")
            print(f"   - Temps restant: {data['timer_remaining_ms']}ms")
            print(f"   - Timer démarré: {data['market_timer_start']}")
            return True
        else:
            print(f"❌ Erreur /sync/timer: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Erreur /sync/timer: {e}")
        return False

def test_prices_endpoint():
    """Test de l'endpoint /prices avec les nouvelles données"""
    try:
        response = requests.get(f"{BASE_URL}/prices")
        if response.status_code == 200:
            data = response.json()
            print("✅ Endpoint /prices fonctionne")
            
            # Vérifier les nouvelles clés
            required_keys = ['server_time', 'timer_remaining_ms', 'market_timer_start']
            for key in required_keys:
                if key in data:
                    print(f"   ✅ {key}: {data[key]}")
                else:
                    print(f"   ❌ Clé manquante: {key}")
            
            return True
        else:
            print(f"❌ Erreur /prices: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Erreur /prices: {e}")
        return False

def test_timer_sync_multiple_calls():
    """Test de cohérence de la synchronisation sur plusieurs appels"""
    print("\n🔄 Test de cohérence du timer sur 5 appels...")
    
    for i in range(5):
        try:
            response = requests.get(f"{BASE_URL}/sync/timer")
            if response.status_code == 200:
                data = response.json()
                remaining_sec = data['timer_remaining_ms'] / 1000
                print(f"   Appel {i+1}: {remaining_sec:.1f}s restantes")
            time.sleep(1)  # Attendre 1 seconde entre les appels
        except Exception as e:
            print(f"   ❌ Erreur appel {i+1}: {e}")

if __name__ == "__main__":
    print("🧪 Tests de synchronisation du timer Wall Street Bar")
    print("=" * 60)
    
    # Test 1: Endpoint de synchronisation
    print("\n1️⃣ Test /sync/timer")
    test_sync_timer()
    
    # Test 2: Endpoint /prices
    print("\n2️⃣ Test /prices avec données de sync")
    test_prices_endpoint()
    
    # Test 3: Cohérence temporelle
    test_timer_sync_multiple_calls()
    
    print("\n✅ Tests terminés")

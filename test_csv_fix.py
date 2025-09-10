#!/usr/bin/env python3
"""
Script de test pour vérifier que la modification d'une boisson via l'API admin
ne supprime pas le contenu du CSV.
"""
import requests
import json

# Configuration
BASE_URL = "http://localhost:8000"
# Credentials pour l'admin (remplacez par vos vraies credentials)
USERNAME = "admin"
PASSWORD = "admin123"

def test_drink_modification():
    print("🧪 Test de modification d'une boisson via l'API admin")
    
    # 1. Lire le CSV avant la modification
    print("\n📋 État du CSV avant modification:")
    with open('data/drinks.csv', 'r') as f:
        lines_before = f.readlines()
        print(f"   Nombre de lignes: {len(lines_before)}")
        for i, line in enumerate(lines_before[:5]):  # Afficher les 5 premières lignes
            print(f"   Ligne {i+1}: {line.strip()}")
        if len(lines_before) > 5:
            print("   ...")
    
    # 2. Effectuer une modification via l'API
    print(f"\n🔧 Modification de la boisson ID=1 via PATCH /admin/drinks/1")
    
    # Préparer les données de modification
    modification_data = {
        "name": "Leffe Blonde Modifiée",
        "base_price": 1.55,  # Changement léger du prix de base
        "min_price": 1.00,
        "max_price": 2.50,
        "price": 1.55
    }
    
    try:
        # Appel à l'API avec authentication basique
        response = requests.patch(
            f"{BASE_URL}/admin/drinks/1",
            json=modification_data,
            auth=(USERNAME, PASSWORD),
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code == 200:
            print(f"   ✅ Modification réussie: {response.json()}")
        else:
            print(f"   ❌ Erreur HTTP {response.status_code}: {response.text}")
            return False
            
    except requests.exceptions.ConnectionError:
        print("   ❌ Impossible de se connecter au serveur. Assurez-vous qu'il fonctionne.")
        return False
    except Exception as e:
        print(f"   ❌ Erreur lors de la requête: {e}")
        return False
    
    # 3. Lire le CSV après la modification
    print(f"\n📋 État du CSV après modification:")
    with open('data/drinks.csv', 'r') as f:
        lines_after = f.readlines()
        print(f"   Nombre de lignes: {len(lines_after)}")
        for i, line in enumerate(lines_after[:5]):  # Afficher les 5 premières lignes
            print(f"   Ligne {i+1}: {line.strip()}")
        if len(lines_after) > 5:
            print("   ...")
    
    # 4. Comparer les résultats
    print(f"\n🔍 Analyse des résultats:")
    if len(lines_before) == len(lines_after):
        print(f"   ✅ Nombre de lignes conservé: {len(lines_after)}")
    else:
        print(f"   ❌ Nombre de lignes changé: {len(lines_before)} → {len(lines_after)}")
        
    # Vérifier si la colonne alcohol_degree est toujours présente
    if len(lines_after) > 0:
        header = lines_after[0].strip()
        if 'alcohol_degree' in header:
            print(f"   ✅ Colonne 'alcohol_degree' conservée")
        else:
            print(f"   ❌ Colonne 'alcohol_degree' supprimée!")
            print(f"   En-tête actuel: {header}")
    
    # Vérifier que la modification a bien eu lieu
    if len(lines_after) > 1:
        first_data_line = lines_after[1].strip()
        if "Leffe Blonde Modifiée" in first_data_line and "1.55" in first_data_line:
            print(f"   ✅ Modification appliquée correctement")
            print(f"   Nouvelle ligne: {first_data_line}")
        else:
            print(f"   ❌ Modification non appliquée")
            print(f"   Ligne actuelle: {first_data_line}")
    
    print(f"\n🏁 Test terminé!")
    return True

if __name__ == "__main__":
    test_drink_modification()

#!/usr/bin/env python3

import sys
import os
sys.path.append(os.path.dirname(__file__))

from csv_data import CSVData

def test_history():
    csv_data = CSVData("data")
    
    print("=== État initial de l'historique ===")
    history = csv_data.get_history(50)
    print(f"Nombre d'entrées: {len(history)}")
    if len(history) > 0:
        for entry in history[-5:]:  # Dernières 5 entrées
            print(f"- {entry['name']}: {entry['event']} (prix: {entry['price']}, change: {entry['change']})")
    else:
        print("Aucune entrée dans l'historique")
    
    print("\n=== Application de fluctuations du marché ===")
    changes_count = csv_data.apply_market_fluctuations()
    print(f"Nombre de prix modifiés: {changes_count}")
    
    print("\n=== Déclenchement d'un boom petit ===")
    csv_data.trigger_boom("small")
    
    print("\n=== Nouvel état de l'historique ===")
    history = csv_data.get_history(50)
    print(f"Nombre d'entrées: {len(history)}")
    for entry in history[-10:]:  # Dernières 10 entrées
        print(f"- {entry['name']}: {entry['event']} (prix: {entry['price']:.2f}€, change: {entry['change']:.3f}€)")

if __name__ == "__main__":
    test_history()

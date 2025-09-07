# File: csv_data.py
"""
Gestion des données en CSV pour le Wall Street Bar.
Remplace la base SQLite par des fichiers CSV plus simples.
"""
import csv
import os
import json
from datetime import datetime
from typing import List, Dict, Optional, Tuple
import random
import time
from advanced_pricing import AdvancedPricingEngine, EventType

class CSVDataManager:
    def __init__(self, data_dir="data"):
        self.data_dir = data_dir
        self.drinks_file = os.path.join(data_dir, "drinks.csv")
        self.history_file = os.path.join(data_dir, "history.csv")
        
        # Créer le dossier data s'il n'existe pas
        os.makedirs(data_dir, exist_ok=True)
        
        # Initialiser le moteur de prix avancé
        self.pricing_engine = AdvancedPricingEngine()
        
        # Initialiser les fichiers CSV s'ils n'existent pas
        self._init_files()
    
    def _init_files(self):
        """Initialise les fichiers CSV avec les données par défaut"""
        # Fichier des boissons
        if not os.path.exists(self.drinks_file):
            with open(self.drinks_file, 'w', newline='', encoding='utf-8') as f:
                writer = csv.writer(f)
                writer.writerow(['id', 'name', 'price', 'base_price', 'min_price', 'max_price'])
                # Données par défaut
                drinks = [
                    [1, 'Pilsner', 5.0, 5.0, 3.0, 10.0],
                    [2, 'IPA', 6.0, 6.0, 4.0, 12.0],
                    [3, 'Cocktail', 9.0, 9.0, 6.0, 15.0],
                    [4, 'Soft', 3.0, 3.0, 2.0, 6.0],
                    [5, 'Shot', 4.0, 4.0, 2.0, 8.0],
                ]
                writer.writerows(drinks)
        
        # Fichier de l'historique
        if not os.path.exists(self.history_file):
            with open(self.history_file, 'w', newline='', encoding='utf-8') as f:
                writer = csv.writer(f)
                writer.writerow(['id', 'drink_id', 'name', 'price', 'quantity', 'change', 'event', 'timestamp'])
    
    def get_all_prices(self) -> List[Dict]:
        """Récupère tous les prix actuels"""
        prices = []
        with open(self.drinks_file, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                prices.append({
                    'id': int(row['id']),
                    'name': row['name'],
                    'price': float(row['price']),
                    'base_price': float(row['base_price']),
                    'min_price': float(row['min_price']),
                    'max_price': float(row['max_price'])
                })
        return prices
    
    def get_drink_by_id(self, drink_id: int) -> Optional[Dict]:
        """Récupère une boisson par son ID"""
        with open(self.drinks_file, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                if int(row['id']) == drink_id:
                    return {
                        'id': int(row['id']),
                        'name': row['name'],
                        'price': float(row['price']),
                        'base_price': float(row['base_price']),
                        'min_price': float(row['min_price']),
                        'max_price': float(row['max_price'])
                    }
        return None
    
    def update_drink_price(self, drink_id: int, new_price: float):
        """Met à jour le prix d'une boisson"""
        # Lire toutes les données
        drinks = []
        with open(self.drinks_file, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                if int(row['id']) == drink_id:
                    row['price'] = str(new_price)
                drinks.append(row)
        
        # Réécrire le fichier
        with open(self.drinks_file, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=['id', 'name', 'price', 'base_price', 'min_price', 'max_price'])
            writer.writeheader()
            writer.writerows(drinks)
    
    def add_history_entry(self, drink_id: int, name: str, price: float, quantity: int, change: float, event: str):
        """Ajoute une entrée à l'historique"""
        # Générer un ID unique basé sur le timestamp
        entry_id = int(datetime.now().timestamp() * 1000000) % 1000000
        
        with open(self.history_file, 'a', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow([
                entry_id,
                drink_id,
                name,
                price,
                quantity,
                change,
                event,
                datetime.now().isoformat()
            ])
    
    def get_history(self, limit: int = 100) -> List[Dict]:
        """Récupère l'historique des transactions"""
        history = []
        with open(self.history_file, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            rows = list(reader)
            # Prendre les dernières entrées
            for row in rows[-limit:]:
                history.append({
                    'id': int(row['id']),
                    'drink_id': int(row['drink_id']),
                    'name': row['name'],
                    'price': float(row['price']),
                    'quantity': int(row['quantity']),
                    'change': float(row['change']),
                    'event': row['event'],
                    'timestamp': row['timestamp']
                })
        return history

    def update_history_entry(self, entry_id: int, quantity: Optional[int] = None, event: Optional[str] = None) -> Optional[Dict]:
        """Met à jour une entrée de l'historique (quantity, event) par ID et retourne l'entrée mise à jour.
        Ne recalcul pas rétroactivement les prix du marché.
        """
        updated_row = None
        fieldnames = ['id', 'drink_id', 'name', 'price', 'quantity', 'change', 'event', 'timestamp']

        # Lire toutes les lignes
        with open(self.history_file, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            rows = list(reader)

        # Mettre à jour la ligne ciblée
        for row in rows:
            if str(row['id']) == str(entry_id):
                if quantity is not None:
                    row['quantity'] = str(max(0, int(quantity)))
                if event is not None and event != '':
                    row['event'] = str(event)
                updated_row = row
                break

        if updated_row is None:
            return None

        # Réécrire le fichier complet
        with open(self.history_file, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(rows)

        # Retourner l'entrée mise à jour castée
        return {
            'id': int(updated_row['id']),
            'drink_id': int(updated_row['drink_id']),
            'name': updated_row['name'],
            'price': float(updated_row['price']),
            'quantity': int(updated_row['quantity']),
            'change': float(updated_row['change']),
            'event': updated_row['event'],
            'timestamp': updated_row['timestamp']
        }

    def delete_history_entry(self, entry_id: int) -> bool:
        """Supprime une entrée de l'historique par ID. Retourne True si supprimé, False sinon."""
        fieldnames = ['id', 'drink_id', 'name', 'price', 'quantity', 'change', 'event', 'timestamp']
        with open(self.history_file, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            rows = list(reader)
        new_rows = [row for row in rows if str(row['id']) != str(entry_id)]
        if len(new_rows) == len(rows):
            return False
        with open(self.history_file, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(new_rows)
        return True

    def revert_and_delete_history_entry(self, entry_id: int) -> bool:
        """Annule l'effet prix d'une entrée d'historique puis supprime l'entrée.
        Retourne True si trouvé/supprimé, False sinon.
        """
        fieldnames = ['id', 'drink_id', 'name', 'price', 'quantity', 'change', 'event', 'timestamp']
        with open(self.history_file, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            rows = list(reader)

        target = None
        for row in rows:
            if str(row['id']) == str(entry_id):
                target = row
                break

        if target is None:
            return False

        # Revert current price by subtracting the original change
        drink_id = int(target['drink_id'])
        try:
            original_change = float(target['change'])
        except Exception:
            original_change = 0.0

        drink = self.get_drink_by_id(drink_id)
        if drink is not None and original_change != 0.0:
            reverted_price = max(drink['min_price'], min(drink['max_price'], drink['price'] - original_change))
            # Only update if different to avoid unnecessary writes
            if abs(reverted_price - drink['price']) > 1e-9:
                self.update_drink_price(drink_id, round(reverted_price, 4))

        # Now remove the history entry
        new_rows = [row for row in rows if str(row['id']) != str(entry_id)]
        with open(self.history_file, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(new_rows)
        return True
    
    def apply_buy(self, drink_id: int, quantity: int) -> Dict:
        """Applique un achat et met à jour les prix avec le moteur avancé"""
        drink = self.get_drink_by_id(drink_id)
        if not drink:
            raise ValueError('Boisson introuvable')
        
        # Obtenir toutes les boissons pour les corrélations
        all_drinks = self.get_all_prices()
        drinks_dict = {str(d['id']): d for d in all_drinks}
        
        # Calculer le changement de prix avec le moteur avancé
        drink_name = drink['name'].lower()
        price_change, event_type = self.pricing_engine.calculate_price_change(
            drink_name, quantity, drink['base_price'], drink['price'], drinks_dict
        )
        
        # Appliquer le changement
        new_price = round(max(drink['min_price'], 
                             min(drink['max_price'], drink['price'] + price_change)), 4)
        change = round(new_price - drink['price'], 4)
        
        # Mettre à jour le prix
        self.update_drink_price(drink_id, new_price)
        
        # Enregistrer dans l'historique
        self.add_history_entry(drink_id, drink['name'], new_price, quantity, change, event_type)
        
        # Appliquer des effets de corrélation aux autres boissons
        for other_drink in all_drinks:
            if other_drink['id'] != drink_id:
                other_name = other_drink['name'].lower()
                correlation_effect = self.pricing_engine.calculate_correlation_effect(
                    other_name, drinks_dict
                )
                
                if abs(correlation_effect) > 0.001:  # Seuil de sensibilité
                    new_other_price = round(max(other_drink['min_price'], 
                                              min(other_drink['max_price'], 
                                                  other_drink['price'] + correlation_effect)), 4)
                    change_other = round(new_other_price - other_drink['price'], 4)
                    
                    if change_other != 0:
                        self.update_drink_price(other_drink['id'], new_other_price)
                        self.add_history_entry(other_drink['id'], other_drink['name'], 
                                             new_other_price, 0, change_other, 'correlation')
        
        # Retourner la boisson mise à jour
        return self.get_drink_by_id(drink_id)
    
    def reset_prices(self):
        """Remet tous les prix à leur valeur de base"""
        drinks = self.get_all_prices()
        for drink in drinks:
            self.update_drink_price(drink['id'], drink['base_price'])
            self.add_history_entry(drink['id'], drink['name'], drink['base_price'], 0, 0, 'reset')
    
    def trigger_crash(self):
        """Déclenche un krach : baisse brutale de tous les prix"""
        # Forcer un événement de krach dans le moteur
        self.pricing_engine.force_event(EventType.CRASH, 300)  # 5 minutes
        
        drinks = self.get_all_prices()
        for drink in drinks:
            drink_name = drink['name'].lower()
            crash_effect = self.pricing_engine.calculate_crash_effect(drink_name)
            new_price = round(max(drink['min_price'], drink['price'] + crash_effect), 4)
            change = round(new_price - drink['price'], 4)
            if change != 0:
                self.update_drink_price(drink['id'], new_price)
                self.add_history_entry(drink['id'], drink['name'], new_price, 0, change, 'crash')
    
    # Purge: toutes les fonctions de sauvegarde et d'événements spéciaux ont été supprimées pour simplifier le code.

    # --- CRUD Boissons ---
    def _next_drink_id(self) -> int:
        drinks = self.get_all_prices()
        if not drinks:
            return 1
        return max(d['id'] for d in drinks) + 1

    def add_drink(self, name: str, base_price: float, min_price: float, max_price: float) -> Dict:
        """Ajoute une nouvelle boisson avec un prix initial = base_price"""
        new_id = self._next_drink_id()
        # Sanity: bornes
        base_price = float(base_price)
        min_price = float(min_price)
        max_price = float(max_price)
        if not name or min_price <= 0 or max_price <= 0 or base_price <= 0:
            raise ValueError('Paramètres invalides pour la boisson')
        if not (min_price <= base_price <= max_price):
            raise ValueError('base_price doit être entre min_price et max_price')

        # Append to CSV
        with open(self.drinks_file, 'a', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow([new_id, name, base_price, base_price, min_price, max_price])
        return {
            'id': new_id,
            'name': name,
            'price': base_price,
            'base_price': base_price,
            'min_price': min_price,
            'max_price': max_price,
        }

    def update_drink_fields(self, drink_id: int, name: Optional[str] = None,
                             base_price: Optional[float] = None,
                             min_price: Optional[float] = None,
                             max_price: Optional[float] = None,
                             price: Optional[float] = None) -> Optional[Dict]:
        """Met à jour des champs d'une boisson. Retourne la boisson mise à jour."""
        updated = None
        with open(self.drinks_file, 'r', encoding='utf-8') as f:
            rows = list(csv.DictReader(f))

        for row in rows:
            if int(row['id']) == drink_id:
                # Calculer nouveaux champs en vérifiant bornes
                new_name = name if name is not None else row['name']
                new_base = float(base_price) if base_price is not None else float(row['base_price'])
                new_min = float(min_price) if min_price is not None else float(row['min_price'])
                new_max = float(max_price) if max_price is not None else float(row['max_price'])
                new_price = float(price) if price is not None else float(row['price'])

                if not (new_min <= new_base <= new_max):
                    raise ValueError('base_price doit être entre min_price et max_price')
                if not (new_min <= new_price <= new_max):
                    raise ValueError('price doit être entre min_price et max_price')

                row['name'] = new_name
                row['base_price'] = str(new_base)
                row['min_price'] = str(new_min)
                row['max_price'] = str(new_max)
                row['price'] = str(new_price)

                updated = row
                break

        if updated is None:
            return None

        with open(self.drinks_file, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=['id', 'name', 'price', 'base_price', 'min_price', 'max_price'])
            writer.writeheader()
            writer.writerows(rows)

        return {
            'id': int(updated['id']),
            'name': updated['name'],
            'price': float(updated['price']),
            'base_price': float(updated['base_price']),
            'min_price': float(updated['min_price']),
            'max_price': float(updated['max_price']),
        }

    def delete_drink(self, drink_id: int) -> bool:
        """Supprime une boisson du catalogue (l'historique n'est pas modifié)."""
        with open(self.drinks_file, 'r', encoding='utf-8') as f:
            rows = list(csv.DictReader(f))
        new_rows = [r for r in rows if int(r['id']) != drink_id]
        if len(new_rows) == len(rows):
            return False
        with open(self.drinks_file, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=['id', 'name', 'price', 'base_price', 'min_price', 'max_price'])
            writer.writeheader()
            writer.writerows(new_rows)
        return True

    def clear_history(self) -> None:
        """Supprime toutes les entrées de l'historique (réécrit le header uniquement)."""
        with open(self.history_file, 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow(['id', 'drink_id', 'name', 'price', 'quantity', 'change', 'event', 'timestamp'])

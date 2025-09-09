import csv
import os
from datetime import datetime
from typing import List, Dict, Optional
import random

class CSVDataManager:
    def __init__(self, data_dir="data"):
        self.data_dir = data_dir
        self.drinks_file = os.path.join(data_dir, "drinks.csv")
        self.history_file = os.path.join(data_dir, "history.csv")
        
        os.makedirs(data_dir, exist_ok=True)
        self._init_files()
    
    @staticmethod
    def round_to_ten_cents(price: float) -> float:
        """Arrondit un prix aux 10 centimes près pour l'affichage uniquement"""
        return round(price * 10) / 10
    
    def _init_files(self):
        if not os.path.exists(self.drinks_file):
            with open(self.drinks_file, 'w', newline='', encoding='utf-8') as f:
                writer = csv.writer(f)
                writer.writerow(['id', 'name', 'price', 'base_price', 'min_price', 'max_price'])
                drinks = [
                    [1, 'Pilsner', 5.0, 5.0, 3.0, 10.0],
                    [2, 'IPA', 6.0, 6.0, 4.0, 12.0],
                    [3, 'Cocktail', 9.0, 9.0, 6.0, 15.0],
                    [4, 'Soft', 3.0, 3.0, 2.0, 6.0],
                    [5, 'Shot', 4.0, 4.0, 2.0, 8.0],
                ]
                writer.writerows(drinks)
        
        if not os.path.exists(self.history_file):
            with open(self.history_file, 'w', newline='', encoding='utf-8') as f:
                writer = csv.writer(f)
                writer.writerow(['id', 'drink_id', 'name', 'price', 'quantity', 'change', 'event', 'timestamp'])
    
    def get_all_prices(self) -> List[Dict]:
        prices = []
        with open(self.drinks_file, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                exact_price = float(row['price'])
                prices.append({
                    'id': int(row['id']),
                    'name': row['name'],
                    'price': exact_price,
                    'price_rounded': self.round_to_ten_cents(exact_price),
                    'base_price': float(row['base_price']),
                    'min_price': float(row['min_price']),
                    'max_price': float(row['max_price'])
                })
        return prices
    
    def get_drink_by_id(self, drink_id: int) -> Optional[Dict]:
        with open(self.drinks_file, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                if int(row['id']) == drink_id:
                    exact_price = float(row['price'])
                    exact_base_price = float(row['base_price'])
                    exact_min_price = float(row['min_price'])
                    exact_max_price = float(row['max_price'])
                    return {
                        'id': int(row['id']),
                        'name': row['name'],
                        'price': exact_price,
                        'price_rounded': self.round_to_ten_cents(exact_price),
                        'base_price': exact_base_price,
                        'min_price': exact_min_price,
                        'max_price': exact_max_price
                    }
        return None
    
    def update_drink_price(self, drink_id: int, new_price: float):
        drinks = []
        # Stocker le prix exact sans arrondi
        with open(self.drinks_file, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                if int(row['id']) == drink_id:
                    row['price'] = str(new_price)
                drinks.append(row)
        
        with open(self.drinks_file, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=['id', 'name', 'price', 'base_price', 'min_price', 'max_price'])
            writer.writeheader()
            writer.writerows(drinks)
    
    def add_history_entry(self, drink_id: int, name: str, price: float, quantity: int, change: float, event: str):
        entry_id = int(datetime.now().timestamp() * 1000000) % 1000000
        
        # Ajouter la nouvelle entrée
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
        
        # Limiter l'historique à 10 entrées pour éviter l'accumulation
        self._limit_history(10)
    
    def _limit_history(self, max_entries: int = 10):
        """Limite l'historique au nombre d'entrées spécifié pour éviter l'accumulation infinie"""
        try:
            with open(self.history_file, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                rows = list(reader)
            
            if len(rows) > max_entries:
                # Garder seulement les dernières entrées
                recent_rows = rows[-max_entries:]
                
                with open(self.history_file, 'w', newline='', encoding='utf-8') as f:
                    writer = csv.DictWriter(f, fieldnames=['id', 'drink_id', 'name', 'price', 'quantity', 'change', 'event', 'timestamp'])
                    writer.writeheader()
                    writer.writerows(recent_rows)
        except Exception:
            # En cas d'erreur, ne pas faire planter le système
            pass
    
    def get_history(self, limit: int = 10) -> List[Dict]:
        history = []
        with open(self.history_file, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            rows = list(reader)
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
        updated_row = None
        fieldnames = ['id', 'drink_id', 'name', 'price', 'quantity', 'change', 'event', 'timestamp']

        with open(self.history_file, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            rows = list(reader)

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

        with open(self.history_file, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(rows)

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

        drink_id = int(target['drink_id'])
        try:
            original_change = float(target['change'])
        except Exception:
            original_change = 0.0

        drink = self.get_drink_by_id(drink_id)
        if drink is not None and original_change != 0.0:
            reverted_price = max(drink['min_price'], min(drink['max_price'], drink['price'] - original_change))
            if abs(reverted_price - drink['price']) > 1e-9:
                self.update_drink_price(drink_id, reverted_price)

        new_rows = [row for row in rows if str(row['id']) != str(entry_id)]
        with open(self.history_file, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(new_rows)
        return True
    
    def apply_buy(self, drink_id: int, quantity: int) -> Dict:
        drink = self.get_drink_by_id(drink_id)
        if not drink:
            raise ValueError('Boisson introuvable')

        all_drinks = self.get_all_prices()

        step_up = max(0.01 * float(drink['base_price']) * int(quantity), 0.01)
        new_price = max(drink['min_price'], min(drink['max_price'], drink['price'] + step_up))
        change = new_price - drink['price']

        self.update_drink_price(drink_id, new_price)
        self.add_history_entry(drink_id, drink['name'], new_price, quantity, change, 'buy')

        for other in all_drinks:
            if other['id'] == drink_id:
                continue
            current = float(other['price'])
            step_down = 0.005 * current * int(quantity)
            if step_down <= 0:
                continue
            new_other = max(float(other['min_price']), min(float(other['max_price']), current - step_down))
            change_other = new_other - current
            if change_other != 0:
                self.update_drink_price(other['id'], new_other)
                self.add_history_entry(other['id'], other['name'], new_other, 0, change_other, 'balance')

        return self.get_drink_by_id(drink_id)
    
    def apply_buy_simple(self, drink_id: int, quantity: int) -> Dict:
        drink = self.get_drink_by_id(drink_id)
        if not drink:
            raise ValueError('Boisson introuvable')

        step_up = max(0.01 * float(drink['base_price']) * int(quantity), 0.01)
        new_price = max(drink['min_price'], min(drink['max_price'], drink['price'] + step_up))
        change = new_price - drink['price']

        self.update_drink_price(drink_id, new_price)
        self.add_history_entry(drink_id, drink['name'], new_price, quantity, change, 'buy')

        return self.get_drink_by_id(drink_id)
    
    def reset_prices(self):
        drinks = self.get_all_prices()
        for drink in drinks:
            self.update_drink_price(drink['id'], drink['base_price'])
            self.add_history_entry(drink['id'], drink['name'], drink['base_price'], 0, 0, 'reset')
    
    def trigger_crash(self):
        drinks = self.get_all_prices()
        for drink in drinks:
            crash_effect = random.uniform(-0.3, -0.1) * drink['price']
            new_price = max(drink['min_price'], drink['price'] + crash_effect)
            change = new_price - drink['price']
            if change != 0:
                self.update_drink_price(drink['id'], new_price)
                self.add_history_entry(drink['id'], drink['name'], new_price, 0, change, 'crash')
    
    def trigger_boom(self):
        drinks = self.get_all_prices()
        for drink in drinks:
            boom_effect = random.uniform(0.1, 0.3) * drink['price']
            new_price = min(drink['max_price'], drink['price'] + boom_effect)
            change = new_price - drink['price']
            if change != 0:
                self.update_drink_price(drink['id'], new_price)
                self.add_history_entry(drink['id'], drink['name'], new_price, 0, change, 'boom')
    
    def _next_drink_id(self) -> int:
        drinks = self.get_all_prices()
        if not drinks:
            return 1
        return max(d['id'] for d in drinks) + 1

    def add_drink(self, name: str, base_price: float, min_price: float, max_price: float) -> Dict:
        new_id = self._next_drink_id()
        base_price = float(base_price)
        min_price = float(min_price)
        max_price = float(max_price)
        if not name or min_price <= 0 or max_price <= 0 or base_price <= 0:
            raise ValueError('Paramètres invalides pour la boisson')
        if not (min_price <= base_price <= max_price):
            raise ValueError('base_price doit être entre min_price et max_price')

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
        updated = None
        with open(self.drinks_file, 'r', encoding='utf-8') as f:
            rows = list(csv.DictReader(f))

        for row in rows:
            if int(row['id']) == drink_id:
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
        with open(self.history_file, 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow(['id', 'drink_id', 'name', 'price', 'quantity', 'change', 'event', 'timestamp'])

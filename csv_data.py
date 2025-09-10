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
        
        # Structure pour gérer les Happy Hours actives
        self.active_happy_hours = {}  # {drink_id: {'start_time': datetime, 'duration': int}}
        
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
                writer.writerow(['id', 'name', 'price', 'base_price', 'min_price', 'max_price', 'alcohol_degree'])
                drinks = [
                    [1, 'Pilsner', 5.0, 5.0, 3.0, 10.0, 5.0],
                    [2, 'IPA', 6.0, 6.0, 4.0, 12.0, 6.5],
                    [3, 'Cocktail', 9.0, 9.0, 6.0, 15.0, 12.0],
                    [4, 'Soft', 3.0, 3.0, 2.0, 6.0, 0.0],
                    [5, 'Shot', 4.0, 4.0, 2.0, 8.0, 40.0],
                ]
                writer.writerows(drinks)
        
        if not os.path.exists(self.history_file):
            with open(self.history_file, 'w', newline='', encoding='utf-8') as f:
                writer = csv.writer(f)
                writer.writerow(['id', 'drink_id', 'name', 'price', 'quantity', 'change', 'event', 'timestamp'])
    
    def get_all_prices(self) -> List[Dict]:
        prices = []
        try:
            # Nettoyer les Happy Hours expirées avant de calculer les prix
            self._clean_expired_happy_hours()
            
            with open(self.drinks_file, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    try:
                        drink_id = int(row['id'])
                        exact_price = float(row['price'])
                        min_price = float(row['min_price'])
                        
                        # Vérifier si cette boisson est en Happy Hour
                        display_price = exact_price
                        is_happy_hour = drink_id in self.active_happy_hours
                        
                        if is_happy_hour:
                            # Pendant une Happy Hour, le prix affiché est le prix minimum
                            display_price = min_price
                        
                        prices.append({
                            'id': drink_id,
                            'name': row['name'],
                            'price': exact_price,  # Prix réel (pour les calculs internes)
                            'display_price': display_price,  # Prix affiché (réduit pendant Happy Hour)
                            'price_rounded': self.round_to_ten_cents(display_price),
                            'base_price': float(row['base_price']),
                            'min_price': min_price,
                            'max_price': float(row['max_price']),
                            'alcohol_degree': float(row.get('alcohol_degree') or 0),  # Degré d'alcool avec gestion des valeurs vides
                            'is_happy_hour': is_happy_hour
                        })
                    except (ValueError, KeyError) as e:
                        print(f"Erreur parsing ligne CSV drink {row.get('id', 'unknown')}: {e}")
                        continue
        except FileNotFoundError:
            print(f"Fichier {self.drinks_file} introuvable")
        except Exception as e:
            print(f"Erreur dans get_all_prices: {e}")
        return prices
    
    def get_drink_by_id(self, drink_id: int) -> Optional[Dict]:
        # Nettoyer les Happy Hours expirées
        self._clean_expired_happy_hours()
        
        with open(self.drinks_file, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                if int(row['id']) == drink_id:
                    exact_price = float(row['price'])
                    exact_base_price = float(row['base_price'])
                    exact_min_price = float(row['min_price'])
                    exact_max_price = float(row['max_price'])
                    
                    # Vérifier si cette boisson est en Happy Hour
                    display_price = exact_price
                    is_happy_hour = drink_id in self.active_happy_hours
                    
                    if is_happy_hour:
                        # Pendant une Happy Hour, le prix affiché est le prix minimum
                        display_price = exact_min_price
                    
                    return {
                        'id': int(row['id']),
                        'name': row['name'],
                        'price': exact_price,  # Prix réel (pour les calculs internes)
                        'display_price': display_price,  # Prix affiché (réduit pendant Happy Hour)
                        'price_rounded': self.round_to_ten_cents(display_price),
                        'base_price': exact_base_price,
                        'min_price': exact_min_price,
                        'max_price': exact_max_price,
                        'alcohol_degree': float(row.get('alcohol_degree') or 0),  # Degré d'alcool avec gestion des valeurs vides
                        'is_happy_hour': is_happy_hour
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
            writer = csv.DictWriter(f, fieldnames=['id', 'name', 'price', 'base_price', 'min_price', 'max_price', 'alcohol_degree'])
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
        
        # Nettoyage automatique si l'historique devient trop volumineux
        self._cleanup_history_if_needed()
    
    def _cleanup_history_if_needed(self):
        """Nettoie l'historique si il dépasse 10000 entrées pour maintenir les performances"""
        try:
            # Compter les lignes
            with open(self.history_file, 'r', encoding='utf-8') as f:
                line_count = sum(1 for _ in f)
            
            # Si plus de 10000 lignes, garder seulement les 5000 dernières
            if line_count > 10000:
                with open(self.history_file, 'r', encoding='utf-8') as f:
                    reader = csv.reader(f)
                    header = next(reader)
                    all_rows = list(reader)
                
                # Garder les 5000 dernières entrées
                recent_rows = all_rows[-5000:]
                
                with open(self.history_file, 'w', newline='', encoding='utf-8') as f:
                    writer = csv.writer(f)
                    writer.writerow(header)
                    writer.writerows(recent_rows)
                    
        except Exception as e:
            print(f"Erreur lors du nettoyage historique: {e}")
        
        # Limiter l'historique à 50 entrées pour avoir plus de visibilité
        self._limit_history(50)
    
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
    
    def trigger_crash(self, level='medium'):
        """
        Déclenche un crash du marché avec différents niveaux d'intensité
        level: 'small', 'medium', 'large', 'maximum'
        """
        drinks = self.get_all_prices()
        
        # Définir les plages d'effets selon le niveau
        effect_ranges = {
            'small': (-0.15, -0.05),   # Petit crash: -5% à -15%
            'medium': (-0.3, -0.1),    # Moyen crash: -10% à -30%
            'large': (-0.5, -0.2),     # Gros crash: -20% à -50%
            'maximum': (None, None)     # Maximum: prix minimum
        }
        
        if level not in effect_ranges:
            level = 'medium'
            
        for drink in drinks:
            if level == 'maximum':
                # Crash maximal: aller directement au prix minimum
                new_price = drink['min_price']
            else:
                # Crash avec pourcentage aléatoire dans la plage
                min_effect, max_effect = effect_ranges[level]
                crash_effect = random.uniform(min_effect, max_effect) * drink['price']
                new_price = max(drink['min_price'], drink['price'] + crash_effect)
            
            change = new_price - drink['price']
            if change != 0:
                self.update_drink_price(drink['id'], new_price)
                self.add_history_entry(drink['id'], drink['name'], new_price, 0, change, f'crash_{level}')
    
    def trigger_boom(self, level='medium'):
        """
        Déclenche un boom du marché avec différents niveaux d'intensité
        level: 'small', 'medium', 'large', 'maximum'
        """
        drinks = self.get_all_prices()
        
        # Définir les plages d'effets selon le niveau
        effect_ranges = {
            'small': (0.05, 0.15),     # Petit boom: +5% à +15%
            'medium': (0.1, 0.3),      # Moyen boom: +10% à +30%
            'large': (0.2, 0.5),       # Gros boom: +20% à +50%
            'maximum': (None, None)     # Maximum: prix maximum
        }
        
        if level not in effect_ranges:
            level = 'medium'
            
        for drink in drinks:
            if level == 'maximum':
                # Boom maximal: aller directement au prix maximum
                new_price = drink['max_price']
            else:
                # Boom avec pourcentage aléatoire dans la plage
                min_effect, max_effect = effect_ranges[level]
                boom_effect = random.uniform(min_effect, max_effect) * drink['price']
                new_price = min(drink['max_price'], drink['price'] + boom_effect)
            
            change = new_price - drink['price']
            if change != 0:
                self.update_drink_price(drink['id'], new_price)
                self.add_history_entry(drink['id'], drink['name'], new_price, 0, change, f'boom_{level}')
    
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

    def start_happy_hour(self, drink_id: int, duration_seconds: int) -> Dict:
        """Démarre une Happy Hour pour une boisson spécifique"""
        drink = self.get_drink_by_id(drink_id)
        if not drink:
            raise ValueError('Boisson introuvable')
        
        # Nettoyer les Happy Hours expirées
        self._clean_expired_happy_hours()
        
        # Ajouter la nouvelle Happy Hour
        self.active_happy_hours[drink_id] = {
            'start_time': datetime.now(),
            'duration': duration_seconds,
            'drink_name': drink['name']
        }
        
        # Ajouter à l'historique
        self.add_history_entry(drink_id, drink['name'], drink['price'], 0, 0, f'happy_hour_start_{duration_seconds}s')
        
        return {
            'drink_id': drink_id,
            'drink_name': drink['name'],
            'duration': duration_seconds,
            'start_time': datetime.now().isoformat()
        }
    
    def stop_happy_hour(self, drink_id: int) -> bool:
        """Arrête une Happy Hour pour une boisson spécifique"""
        if drink_id in self.active_happy_hours:
            drink_info = self.active_happy_hours[drink_id]
            drink = self.get_drink_by_id(drink_id)
            
            if drink:
                self.add_history_entry(drink_id, drink['name'], drink['price'], 0, 0, 'happy_hour_stop')
            
            del self.active_happy_hours[drink_id]
            return True
        return False
    
    def stop_all_happy_hours(self) -> int:
        """Arrête toutes les Happy Hours actives"""
        count = len(self.active_happy_hours)
        
        # Ajouter à l'historique pour chaque Happy Hour arrêtée
        for drink_id, happy_hour_info in self.active_happy_hours.items():
            drink = self.get_drink_by_id(drink_id)
            if drink:
                self.add_history_entry(drink_id, drink['name'], drink['price'], 0, 0, 'happy_hour_stop_all')
        
        self.active_happy_hours.clear()
        return count
    
    def get_active_happy_hours(self) -> List[Dict]:
        """Retourne la liste des Happy Hours actives"""
        # Nettoyer les Happy Hours expirées
        self._clean_expired_happy_hours()
        
        active_hours = []
        for drink_id, happy_hour_info in self.active_happy_hours.items():
            start_time = happy_hour_info['start_time']
            duration = happy_hour_info['duration']
            elapsed = (datetime.now() - start_time).total_seconds()
            remaining = max(0, duration - elapsed)
            
            active_hours.append({
                'drink_id': drink_id,
                'drink_name': happy_hour_info['drink_name'],
                'start_time': start_time.isoformat(),
                'duration': duration,
                'elapsed': int(elapsed),
                'remaining': int(remaining)
            })
        
        return active_hours
    
    def _clean_expired_happy_hours(self):
        """Nettoie automatiquement les Happy Hours expirées"""
        current_time = datetime.now()
        expired_drinks = []
        
        for drink_id, happy_hour_info in self.active_happy_hours.items():
            start_time = happy_hour_info['start_time']
            duration = happy_hour_info['duration']
            
            if (current_time - start_time).total_seconds() >= duration:
                expired_drinks.append(drink_id)
        
        # Supprimer les Happy Hours expirées
        for drink_id in expired_drinks:
            happy_hour_info = self.active_happy_hours[drink_id]
            drink_name = happy_hour_info.get('drink_name', f'Drink {drink_id}')
            # Éviter la récursion en ne cherchant pas le drink par ID
            # Utiliser les infos stockées dans happy_hour_info
            self.add_history_entry(drink_id, drink_name, 0, 0, 0, 'happy_hour_expired')
            del self.active_happy_hours[drink_id]
    
    def is_drink_in_happy_hour(self, drink_id: int) -> bool:
        """Vérifie si une boisson est actuellement en Happy Hour"""
        self._clean_expired_happy_hours()
        return drink_id in self.active_happy_hours

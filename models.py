# File: models.py
"""
Helper functions and data structures for the Wall Street Bar backend.
Currently minimal since logic sits in server.py for step 1.
"""
from typing import Dict

# leave space to expand complex pricing logic here in later steps


import random
import time

class Drink:
    def __init__(self, id, name, base_price, min_price, max_price):
        self.id = id
        self.name = name
        self.base_price = base_price
        self.price = base_price
        self.min_price = min_price
        self.max_price = max_price
        self.history = [(time.time(), base_price)]

    def adjust_price(self, delta):
        """Ajuste le prix en respectant les bornes min/max"""
        self.price = max(self.min_price, min(self.max_price, self.price + delta))
        self.history.append((time.time(), self.price))

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "price": self.price,
            "min_price": self.min_price,
            "max_price": self.max_price,
        }


class Market:
    def __init__(self):
        # Tu peux ajuster la liste de boissons ici
        self.drinks = {
            "beer": Drink("beer", "Bière", base_price=5.0, min_price=3.0, max_price=8.0),
            "cocktail": Drink("cocktail", "Cocktail", base_price=8.0, min_price=5.0, max_price=12.0),
            "soft": Drink("soft", "Soft", base_price=3.0, min_price=2.0, max_price=5.0),
        }

    def get_prices(self):
        return [drink.to_dict() for drink in self.drinks.values()]

    def record_sale(self, drink_id, quantity=1):
        if drink_id not in self.drinks:
            raise ValueError("Boisson inconnue")

        drink = self.drinks[drink_id]

        # Règle 1 : hausse proportionnelle aux ventes
        drink.adjust_price(0.2 * quantity)

        # Règle 2 : les autres baissent légèrement (effet équilibre)
        for d_id, d in self.drinks.items():
            if d_id != drink_id:
                d.adjust_price(-0.05 * quantity)

    def apply_decay(self):
        """Baisse naturelle des prix (si aucune vente)"""
        for d in self.drinks.values():
            d.adjust_price(-0.01)

    def trigger_crash(self):
        """Événement spécial : krach = baisse brutale"""
        for d in self.drinks.values():
            d.adjust_price(-random.uniform(1.0, 3.0))

# File: advanced_pricing.py
"""
Système de prix dynamiques avancé pour le Wall Street Bar.
Implémente des algorithmes sophistiqués de simulation de marché.
"""
import random
import math
import time
from datetime import datetime, timedelta
from typing import Dict, List, Tuple, Optional
from enum import Enum

class MarketTrend(Enum):
    BULL = "bull"      # Marché haussier
    BEAR = "bear"      # Marché baissier
    SIDEWAYS = "sideways"  # Marché latéral
    VOLATILE = "volatile"  # Marché volatil

class EventType(Enum):
    NORMAL = "normal"
    RUSH_HOUR = "rush_hour"      # Heure de pointe
    HAPPY_HOUR = "happy_hour"    # Happy hour
    WEEKEND = "weekend"          # Week-end
    SPECIAL_EVENT = "special"    # Événement spécial
    CRASH = "crash"              # Krach
    RECOVERY = "recovery"        # Récupération

class AdvancedPricingEngine:
    def __init__(self):
        self.market_trend = MarketTrend.SIDEWAYS
        self.volatility = 0.1  # Volatilité de base (10%)
        self.trend_strength = 0.5  # Force de la tendance (0-1)
        self.last_trend_change = time.time()
        self.event_active = None
        self.event_end_time = None
        self.crash_recovery_mode = False
        self.crash_recovery_start = None
        
        # Configuration des événements
        self.event_probabilities = {
            EventType.RUSH_HOUR: 0.15,    # 15% de chance par heure
            EventType.HAPPY_HOUR: 0.20,   # 20% de chance par heure
            EventType.WEEKEND: 0.30,      # 30% de chance le week-end
            EventType.SPECIAL_EVENT: 0.05, # 5% de chance par heure
            EventType.CRASH: 0.02,        # 2% de chance par heure
        }
        
        # Corrélations entre boissons (0 = pas de corrélation, 1 = corrélation parfaite)
        self.correlations = {
            "beer": {"cocktail": 0.3, "soft": -0.2, "shot": 0.4},
            "cocktail": {"beer": 0.3, "soft": -0.1, "shot": 0.6},
            "soft": {"beer": -0.2, "cocktail": -0.1, "shot": -0.3},
            "shot": {"beer": 0.4, "cocktail": 0.6, "soft": -0.3},
        }
    
    def get_current_event(self) -> Optional[EventType]:
        """Détermine l'événement actuel basé sur l'heure et la probabilité"""
        now = datetime.now()
        hour = now.hour
        weekday = now.weekday()  # 0 = lundi, 6 = dimanche
        
        # Vérifier si un événement est déjà actif
        if self.event_active and self.event_end_time and time.time() < self.event_end_time:
            return self.event_active
        
        # Vérifier les événements basés sur l'heure
        if 17 <= hour <= 19:  # Rush hour (17h-19h)
            if random.random() < self.event_probabilities[EventType.RUSH_HOUR]:
                self.event_active = EventType.RUSH_HOUR
                self.event_end_time = time.time() + 3600  # 1 heure
                return self.event_active
        
        if 18 <= hour <= 20:  # Happy hour (18h-20h)
            if random.random() < self.event_probabilities[EventType.HAPPY_HOUR]:
                self.event_active = EventType.HAPPY_HOUR
                self.event_end_time = time.time() + 7200  # 2 heures
                return self.event_active
        
        if weekday >= 5:  # Week-end (samedi/dimanche)
            if random.random() < self.event_probabilities[EventType.WEEKEND]:
                self.event_active = EventType.WEEKEND
                self.event_end_time = time.time() + 86400  # 24 heures
                return self.event_active
        
        # Événements aléatoires
        if random.random() < self.event_probabilities[EventType.SPECIAL_EVENT]:
            self.event_active = EventType.SPECIAL_EVENT
            self.event_end_time = time.time() + 1800  # 30 minutes
            return self.event_active
        
        # Krach aléatoire
        if random.random() < self.event_probabilities[EventType.CRASH]:
            self.event_active = EventType.CRASH
            self.event_end_time = time.time() + 300  # 5 minutes
            return self.event_active
        
        # Aucun événement spécial
        self.event_active = None
        self.event_end_time = None
        return EventType.NORMAL
    
    def update_market_trend(self):
        """Met à jour la tendance générale du marché"""
        now = time.time()
        
        # Changer de tendance toutes les 2-6 heures
        if now - self.last_trend_change > random.uniform(7200, 21600):
            trends = list(MarketTrend)
            self.market_trend = random.choice(trends)
            self.trend_strength = random.uniform(0.3, 0.8)
            self.last_trend_change = now
            
            # Ajuster la volatilité selon la tendance
            if self.market_trend == MarketTrend.VOLATILE:
                self.volatility = random.uniform(0.15, 0.25)
            elif self.market_trend == MarketTrend.SIDEWAYS:
                self.volatility = random.uniform(0.05, 0.15)
            else:
                self.volatility = random.uniform(0.1, 0.2)
    
    def calculate_base_change(self, drink_id: str, quantity: int, base_price: float) -> float:
        """Calcule le changement de prix de base basé sur l'achat"""
        # Changement proportionnel à la quantité
        base_change = 0.01 * quantity * base_price
        
        # Ajustement selon la tendance du marché
        if self.market_trend == MarketTrend.BULL:
            base_change *= (1 + self.trend_strength * 0.5)
        elif self.market_trend == MarketTrend.BEAR:
            base_change *= (1 - self.trend_strength * 0.3)
        elif self.market_trend == MarketTrend.VOLATILE:
            base_change *= (1 + random.uniform(-0.5, 0.5))
        
        return base_change
    
    def calculate_volatility_adjustment(self, drink_id: str) -> float:
        """Calcule l'ajustement de volatilité pour une boisson"""
        # Volatilité de base
        volatility_change = random.gauss(0, self.volatility * 0.1)
        
        # Ajustement selon l'événement actuel
        event = self.get_current_event()
        if event == EventType.RUSH_HOUR:
            volatility_change *= 1.5
        elif event == EventType.HAPPY_HOUR:
            volatility_change *= 0.8
        elif event == EventType.WEEKEND:
            volatility_change *= 1.2
        elif event == EventType.SPECIAL_EVENT:
            volatility_change *= 2.0
        
        return volatility_change
    
    def calculate_correlation_effect(self, drink_id: str, other_drinks: Dict) -> float:
        """Calcule l'effet de corrélation avec les autres boissons"""
        total_effect = 0
        
        for other_id, other_drink in other_drinks.items():
            if other_id != drink_id:
                correlation = self.correlations.get(drink_id, {}).get(other_id, 0)
                if correlation != 0:
                    # L'effet dépend de la variation récente de l'autre boisson
                    recent_change = getattr(other_drink, 'recent_change', 0)
                    total_effect += correlation * recent_change * 0.1
        
        return total_effect
    
    def calculate_event_effect(self, drink_id: str, event: EventType) -> float:
        """Calcule l'effet d'un événement spécial sur le prix"""
        if event == EventType.NORMAL:
            return 0
        
        # Effets spécifiques par type de boisson
        drink_effects = {
            "beer": {
                EventType.RUSH_HOUR: 0.05,      # Hausse pendant le rush
                EventType.HAPPY_HOUR: -0.03,    # Baisse pendant happy hour
                EventType.WEEKEND: 0.08,        # Hausse le week-end
                EventType.SPECIAL_EVENT: 0.10,  # Hausse lors d'événements
            },
            "cocktail": {
                EventType.RUSH_HOUR: 0.08,
                EventType.HAPPY_HOUR: 0.12,     # Hausse pendant happy hour
                EventType.WEEKEND: 0.15,
                EventType.SPECIAL_EVENT: 0.20,
            },
            "soft": {
                EventType.RUSH_HOUR: 0.02,
                EventType.HAPPY_HOUR: -0.05,    # Baisse pendant happy hour
                EventType.WEEKEND: 0.03,
                EventType.SPECIAL_EVENT: 0.05,
            },
            "shot": {
                EventType.RUSH_HOUR: 0.06,
                EventType.HAPPY_HOUR: 0.10,
                EventType.WEEKEND: 0.12,
                EventType.SPECIAL_EVENT: 0.15,
            }
        }
        
        effect = drink_effects.get(drink_id, {}).get(event, 0)
        
        # Ajouter de la variabilité
        effect *= random.uniform(0.8, 1.2)
        
        return effect
    
    def calculate_crash_effect(self, drink_id: str) -> float:
        """Calcule l'effet d'un krach sur le prix"""
        # Effet de krach plus fort sur les boissons chères
        base_crash = random.uniform(-0.3, -0.1)  # -10% à -30%
        
        # Ajustement selon le type de boisson
        crash_multipliers = {
            "beer": 0.8,      # Moins affecté
            "cocktail": 1.2,  # Plus affecté
            "soft": 0.6,      # Moins affecté
            "shot": 1.0,      # Moyennement affecté
        }
        
        multiplier = crash_multipliers.get(drink_id, 1.0)
        return base_crash * multiplier
    
    def calculate_recovery_effect(self, drink_id: str) -> float:
        """Calcule l'effet de récupération après un krach"""
        if not self.crash_recovery_mode:
            return 0
        
        # Récupération progressive
        recovery_time = time.time() - self.crash_recovery_start
        recovery_factor = min(recovery_time / 3600, 1.0)  # 1 heure max
        
        # Récupération plus rapide pour les boissons populaires
        recovery_speeds = {
            "beer": 1.2,
            "cocktail": 0.8,
            "soft": 1.5,
            "shot": 1.0,
        }
        
        speed = recovery_speeds.get(drink_id, 1.0)
        return 0.02 * recovery_factor * speed  # Jusqu'à 2% de récupération
    
    def calculate_price_change(self, drink_id: str, quantity: int, base_price: float, 
                             current_price: float, other_drinks: Dict) -> Tuple[float, str]:
        """Calcule le changement de prix total pour une boisson"""
        # Mettre à jour la tendance du marché
        self.update_market_trend()
        
        # Obtenir l'événement actuel
        event = self.get_current_event()
        
        # Calculer les différents effets
        base_change = self.calculate_base_change(drink_id, quantity, base_price)
        volatility_change = self.calculate_volatility_adjustment(drink_id)
        correlation_effect = self.calculate_correlation_effect(drink_id, other_drinks)
        event_effect = self.calculate_event_effect(drink_id, event)
        
        # Effets spéciaux
        crash_effect = 0
        recovery_effect = 0
        
        if event == EventType.CRASH:
            crash_effect = self.calculate_crash_effect(drink_id)
            self.crash_recovery_mode = True
            self.crash_recovery_start = time.time()
        elif self.crash_recovery_mode:
            recovery_effect = self.calculate_recovery_effect(drink_id)
            # Arrêter la récupération après 1 heure
            if time.time() - self.crash_recovery_start > 3600:
                self.crash_recovery_mode = False
        
        # Calculer le changement total
        total_change = (base_change + volatility_change + correlation_effect + 
                       event_effect + crash_effect + recovery_effect)
        
        # Appliquer une limite de changement maximum (5% par transaction)
        max_change = current_price * 0.05
        total_change = max(-max_change, min(max_change, total_change))
        
        # Déterminer le type d'événement pour l'historique
        event_type = "buy"
        if event != EventType.NORMAL:
            event_type = event.value
        elif crash_effect != 0:
            event_type = "crash"
        elif recovery_effect != 0:
            event_type = "recovery"
        
        return total_change, event_type
    
    def get_market_status(self) -> Dict:
        """Retourne le statut actuel du marché"""
        event = self.get_current_event()
        
        return {
            "trend": self.market_trend.value,
            "trend_strength": self.trend_strength,
            "volatility": self.volatility,
            "current_event": event.value if event else "normal",
            "crash_recovery": self.crash_recovery_mode,
            "last_trend_change": self.last_trend_change
        }
    
    def force_event(self, event_type: EventType, duration: int = 3600):
        """Force un événement spécifique"""
        self.event_active = event_type
        self.event_end_time = time.time() + duration
        
        if event_type == EventType.CRASH:
            self.crash_recovery_mode = True
            self.crash_recovery_start = time.time()
    
    def reset_market(self):
        """Remet le marché à son état initial"""
        self.market_trend = MarketTrend.SIDEWAYS
        self.volatility = 0.1
        self.trend_strength = 0.5
        self.last_trend_change = time.time()
        self.event_active = None
        self.event_end_time = None
        self.crash_recovery_mode = False
        self.crash_recovery_start = None



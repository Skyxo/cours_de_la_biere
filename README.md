# 🍺 Cours de la Bière - Simulateur de Marché Boursier

Un simulateur interactif de marché boursier pour les bières, développé en Python/FastAPI avec une interface web dynamique. Les prix fluctuent en temps réel selon l'offre et la demande, créant une expérience immersive de trading de bières !

![Bourse des Bières](https://img.shields.io/badge/Status-Production-brightgreen)
![Python](https://img.shields.io/badge/Python-3.8+-blue)
![FastAPI](https://img.shields.io/badge/FastAPI-Latest-green)
![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-yellow)

## 🚀 Fonctionnalités Principales

### 📈 Marché en Temps Réel
- **Prix dynamiques** : Les prix fluctuent selon les achats/ventes
- **Timer universel** : Synchronisation automatique entre tous les clients
- **Graphiques interactifs** : Visualisation en temps réel avec Chart.js
- **Grille adaptive** : Interface responsive qui s'adapte au nombre de bières

### 🎯 Interface Utilisateur
- **Affichage client** : Grille des bières avec prix en temps réel
- **Interface admin** : Gestion complète du marché
- **Thèmes multiples** : Mode sombre/clair et thèmes colorés
- **Design responsive** : Optimisé pour tous les écrans (mobile, tablette, desktop)

### ⚡ Fonctionnalités Avancées
- **Happy Hours** : Promotions temporaires avec effets visuels
- **Événements de marché** : Crash et boom automatiques
- **Sessions de trading** : Suivi des bénéfices/pertes
- **Gestion des alcools** : Degrés d'alcool configurables
- **Prix arrondis** : Affichage aux 10 centimes près

### 🎮 Événements Spéciaux
- **Market Crash** : Chute brutale des prix (4 niveaux d'intensité)
- **Market Boom** : Explosion des prix (4 niveaux d'intensité)
- **Happy Hours** : Prix réduits temporaires avec animations
- **Reset Global** : Remise à zéro de tous les prix

## 🛠️ Technologies Utilisées

### Backend
- **Python 3.8+** avec FastAPI
- **Uvicorn** pour le serveur ASGI
- **CSV** pour la persistance des données
- **Threading** pour les timers asynchrones

### Frontend  
- **HTML5/CSS3** avec design moderne
- **JavaScript ES6+** (Vanilla, pas de framework)
- **Chart.js** pour les graphiques
- **CSS Grid/Flexbox** pour la responsivité

### Architecture
- **API RESTful** avec documentation automatique
- **WebSocket-like polling** pour la synchronisation
- **État partagé** entre tous les clients
- **Sauvegarde automatique** des données

## 📦 Installation

### Prérequis
- Python 3.8 ou supérieur
- pip (gestionnaire de packages Python)

### Installation rapide
```bash
# Cloner le projet
git clone https://github.com/votre-username/cours_de_la_biere.git
cd cours_de_la_biere

# Installer les dépendances
pip install -r requirements.txt

# Lancer le serveur
python server.py
```

### Accès à l'application
- **Interface client** : http://localhost:8000/
- **Interface admin** : http://localhost:8000/client/admin.html
- **Documentation API** : http://localhost:8000/docs

## 🎮 Utilisation

### Interface Client
1. Ouvrir http://localhost:8000/ dans votre navigateur
2. Observer les prix qui fluctuent en temps réel
3. Voir les graphiques de prix s'animer
4. Profiter des Happy Hours et événements spéciaux !

### Interface Admin
1. Ouvrir http://localhost:8000/client/admin.html
2. **Mot de passe par défaut** : `admin123`
3. Gérer les bières, déclencher des événements, suivre les statistiques. Le mot de passe est `admin`

### Fonctionnalités Admin
- ✅ Ajouter/Modifier/Supprimer des bières
- ✅ Déclencher des événements de marché
- ✅ Lancer des Happy Hours ciblées
- ✅ Consulter l'historique des transactions
- ✅ Gérer les sessions de trading
- ✅ Modifier les prix en direct

## 🌐 Déploiement

### Hébergement Cloud
Ce projet a été testé et déployé avec succès sur **[Zomro.com](https://zomro.com)**. 

⚠️ **Note importante** : Le serveur Zomro avait tendance à crasher toutes les 20 minutes si l'ordinateur de développement était éteint, car le processus `server.py` doit rester actif en permanence pour maintenir les timers et la synchronisation.

### Déploiement Local/Production
```bash
# Lancer en mode production (sans reload)
python server.py

# Ou avec Uvicorn directement
uvicorn server:app --host 0.0.0.0 --port 8000
```

## 📊 Structure du Projet

```
cours_de_la_biere/
├── server.py              # Serveur FastAPI principal
├── csv_data.py             # Gestion des données CSV
├── requirements.txt        # Dépendances Python
├── client/                 # Interface web
│   ├── index.html         # Page client principale  
│   ├── admin.html         # Interface d'administration
│   ├── app.js             # Logique client
│   ├── admin.js           # Logique admin
│   ├── charts.js          # Gestion des graphiques
│   └── style.css          # Styles CSS
└── data/                  # Données persistantes
    ├── drinks.csv         # Base de données des bières
    ├── history.csv        # Historique des transactions
    └── .gitkeep          # Préservation du dossier
```

## 🔧 Configuration

### Paramètres Serveur
- **Port** : 8000 (modifiable dans `server.py`)
- **Host** : 0.0.0.0 (accessible depuis le réseau)
- **Mot de passe admin** : `admin` (modifiable dans `server.py`)

### Paramètres du Marché
- **Intervalle de mise à jour** : 10 secondes (configurable)
- **Persistance** : Sauvegarde automatique toutes les 30 secondes
- **Happy Hours** : Durée de 1 seconde à 2 heures maximum

## 🎨 Personnalisation

### Ajouter des Bières
1. Via l'interface admin : http://localhost:8000/client/admin.html
2. Ou directement dans `data/drinks.csv`

### Modifier les Thèmes
- Éditer `client/style.css`
- Ajouter de nouveaux thèmes dans la section "Thèmes"
- Utiliser les boutons de thème dans l'interface

### Configurer les Événements
- Modifier les paramètres dans `server.py` 
- Ajuster les pourcentages de crash/boom
- Personnaliser les durées des Happy Hours

## 🐛 Dépannage

### Problèmes Courants
- **Port 8000 déjà utilisé** : Modifier le port dans `server.py`
- **Erreur de permissions** : Vérifier les droits d'écriture dans `/data`
- **Synchronisation manquée** : Redémarrer le serveur

### Logs de Debug
Les logs détaillés sont affichés dans la console du serveur pour diagnostiquer les problèmes.

## 📈 Roadmap

- [ ] Authentification utilisateur avancée
- [ ] Base de données SQL (PostgreSQL/SQLite)
- [ ] WebSockets pour synchronisation temps réel
- [ ] API mobile (React Native/Flutter)
- [ ] Système de notifications push
- [ ] Analytics avancées

## 👨‍💻 Développeur

**Charles Bergeat** (Nyhllö, U615, e24)  
📧 Email : [charles.bergeat@gmail.com](mailto:charles.bergeat@gmail.com)  
🎓 Projet développé dans le cadre des études d'ingénieur  

---

## 📄 Licence

Ce projet est développé à des fins éducatives et de démonstration. Libre d'utilisation et de modification.

---

## 🍻 Remerciements

Merci à tous ceux qui ont testé et contribué à l'amélioration de ce simulateur de marché des bières !

**Sec mes frères. 📐**
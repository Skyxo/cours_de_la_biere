# 🍺 Cours de la Bière - Simulation de Marché Boursier de Bar

Une application web immersive qui transforme le service de bar en expérience de trading interactif, où les prix des boissons fluctuent en temps réel selon les achats des clients, créant une atmosphère de marché boursier dynamique et engageante.

## 🎯 Concept

Ce système révolutionne l'expérience du bar en appliquant les mécaniques de marché financier aux boissons :
- Les prix fluctuent selon l'offre et la demande
- Les achats font monter les prix (forte demande)
- L'équilibrage automatique maintient l'attractivité du marché
- Les événements de marché (crash, boom, Happy Hour) pimentent la soirée
- Interface en temps réel avec graphiques financiers authentiques

## ✨ Fonctionnalités Principales

### 🎨 Interface Publique (Clients)
- **Affichage en temps réel** des prix avec animations fluides
- **Graphiques financiers** : Chandelier japonais, courbes, secteurs
- **Mode sombre/clair** adaptatif pour tous les environnements
- **Tri multi-critères** : Prix, alphabétique, degré d'alcool
- **Happy Hour visuel** : Animations dorées et indicateurs spéciaux
- **Responsive design** optimisé mobile/tablette/écran

### 🛠️ Interface Administration (Barmans)
- **Gestion de session** avec suivi de trésorerie en temps réel
- **Enregistrement d'achats** avec calcul automatique de profit/perte
- **Contrôles de marché** : Crash, boom, reset des prix
- **Happy Hour programmable** avec durée personnalisable
- **Historique complet** de toutes les transactions
- **Gestion des boissons** : CRUD complet avec prix min/base/max
- **Indicateurs prix** : Min/Base/Max visibles pour les barmans

### 🚀 Fonctionnalités Avancées
- **Système de session crash-resistant** : Sauvegarde automatique et reprise de session
- **Optimisations performance** : Retry automatique, throttling animations, nettoyage mémoire
- **Export automatique** : Génération CSV de fin de service pour comptabilité
- **Synchronisation multi-onglets** : Cohérence entre toutes les interfaces ouvertes
- **API robuste** : Gestion d'erreurs, timeouts, retry automatique

## 🛠️ Architecture Technique

### Backend (FastAPI)
```
server.py          # API REST principale
csv_data.py        # Gestionnaire de données CSV
data/
├── drinks.csv     # Base de données des boissons
└── history.csv    # Historique des transactions
```

### Frontend (Vanilla JS)
```
client/
├── index.html     # Interface publique (clients)
├── admin.html     # Interface administration (barmans)
├── app.js         # Logic interface publique
├── admin.js       # Logic interface administration
├── charts.js      # Moteur de graphiques Chart.js
└── style.css      # Styles unifiés responsive
```

### APIs Principales
- `GET /prices` - Prix actuels et données publiques
- `POST /buy` - Enregistrer un achat (fluctuation automatique)
- `POST /admin/market/{action}` - Contrôles de marché (crash/boom/reset)
- `POST /admin/happy-hour/start` - Démarrer Happy Hour
- `GET /admin/session/current` - État session active
- `POST /admin/session/{action}` - Gestion sessions (start/end/resume)

## 🚀 Installation et Déploiement

### Prérequis
- Python 3.8+
- pip (gestionnaire de paquets Python)

### Installation
```bash
# Cloner le projet
git clone [url-du-repo]
cd cours_de_la_biere

# Installer les dépendances
pip install -r requirements.txt

# Créer le répertoire de données
mkdir -p data

# Initialiser les données (optionnel - sera créé automatiquement)
# Créer drinks.csv avec vos boissons
```

### Lancement
```bash
# Démarrer le serveur
python server.py

# Interface publique : http://localhost:8000/client/index.html
# Interface admin :    http://localhost:8000/client/admin.html
```

### Configuration
- **Port** : Modifier dans `server.py` (défaut: 8000)
- **Données** : Éditer `data/drinks.csv` pour vos boissons
- **Authentification admin** : Username/password dans `server.py`

## 📊 Données et Configuration

### Structure des Boissons (drinks.csv)
```csv
id,name,price,base_price,min_price,max_price,alcohol_degree
1,Leffe Blonde,1.50,1.50,1.00,2.50,6.6
2,Paix Dieu,3.30,3.30,2.80,4.50,10.0
```

### Paramètres Clés
- **Fluctuation d'achat** : +5% du prix actuel par achat
- **Équilibrage automatique** : -5% sur les autres boissons
- **Limites prix** : Respect strict des min/max configurés
- **Happy Hour** : Prix fixe à (min + 0.20€) avec animation dorée
- **Nettoyage auto** : Historique limité à 5000 entrées pour performance

## 🎮 Guide d'Utilisation

### Pour les Clients
1. **Consulter les prix** sur l'écran public en temps réel
2. **Choisir le type d'affichage** : graphiques, liste, secteurs
3. **Profiter des Happy Hours** : boissons dorées à prix spécial
4. **Observer les fluctuations** causées par les autres clients

### Pour les Barmans
1. **Démarrer une session** avec nom du barman et caisse de départ
2. **Enregistrer chaque vente** via l'interface d'achat
3. **Utiliser les événements** (crash/boom) pour dynamiser la soirée
4. **Programmer des Happy Hours** pour booster certaines boissons
5. **Suivre les stats en temps réel** : CA, profit/perte, nombre de ventes
6. **Terminer la session** pour export CSV automatique

### Événements de Marché
- **💥 Crash** : -10% à -30% sur toutes les boissons (3 niveaux)
- **📈 Boom** : +10% à +30% sur toutes les boissons (3 niveaux)
- **🔄 Reset** : Retour aux prix de base
- **🍯 Happy Hour** : Prix spécial avec animations dorées

## 🔧 Personnalisation

### Ajout de Boissons
Éditer `data/drinks.csv` avec les colonnes requises :
- **id** : Identifiant unique
- **name** : Nom de la boisson
- **price** : Prix actuel
- **base_price** : Prix de référence
- **min_price** : Prix minimum possible
- **max_price** : Prix maximum possible
- **alcohol_degree** : Degré d'alcool

### Modification des Paramètres
Dans `csv_data.py` :
- Fluctuation d'achat : `price_increase_percent`
- Équilibrage : `balance_decrease_percent`
- Dans `client/app.js` : Intervalles de rafraîchissement

### Thèmes et Styles
Dans `client/style.css` :
- Variables CSS pour couleurs personnalisées
- Mode sombre/clair automatique
- Animations et transitions configurables

## 🛡️ Sécurité et Robustesse

### Sécurité
- **Authentification HTTP Basic** pour l'interface admin
- **Validation des données** côté serveur
- **Sanitisation des entrées** utilisateur
- **Séparation interfaces** publique/privée

### Robustesse
- **Retry automatique** des requêtes critiques
- **Gestion des timeouts** et erreurs réseau
- **Sauvegarde automatique** des sessions
- **Nettoyage mémoire** automatique
- **Historique limité** pour éviter la surcharge

### Performance
- **Throttling des animations** pour fluidité
- **Compression automatique** des réponses
- **Cache intelligent** côté client
- **Optimisation mobile** avec chargement adaptatif

## 📱 Compatibilité

### Navigateurs Supportés
- Chrome/Chromium 70+
- Firefox 65+
- Safari 12+
- Edge 79+
- Navigateurs mobiles modernes

### Dispositifs
- **Desktop** : Écrans larges avec interface complète
- **Tablette** : Interface adaptée tactile
- **Mobile** : Version responsive optimisée

## 🤝 Contribution et Support

### Technologies Utilisées
- **Backend** : FastAPI (Python) - API REST moderne et rapide
- **Frontend** : Vanilla JavaScript - Performances optimales sans framework
- **Graphiques** : Chart.js - Bibliothèque de graphiques professionnels
- **Stockage** : CSV - Simple, portable, éditable manuellement
- **Styles** : CSS3 avec variables - Thèmes adaptatifs et animations fluides

### Structure de Contribution
1. Fork du projet
2. Création de branche pour fonctionnalité
3. Tests locaux complets
4. Pull request avec description détaillée

## 📄 Licence

Ce projet est sous licence libre. Vous êtes encouragés à l'adapter, le modifier et le redistribuer selon vos besoins.

---

## 🍻 Prêt pour le Service !

Le système a été optimisé pour une utilisation en production lors de soirées réelles. Toutes les fonctionnalités sont robustes, les performances sont optimisées pour de longues sessions, et l'interface est intuitive pour clients et barmans.

**Démarrage rapide** :
```bash
python server.py
# → Interface publique : http://localhost:8000/client/index.html
# → Interface admin : http://localhost:8000/client/admin.html (admin/secret)
```

Bonne soirée et que les meilleurs traders l'emportent ! 🍺📈

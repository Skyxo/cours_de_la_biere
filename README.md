# 📈 Wall Street Bar - Système de Prix Dynamiques

Système de gestion de prix en temps réel pour un bar, avec interface style trading financier.

## 🚀 Fonctionnalités

### Interface Publique
- **Graphiques en temps réel** : Visualisation style candlestick pour chaque boisson
- **Grille responsive** : Layout 4x3 adaptatif selon la taille d'écran
- **Design financier** : Fond noir, couleurs néon, police Courier New
- **Mise à jour automatique** : Actualisation toutes les 3 secondes
- **Raccourcis clavier** : R (actualiser), P (pause/play)

### Interface Administrateur
- **Gestion des boissons** : CRUD complet (Créer, Lire, Modifier, Supprimer)
- **Enregistrement des achats** : Système de commandes avec calcul automatique
- **Algorithme de prix avancé** : Prix dynamiques basés sur la demande
- **Système de backup** : Sauvegarde automatique des données
- **Historique complet** : Suivi de toutes les transactions

## 🛠️ Technologies

- **Backend** : Python 3.12 avec serveur HTTP intégré
- **Frontend** : HTML5, CSS3, JavaScript ES6
- **Graphiques** : Chart.js pour visualisation en temps réel
- **Données** : CSV (drinks.csv, history.csv)
- **Design** : Interface responsive, thème sombre financier

## 📦 Installation

```bash
# Cloner le repository
git clone <repo-url>
cd wall-street-bar

# Installer les dépendances Python
pip install -r requirements.txt

# Lancer le serveur
python server.py
```

Le serveur démarre sur `http://localhost:5000`

## 📁 Structure du Projet

```
wall-street-bar/
├── server.py              # Serveur HTTP principal
├── models.py              # Modèles de données
├── advanced_pricing.py    # Algorithme de prix dynamiques
├── backup_manager.py      # Système de sauvegarde
├── csv_data.py           # Gestion des fichiers CSV
├── requirements.txt      # Dépendances Python
├── client/               # Interface web
│   ├── index.html       # Page principale (publique)
│   ├── admin.html       # Interface administrateur
│   ├── app.js          # Application principale
│   ├── admin.js        # Logic administrateur
│   ├── charts.js       # Gestion des graphiques
│   └── style.css       # Styles CSS
└── data/               # Données CSV
    ├── drinks.csv      # Liste des boissons
    └── history.csv     # Historique des achats
```

## 🎯 Utilisation

### Interface Publique (`/`)
- Affichage en temps réel des cours des boissons
- Graphiques individuels par boisson avec historique des prix
- Design professionnel style trading financier

### Interface Administrateur (`/admin`)
- Authentification simple (mot de passe configurable)
- Gestion complète du catalogue de boissons
- Enregistrement des ventes avec calcul automatique
- Système de backup et restauration

## 🔧 Configuration

### Algorithme de Prix
- **Prix de base** : Prix minimum garanti
- **Facteur de demande** : Multiplicateur basé sur les ventes récentes
- **Volatilité** : Variations aléatoires pour simulation réaliste
- **Limites** : Prix minimum et maximum configurables

### Backup Automatique
- Sauvegarde automatique toutes les heures
- Backup avant chaque restauration
- Conservation de l'historique complet

## 🎨 Design

L'interface utilise un thème sombre inspiré des plateformes de trading financier :
- **Couleurs** : Noir, vert néon, rouge, blanc
- **Typographie** : Courier New (style terminal)
- **Layout** : Grille responsive avec graphiques individuels
- **Animations** : Flash sur changement de prix, transitions fluides

## 📊 API Endpoints

- `GET /` - Interface publique
- `GET /admin` - Interface administrateur
- `GET /prices` - Données des prix en JSON
- `POST /admin/purchase` - Enregistrer un achat
- `POST /admin/drinks` - Ajouter une boisson
- `PUT /admin/drinks/{id}` - Modifier une boisson
- `DELETE /admin/drinks/{id}` - Supprimer une boisson

## 🤝 Contribution

1. Fork le projet
2. Créer une branche feature (`git checkout -b feature/AmazingFeature`)
3. Commit les changements (`git commit -m 'Add AmazingFeature'`)
4. Push vers la branche (`git push origin feature/AmazingFeature`)
5. Ouvrir une Pull Request

## 📄 Licence

Projet open source - voir le fichier LICENSE pour plus de détails.

---

**Wall Street Bar** - Où chaque verre a sa cotation ! 🍺📈

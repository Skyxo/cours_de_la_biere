#!/bin/bash

echo "🍺 Installation de Cours de la Bière - Simulateur de Marché Boursier"
echo "================================================================="

# Vérifier Python 3
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 n'est pas installé. Veuillez l'installer d'abord."
    exit 1
fi

echo "✅ Python 3 détecté: $(python3 --version)"

# Installer les dépendances
echo "📦 Installation des dépendances Python..."
pip3 install -r requirements.txt

if [ $? -eq 0 ]; then
    echo "✅ Dépendances installées avec succès !"
else
    echo "❌ Erreur lors de l'installation des dépendances"
    exit 1
fi

# Créer les dossiers nécessaires
echo "📁 Création des dossiers de données..."
mkdir -p data

# Vérifier si les fichiers de données existent
if [ ! -f "data/drinks.csv" ]; then
    echo "⚠️  Le fichier data/drinks.csv n'existe pas. Il sera créé au premier lancement."
fi

if [ ! -f "data/history.csv" ]; then
    echo "⚠️  Le fichier data/history.csv n'existe pas. Il sera créé au premier lancement."
fi

echo ""
echo "🎉 Installation terminée avec succès !"
echo ""
echo "🚀 Pour lancer l'application :"
echo "   python3 server.py"
echo ""
echo "🌐 Puis ouvrez votre navigateur sur :"
echo "   • Interface client : http://localhost:8000/"
echo "   • Interface admin  : http://localhost:8000/client/admin.html"
echo ""
echo "🔑 Mot de passe admin par défaut : admin123"
echo ""
echo "📚 Documentation complète dans README.md"
echo ""
echo "🍻 Santé !"

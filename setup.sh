#!/bin/bash

# 🍺 Script de déploiement Wall Street Bar
# Configuration automatique pour usage multi-écrans

echo "🍺 Configuration Wall Street Bar - Multi-Écrans"
echo "=============================================="

# Couleurs pour les messages
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Fonction pour afficher les messages colorés
print_info() {
    echo -e "${BLUE}ℹ️ $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Vérification des prérequis
print_info "Vérification des prérequis..."

if ! command -v python3 &> /dev/null; then
    print_error "Python 3 n'est pas installé"
    exit 1
fi

if ! command -v pip &> /dev/null; then
    print_error "pip n'est pas installé"
    exit 1
fi

print_success "Python et pip sont disponibles"

# Installation des dépendances
print_info "Installation des dépendances..."
if [ -f "requirements.txt" ]; then
    pip install -r requirements.txt
    print_success "Dépendances installées"
else
    print_warning "requirements.txt non trouvé, installation manuelle nécessaire"
fi

# Création du répertoire de données
if [ ! -d "data" ]; then
    mkdir -p data
    print_success "Répertoire data/ créé"
fi

# Obtenir l'adresse IP du serveur
print_info "Détection de l'adresse IP..."
IP=$(hostname -I | awk '{print $1}')
if [ -z "$IP" ]; then
    IP="localhost"
    print_warning "Impossible de détecter l'IP, utilisation de localhost"
else
    print_success "IP détectée: $IP"
fi

# Affichage des informations de connexion
echo ""
echo "🚀 Informations de connexion :"
echo "=============================="
echo ""
echo "📺 Interface Publique (Projecteur) :"
echo "   http://$IP:8000/"
echo ""
echo "📱 Interface Admin (Téléphones) :"
echo "   http://$IP:8000/admin.html"
echo "   Identifiants : admin / wallstreet2024"
echo ""
echo "🧪 Test de synchronisation :"
echo "   http://$IP:8000/test-sync.html"
echo ""

# Fonction pour démarrer le serveur
start_server() {
    print_info "Démarrage du serveur Wall Street Bar..."
    echo ""
    print_success "Serveur accessible sur :"
    echo "   📺 Public : http://$IP:8000/"
    echo "   📱 Admin  : http://$IP:8000/admin.html"
    echo ""
    print_info "Appuyez sur Ctrl+C pour arrêter le serveur"
    echo ""
    
    python server.py
}

# Fonction pour afficher le menu
show_menu() {
    echo ""
    echo "🎯 Actions disponibles :"
    echo "======================="
    echo "1. Démarrer le serveur"
    echo "2. Tester la synchronisation"
    echo "3. Afficher les informations de connexion"
    echo "4. Créer des données de test"
    echo "5. Quitter"
    echo ""
}

# Fonction pour créer des données de test
create_test_data() {
    print_info "Création de données de test..."
    
    cat > data/drinks.csv << EOF
id,name,price,base_price,min_price,max_price,alcohol_degree
1,Leffe Blonde,1.50,1.50,1.00,2.50,6.6
2,Paix Dieu,3.30,3.30,2.80,4.50,10.0
3,Kwak,2.80,2.80,2.20,3.80,8.4
4,Stella Artois,1.20,1.20,0.80,2.00,5.2
5,Orval,4.50,4.50,3.80,6.00,6.2
6,Chimay Bleue,3.90,3.90,3.20,5.50,9.0
7,Delirium Tremens,3.60,3.60,3.00,5.00,8.5
8,Rochefort 10,5.20,5.20,4.50,7.00,11.3
EOF

    touch data/history.csv
    
    print_success "Données de test créées dans data/"
}

# Fonction pour tester la synchronisation
test_sync() {
    print_info "Test de la synchronisation..."
    
    if command -v curl &> /dev/null; then
        echo "Test de l'endpoint /sync/timer :"
        curl -s "http://$IP:8000/sync/timer" | python -m json.tool 2>/dev/null || echo "Erreur: Serveur non démarré"
    else
        print_warning "curl non installé, test manuel requis"
        echo "Ouvrez http://$IP:8000/test-sync.html dans un navigateur"
    fi
}

# Menu principal
while true; do
    show_menu
    read -p "Choisissez une option (1-5): " choice
    
    case $choice in
        1)
            start_server
            ;;
        2)
            test_sync
            ;;
        3)
            echo ""
            echo "📺 Interface Publique : http://$IP:8000/"
            echo "📱 Interface Admin    : http://$IP:8000/admin.html"
            echo "🧪 Test Sync         : http://$IP:8000/test-sync.html"
            ;;
        4)
            create_test_data
            ;;
        5)
            print_success "Au revoir ! 🍺"
            exit 0
            ;;
        *)
            print_error "Option invalide. Choisissez entre 1 et 5."
            ;;
    esac
    
    echo ""
    read -p "Appuyez sur Entrée pour continuer..."
done

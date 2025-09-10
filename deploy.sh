#!/bin/bash
# Script de déploiement avec diagnostic

echo "=== Déploiement cours de la bière ==="
echo "Timestamp: $(date)"

# Vérifications avant déploiement
echo -e "\n=== Vérifications locales ==="

# Test syntax Python
echo "Test syntaxe Python..."
python3 -m py_compile server.py
if [ $? -eq 0 ]; then
    echo "✓ server.py - syntaxe OK"
else
    echo "✗ server.py - erreur syntaxe"
    exit 1
fi

python3 -m py_compile csv_data.py
if [ $? -eq 0 ]; then
    echo "✓ csv_data.py - syntaxe OK"
else
    echo "✗ csv_data.py - erreur syntaxe"
    exit 1
fi

# Test imports
echo "Test imports..."
python3 -c "from server import app; print('✓ Imports server OK')" 2>/dev/null
if [ $? -ne 0 ]; then
    echo "✗ Erreur imports server"
    exit 1
fi

# Test lecture CSV
echo "Test CSV..."
python3 -c "
from csv_data import CSVDataManager
dm = CSVDataManager()
prices = dm.get_all_prices()
print(f'✓ CSV OK - {len(prices)} boissons')
" 2>/dev/null
if [ $? -ne 0 ]; then
    echo "✗ Erreur lecture CSV"
    exit 1
fi

# Test endpoints
echo "Test endpoints..."
python3 test_production.py > test_results.txt 2>&1
if grep -q "✗" test_results.txt; then
    echo "⚠ Problèmes détectés dans les tests:"
    cat test_results.txt
else
    echo "✓ Tests locaux OK"
fi

echo -e "\n=== Fichiers à déployer ==="
echo "Fichiers modifiés récemment:"
find . -name "*.py" -o -name "*.js" -o -name "*.html" -o -name "*.css" -mtime -1 | while read file; do
    echo "  $file ($(stat -c %y "$file"))"
done

echo -e "\n=== Commandes de déploiement suggérées ==="
echo "1. git add ."
echo "2. git commit -m 'Fix: Ajout gestion erreurs robuste et endpoint diagnostic'"
echo "3. git push"
echo ""
echo "4. Sur le serveur de production:"
echo "   - curl http://localhost:8000/diagnostic"
echo "   - python diagnostic_prod.py"
echo "   - tail -f /var/log/your-app.log"

echo -e "\n=== Checklist production ==="
echo "□ Vérifier que les fichiers CSV sont présents"
echo "□ Vérifier les permissions (644 pour les CSV, 755 pour les .py)"
echo "□ Vérifier l'encoding UTF-8"
echo "□ Tester l'endpoint /diagnostic"
echo "□ Vérifier les logs d'erreur"

echo -e "\n=== Diagnostic production après déploiement ==="
echo "Quand le problème persiste, tester:"
echo "curl 'https://coursdelabiere.dev.eclair.ec-lyon.fr/diagnostic'"
echo "curl 'https://coursdelabiere.dev.eclair.ec-lyon.fr/prices'"
echo "Et comparer avec les résultats locaux."

echo -e "\n✓ Préparation terminée - prêt pour le déploiement"

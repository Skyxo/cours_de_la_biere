# Utiliser Python 3.12 slim comme image de base
FROM python:3.12-slim

# Définir le répertoire de travail dans le conteneur
WORKDIR /app

# Copier le fichier requirements.txt
COPY requirements.txt .

# Installer les dépendances Python
RUN pip install --no-cache-dir -r requirements.txt

# Copier tout le code source
COPY . .

# Créer le répertoire data s'il n'existe pas
RUN mkdir -p data

# Exposer le port 8000
EXPOSE 8000

# Définir les variables d'environnement
ENV PYTHONPATH=/app
ENV PYTHONUNBUFFERED=1

# Commande pour démarrer l'application
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]

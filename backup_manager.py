# File: backup_manager.py
"""
Système de sauvegarde et récupération pour le Wall Street Bar.
Assure la robustesse et la reprise après crash.
"""
import os
import json
import shutil
import time
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
import logging
from pathlib import Path

class BackupManager:
    def __init__(self, data_dir="data", backup_dir="backups"):
        self.data_dir = Path(data_dir)
        self.backup_dir = Path(backup_dir)
        self.backup_dir.mkdir(exist_ok=True)
        
        # Configuration de sauvegarde
        self.max_backups = 50  # Nombre maximum de sauvegardes
        self.backup_interval = 300  # Sauvegarde toutes les 5 minutes
        self.last_backup = 0
        
        # Fichiers critiques à sauvegarder
        self.critical_files = [
            "drinks.csv",
            "history.csv"
        ]
        
        # Configuration des logs
        self.setup_logging()
        
        # État du système
        self.system_state = {
            "last_backup": None,
            "backup_count": 0,
            "last_crash": None,
            "recovery_attempts": 0
        }
        
        # Charger l'état du système
        self.load_system_state()
    
    def setup_logging(self):
        """Configure le système de logs"""
        log_file = self.backup_dir / "backup.log"
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler(log_file),
                logging.StreamHandler()
            ]
        )
        self.logger = logging.getLogger(__name__)
    
    def load_system_state(self):
        """Charge l'état du système depuis le fichier de configuration"""
        state_file = self.backup_dir / "system_state.json"
        if state_file.exists():
            try:
                with open(state_file, 'r') as f:
                    self.system_state = json.load(f)
                self.logger.info("État du système chargé")
            except Exception as e:
                self.logger.error(f"Erreur lors du chargement de l'état: {e}")
                self.system_state = {
                    "last_backup": None,
                    "backup_count": 0,
                    "last_crash": None,
                    "recovery_attempts": 0
                }
    
    def save_system_state(self):
        """Sauvegarde l'état du système"""
        state_file = self.backup_dir / "system_state.json"
        try:
            with open(state_file, 'w') as f:
                json.dump(self.system_state, f, indent=2)
            self.logger.info("État du système sauvegardé")
        except Exception as e:
            self.logger.error(f"Erreur lors de la sauvegarde de l'état: {e}")
    
    def create_backup(self, backup_type="manual") -> Optional[str]:
        """Crée une sauvegarde des données critiques"""
        try:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            backup_name = f"backup_{backup_type}_{timestamp}"
            backup_path = self.backup_dir / backup_name
            backup_path.mkdir(exist_ok=True)
            
            # Copier les fichiers critiques
            for file_name in self.critical_files:
                src_file = self.data_dir / file_name
                if src_file.exists():
                    dst_file = backup_path / file_name
                    shutil.copy2(src_file, dst_file)
                    self.logger.info(f"Fichier sauvegardé: {file_name}")
                else:
                    self.logger.warning(f"Fichier manquant: {file_name}")
            
            # Créer un fichier de métadonnées
            metadata = {
                "timestamp": timestamp,
                "backup_type": backup_type,
                "files": self.critical_files,
                "system_state": self.system_state.copy()
            }
            
            metadata_file = backup_path / "metadata.json"
            with open(metadata_file, 'w') as f:
                json.dump(metadata, f, indent=2)
            
            # Mettre à jour l'état du système
            self.system_state["last_backup"] = timestamp
            self.system_state["backup_count"] += 1
            self.save_system_state()
            
            # Nettoyer les anciennes sauvegardes
            self.cleanup_old_backups()
            
            self.logger.info(f"Sauvegarde créée: {backup_name}")
            return str(backup_path)
            
        except Exception as e:
            self.logger.error(f"Erreur lors de la création de la sauvegarde: {e}")
            return None
    
    def cleanup_old_backups(self):
        """Supprime les anciennes sauvegardes pour libérer de l'espace"""
        try:
            backups = []
            for backup_dir in self.backup_dir.iterdir():
                if backup_dir.is_dir() and backup_dir.name.startswith("backup_"):
                    # Obtenir la date de création
                    mtime = backup_dir.stat().st_mtime
                    backups.append((mtime, backup_dir))
            
            # Trier par date de création (plus ancien en premier)
            backups.sort(key=lambda x: x[0])
            
            # Supprimer les sauvegardes excédentaires
            if len(backups) > self.max_backups:
                to_remove = backups[:-self.max_backups]
                for _, backup_dir in to_remove:
                    shutil.rmtree(backup_dir)
                    self.logger.info(f"Sauvegarde supprimée: {backup_dir.name}")
                    
        except Exception as e:
            self.logger.error(f"Erreur lors du nettoyage des sauvegardes: {e}")
    
    def list_backups(self) -> List[Dict]:
        """Liste toutes les sauvegardes disponibles"""
        backups = []
        try:
            for backup_dir in self.backup_dir.iterdir():
                if backup_dir.is_dir() and backup_dir.name.startswith("backup_"):
                    metadata_file = backup_dir / "metadata.json"
                    if metadata_file.exists():
                        with open(metadata_file, 'r') as f:
                            metadata = json.load(f)
                        backups.append({
                            "name": backup_dir.name,
                            "path": str(backup_dir),
                            "timestamp": metadata.get("timestamp"),
                            "backup_type": metadata.get("backup_type"),
                            "files": metadata.get("files", [])
                        })
            
            # Trier par timestamp (plus récent en premier)
            backups.sort(key=lambda x: x["timestamp"], reverse=True)
            
        except Exception as e:
            self.logger.error(f"Erreur lors de la liste des sauvegardes: {e}")
        
        return backups
    
    def restore_backup(self, backup_name: str) -> bool:
        """Restaure une sauvegarde spécifique"""
        try:
            backup_path = self.backup_dir / backup_name
            if not backup_path.exists():
                self.logger.error(f"Sauvegarde introuvable: {backup_name}")
                return False
            
            # Vérifier les métadonnées
            metadata_file = backup_path / "metadata.json"
            if not metadata_file.exists():
                self.logger.error(f"Métadonnées manquantes: {backup_name}")
                return False
            
            with open(metadata_file, 'r') as f:
                metadata = json.load(f)
            
            # Valider les fichiers
            for file_name in self.critical_files:
                backup_file = backup_path / file_name
                if not backup_file.exists():
                    self.logger.error(f"Fichier manquant dans la sauvegarde: {file_name}")
                    return False
            
            # Créer une sauvegarde de sécurité avant restauration
            safety_backup = self.create_backup("pre_restore")
            if not safety_backup:
                self.logger.error("Impossible de créer une sauvegarde de sécurité")
                return False
            
            # Restaurer les fichiers
            for file_name in self.critical_files:
                src_file = backup_path / file_name
                dst_file = self.data_dir / file_name
                shutil.copy2(src_file, dst_file)
                self.logger.info(f"Fichier restauré: {file_name}")
            
            # Mettre à jour l'état du système
            self.system_state["recovery_attempts"] += 1
            self.save_system_state()
            
            self.logger.info(f"Sauvegarde restaurée: {backup_name}")
            return True
            
        except Exception as e:
            self.logger.error(f"Erreur lors de la restauration: {e}")
            return False
    
    def restore_latest_backup(self) -> bool:
        """Restaure la sauvegarde la plus récente"""
        backups = self.list_backups()
        if not backups:
            self.logger.error("Aucune sauvegarde disponible")
            return False
        
        latest_backup = backups[0]
        return self.restore_backup(latest_backup["name"])
    
    def validate_data_integrity(self) -> Tuple[bool, List[str]]:
        """Valide l'intégrité des données actuelles"""
        issues = []
        
        try:
            # Vérifier l'existence des fichiers critiques
            for file_name in self.critical_files:
                file_path = self.data_dir / file_name
                if not file_path.exists():
                    issues.append(f"Fichier manquant: {file_name}")
                    continue
                
                # Vérifier que le fichier n'est pas vide
                if file_path.stat().st_size == 0:
                    issues.append(f"Fichier vide: {file_name}")
                    continue
                
                # Vérifier le format CSV
                if file_name.endswith('.csv'):
                    try:
                        import csv
                        with open(file_path, 'r') as f:
                            reader = csv.reader(f)
                            rows = list(reader)
                            if len(rows) < 2:  # Au moins header + 1 ligne de données
                                issues.append(f"Fichier CSV invalide (pas assez de données): {file_name}")
                    except Exception as e:
                        issues.append(f"Erreur de lecture CSV {file_name}: {e}")
            
            # Vérifier la cohérence des données
            if not issues:
                issues.extend(self._validate_data_consistency())
            
            is_valid = len(issues) == 0
            if is_valid:
                self.logger.info("Validation des données réussie")
            else:
                self.logger.warning(f"Problèmes de validation détectés: {issues}")
            
            return is_valid, issues
            
        except Exception as e:
            self.logger.error(f"Erreur lors de la validation: {e}")
            return False, [f"Erreur de validation: {e}"]
    
    def _validate_data_consistency(self) -> List[str]:
        """Valide la cohérence des données entre les fichiers"""
        issues = []
        
        try:
            # Vérifier que les IDs des boissons sont cohérents
            drinks_file = self.data_dir / "drinks.csv"
            history_file = self.data_dir / "history.csv"
            
            if drinks_file.exists() and history_file.exists():
                import csv
                
                # Lire les IDs des boissons
                with open(drinks_file, 'r') as f:
                    drinks_reader = csv.DictReader(f)
                    drink_ids = {int(row['id']) for row in drinks_reader}
                
                # Vérifier que les IDs dans l'historique existent
                with open(history_file, 'r') as f:
                    history_reader = csv.DictReader(f)
                    for row in history_reader:
                        try:
                            drink_id = int(row['drink_id'])
                            if drink_id not in drink_ids:
                                issues.append(f"ID de boisson invalide dans l'historique: {drink_id}")
                        except ValueError:
                            issues.append(f"ID de boisson non numérique dans l'historique: {row['drink_id']}")
            
        except Exception as e:
            issues.append(f"Erreur de validation de cohérence: {e}")
        
        return issues
    
    def auto_backup_if_needed(self):
        """Effectue une sauvegarde automatique si nécessaire"""
        current_time = time.time()
        if current_time - self.last_backup > self.backup_interval:
            self.create_backup("auto")
            self.last_backup = current_time
    
    def emergency_recovery(self) -> bool:
        """Tente une récupération d'urgence en cas de crash"""
        self.logger.info("Tentative de récupération d'urgence")
        
        # Marquer le crash
        self.system_state["last_crash"] = datetime.now().isoformat()
        self.save_system_state()
        
        # Valider les données actuelles
        is_valid, issues = self.validate_data_integrity()
        
        if is_valid:
            self.logger.info("Données actuelles valides, pas de récupération nécessaire")
            return True
        
        # Tenter de restaurer la dernière sauvegarde
        if self.restore_latest_backup():
            # Valider après restauration
            is_valid, issues = self.validate_data_integrity()
            if is_valid:
                self.logger.info("Récupération d'urgence réussie")
                return True
            else:
                self.logger.error(f"Récupération échouée, problèmes persistants: {issues}")
                return False
        else:
            self.logger.error("Impossible de restaurer la dernière sauvegarde")
            return False
    
    def get_backup_status(self) -> Dict:
        """Retourne le statut des sauvegardes"""
        backups = self.list_backups()
        return {
            "total_backups": len(backups),
            "last_backup": self.system_state.get("last_backup"),
            "backup_count": self.system_state.get("backup_count", 0),
            "last_crash": self.system_state.get("last_crash"),
            "recovery_attempts": self.system_state.get("recovery_attempts", 0),
            "data_integrity": self.validate_data_integrity()[0],
            "recent_backups": backups[:5]  # 5 dernières sauvegardes
        }
    
    def export_backup(self, backup_name: str, export_path: str) -> bool:
        """Exporte une sauvegarde vers un fichier ZIP"""
        try:
            import zipfile
            
            backup_path = self.backup_dir / backup_name
            if not backup_path.exists():
                return False
            
            with zipfile.ZipFile(export_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
                for file_path in backup_path.rglob('*'):
                    if file_path.is_file():
                        arcname = file_path.relative_to(backup_path)
                        zipf.write(file_path, arcname)
            
            self.logger.info(f"Sauvegarde exportée: {export_path}")
            return True
            
        except Exception as e:
            self.logger.error(f"Erreur lors de l'export: {e}")
            return False
    
    def import_backup(self, zip_path: str) -> bool:
        """Importe une sauvegarde depuis un fichier ZIP"""
        try:
            import zipfile
            
            # Créer un nouveau dossier de sauvegarde
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            backup_name = f"backup_imported_{timestamp}"
            backup_path = self.backup_dir / backup_name
            backup_path.mkdir(exist_ok=True)
            
            with zipfile.ZipFile(zip_path, 'r') as zipf:
                zipf.extractall(backup_path)
            
            # Valider la sauvegarde importée
            metadata_file = backup_path / "metadata.json"
            if metadata_file.exists():
                self.logger.info(f"Sauvegarde importée: {backup_name}")
                return True
            else:
                self.logger.error("Sauvegarde importée invalide (métadonnées manquantes)")
                shutil.rmtree(backup_path)
                return False
                
        except Exception as e:
            self.logger.error(f"Erreur lors de l'import: {e}")
            return False



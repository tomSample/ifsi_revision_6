# 📚 IFSI Lannion 2025 - Interface d'Upload de Cours

Interface web moderne pour extraire et gérer les cours IFSI au format ODT.

## ✨ Fonctionnalités

### 🔄 **Upload et Extraction**
- Interface drag & drop intuitive pour fichiers .odt
- Extraction automatique des métadonnées (UE, titre, auteur, date)
- Parsing intelligent des définitions et termes
- Aperçu en temps réel du contenu extrait

### 📊 **Statistiques Dynamiques**
- Mise à jour automatique toutes les 30 secondes
- Rafraîchissement manuel avec bouton dédié
- Animations fluides des compteurs
- Taux de réussite coloré selon performance
- Horodatage de dernière mise à jour

### 🛡️ **Prévention des Doublons**
- Détection automatique des cours existants
- Dialog de résolution avec comparaison détaillée
- Option de mise à jour ou d'annulation
- Critères multiples : clé, titre, nom de fichier

### 🎨 **Interface Moderne**
- Design responsive et accessible
- Animations et transitions fluides
- Feedback visuel en temps réel
- Support complet mobile et desktop

## 🚀 Installation et Utilisation

### 🌐 **Utilisation en ligne (GitHub Pages)**
- **Consultation des cours** : https://tomsample.github.io/ifsi_revision_6/
- **Navigation** : https://tomsample.github.io/ifsi_revision_6/navigation.html
- ✅ Fonctionne directement sans installation
- ✅ Statistiques et recherche en temps réel
- ❌ Upload de nouveaux cours non disponible

### 💻 **Utilisation locale (Fonctionnalités complètes)**

#### Prérequis
```bash
pip install -r requirements.txt
```

#### Lancement
```bash
python app.py
```
ou
```bash
start.bat
```

#### Accès
- Interface complète : http://localhost:5000
- Upload + consultation : toutes fonctionnalités disponibles

## 📁 Structure du Projet

```
révision 6/
├── app.py                 # Serveur Flask principal
├── index.html            # Interface utilisateur
├── script.js             # Logique frontend
├── style.css             # Styles et animations
├── requirements.txt      # Dépendances Python
├── start.bat            # Script de lancement Windows
├── ifsi_courses_2025-09-23.json  # Base de données JSON
├── README.md            # Documentation
└── .gitignore          # Fichiers à ignorer
```

## 🔧 API Endpoints

- `GET /api/stats` - Statistiques actuelles
- `POST /api/extract_odt` - Extraction fichier ODT
- `POST /api/add_course` - Ajout nouveau cours
- `POST /api/update_course` - Mise à jour cours existant

## 📈 Données Actuelles

- **6 UE différentes** : 2.2.S1, 2.4.S1, 3.1.S1, 3.10.S1, 4.1.S1, 4.4.S1
- **15 cours** au total
- **Plus de 200 termes** et définitions

## 🛠️ Technologies

- **Backend** : Flask 2.3.3, odfpy, Python 3.11
- **Frontend** : HTML5, CSS3, JavaScript ES6+
- **Fonctionnalités** : Drag & Drop API, Fetch API, CSS Grid/Flexbox
- **Données** : JSON structuré avec gestion d'erreurs robuste

## 📝 Format des Données

Chaque cours suit cette structure :
```json
{
  "metadata": {
    "ue": "2.2.S1",
    "title": "Titre du cours",
    "author": "Auteur",
    "date": "JJ/MM/AAAA"
  },
  "definitions": [
    {
      "term": "Terme",
      "definition": "Définition complète"
    }
  ]
}
```

## 📋 Format des Fichiers ODT

Les fichiers .odt doivent respecter cette structure :

```
UE 2.2.S1
titre : Titre du cours
auteur : nom_auteur
DD/MM/YYYY
========
1. Terme 1 : Définition du premier terme
2. Terme 2 : Définition du second terme
...
```

### Règles importantes :
- **Métadonnées** avant les séparateurs `========`
- **UE** : format "UE X.X.SX" 
- **Titre** : après "titre :" ou directement sur une ligne
- **Auteur** : après "auteur :" 
- **Date** : format JJ/MM/AAAA
- **Séparateur** : Au moins 4 signes `=`
- **Définitions** : Format "N. Terme : Définition"

---
*Projet développé pour IFSI Lannion 2025*
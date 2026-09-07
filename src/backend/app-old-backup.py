from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from werkzeug.utils import secure_filename
import json
import os
import re
from datetime import datetime
import zipfile
import xml.etree.ElementTree as ET

# Essayer d'importer odfpy pour une meilleure extraction
try:
    from odf.opendocument import load
    from odf.text import P
    from odf.element import Text
    HAS_ODFPY = True
except ImportError:
    HAS_ODFPY = False

app = Flask(__name__, static_folder='../../public', static_url_path='')
CORS(app)  # Permettre les requêtes cross-origin

# Configuration - Chemins mis à jour pour nouvelle structure
# Chemin absolu pour éviter les problèmes de chemin relatif
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
JSON_FILE_PATH = os.path.join(SCRIPT_DIR, '../data/courses.json')

def read_json_file():
    """Lit le fichier JSON existant"""
    try:
        with open(JSON_FILE_PATH, 'r', encoding='utf-8') as f:
            content = f.read().strip()
            if not content:
                # Fichier vide, créer la structure par défaut
                default_data = {
                    "exportDate": datetime.now().isoformat(),
                    "courses": [],
                    "stats": {
                        "totalTerms": 0,
                        "studiedTerms": 0,
                        "correctAnswers": 0,
                        "wrongAnswers": 0
                    }
                }
                write_json_file(default_data)
                return default_data
            return json.loads(content)
    except (FileNotFoundError, json.JSONDecodeError) as e:
        print(f"Erreur lors de la lecture du JSON: {e}")
        # Créer un fichier JSON par défaut si il n'existe pas ou est corrompu
        default_data = {
            "exportDate": datetime.now().isoformat(),
            "courses": [],
            "stats": {
                "totalTerms": 0,
                "studiedTerms": 0,
                "correctAnswers": 0,
                "wrongAnswers": 0
            }
        }
        write_json_file(default_data)
        return default_data

def write_json_file(data):
    """Écrit les données dans le fichier JSON"""
    with open(JSON_FILE_PATH, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def is_identical_course(existing_data, new_data):
    """Vérifie si un cours extrait correspond exactement à un cours existant."""
    course_fields = ('title', 'date', 'ue', 'author', 'definitions')
    return all(
        existing_data.get(field, '') == (
            new_data.get('definitions', [])
            if field == 'definitions'
            else new_data.get('metadata', {}).get(field, '')
        )
        for field in course_fields
    )

def extract_text_from_odt(file_path):
    """Extrait le texte d'un fichier ODT en préservant la structure"""
    
    # Essayer d'abord avec odfpy si disponible
    if HAS_ODFPY:
        try:
            return extract_text_with_odfpy(file_path)
        except Exception as e:
            print(f"Erreur avec odfpy: {e}, essai avec zipfile...")
    
    # Fallback avec zipfile
    try:
        with zipfile.ZipFile(file_path, 'r') as zip_file:
            # Lire le contenu XML
            content_xml = zip_file.read('content.xml')
            
            # Parser le XML
            root = ET.fromstring(content_xml)
            
            # Définir les namespaces ODT
            namespaces = {
                'text': 'urn:oasis:names:tc:opendocument:xmlns:text:1.0',
                'office': 'urn:oasis:names:tc:opendocument:xmlns:office:1.0'
            }
            
            # Extraire le texte paragraph par paragraph pour préserver la structure
            text_lines = []
            
            # Chercher tous les paragraphes
            for para in root.iter():
                if para.tag.endswith('}p') or para.tag == 'text:p':
                    # Extraire tout le texte du paragraphe
                    para_text = ""
                    for elem in para.iter():
                        if elem.text:
                            para_text += elem.text
                        if elem.tail:
                            para_text += elem.tail
                    
                    para_text = para_text.strip()
                    if para_text:
                        text_lines.append(para_text)
            
            # Si pas de paragraphes trouvés, essayer une extraction plus générale
            if not text_lines:
                for elem in root.iter():
                    if elem.text and elem.text.strip():
                        text_lines.append(elem.text.strip())
                    if elem.tail and elem.tail.strip():
                        text_lines.append(elem.tail.strip())
            
            return '\n'.join(text_lines)
            
    except Exception as e:
        print(f"Erreur lors de l'extraction du fichier ODT: {e}")
        return None

def extract_text_with_odfpy(file_path):
    """Extrait le texte avec la librairie odfpy"""
    try:
        # Charger le document ODT
        doc = load(file_path)
        
        # Extraire tous les paragraphes
        paragraphs = doc.getElementsByType(P)
        
        text_lines = []
        for para in paragraphs:
            # Extraire le texte du paragraphe
            para_text = ""
            for node in para.childNodes:
                if hasattr(node, 'data'):
                    para_text += node.data
                elif hasattr(node, 'childNodes'):
                    for child in node.childNodes:
                        if hasattr(child, 'data'):
                            para_text += child.data
            
            para_text = para_text.strip()
            if para_text:
                text_lines.append(para_text)
        
        return '\n'.join(text_lines)
        
    except Exception as e:
        print(f"Erreur avec odfpy: {e}")
        raise

def parse_course_content(content):
    """Parse le contenu du cours selon le format spécifié"""
    try:
        print(f"Contenu à parser:\n{content[:500]}...")  # Debug
        
        lines = content.split('\n')
        lines = [line.strip() for line in lines if line.strip()]
        
        print(f"Nombre de lignes: {len(lines)}")  # Debug
        
        # Trouver le séparateur
        separator_index = -1
        for i, line in enumerate(lines):
            if '====' in line or '----' in line or line.count('=') >= 4:
                separator_index = i
                print(f"Séparateur trouvé à la ligne {i}: {line}")  # Debug
                break
        
        # Si pas de séparateur trouvé, chercher des patterns alternatifs
        if separator_index == -1:
            # Chercher une ligne vide après les métadonnées
            for i, line in enumerate(lines):
                if i > 3 and not line.strip():  # Ligne vide après quelques lignes
                    separator_index = i
                    print(f"Séparateur alternatif trouvé à la ligne {i}")  # Debug
                    break
        
        # Si toujours pas trouvé, essayer de détecter le début des définitions
        if separator_index == -1:
            for i, line in enumerate(lines):
                if re.match(r'^\s*\d+\.', line):  # Ligne commençant par un numéro
                    separator_index = i
                    print(f"Début des définitions détecté à la ligne {i}: {line}")  # Debug
                    break
        
        if separator_index == -1:
            print("Aucun séparateur trouvé, utilisation de la structure complète")
            # Traiter tout comme des métadonnées si pas de séparateur
            metadata_lines = lines[:4] if len(lines) >= 4 else lines
            definitions_lines = lines[4:] if len(lines) > 4 else []
        else:
            metadata_lines = lines[:separator_index]
            definitions_lines = lines[separator_index + 1:]
        
        print(f"Métadonnées: {metadata_lines}")  # Debug
        print(f"Définitions: {definitions_lines[:3]}...")  # Debug
        
        # Parser les métadonnées
        metadata = {
            'ue': '',
            'title': '',
            'author': '',
            'date': ''
        }
        
        # Joindre toutes les lignes de métadonnées pour un parsing global
        all_metadata_text = ' '.join(metadata_lines)
        print(f"Texte complet des métadonnées: {all_metadata_text}")  # Debug
        
        # Extraire l'UE
        ue_match = re.search(r'UE\s+([\d\.S]+)', all_metadata_text, re.IGNORECASE)
        if ue_match:
            metadata['ue'] = ue_match.group(1)
            print(f"UE trouvé: {metadata['ue']}")  # Debug
        
        # Extraire l'auteur (chercher "auteur : " suivi du nom)
        author_match = re.search(r'auteur\s*:\s*([^\s]+)', all_metadata_text, re.IGNORECASE)
        if author_match:
            metadata['author'] = author_match.group(1).strip()
            print(f"Auteur trouvé: {metadata['author']}")  # Debug
        
        # Extraire la date (format JJ/MM/AAAA)
        date_match = re.search(r'\b(\d{1,2}/\d{1,2}/\d{4})\b', all_metadata_text)
        if date_match:
            metadata['date'] = date_match.group(1)
            print(f"Date trouvée: {metadata['date']}")  # Debug
        
        # Extraire le titre de façon plus intelligente
        # D'abord chercher "titre : ..." explicitement
        title_match = re.search(r'titre\s*:\s*([^:]+?)(?=\s*auteur|$)', all_metadata_text, re.IGNORECASE)
        if title_match:
            metadata['title'] = title_match.group(1).strip()
            print(f"Titre explicite trouvé: {metadata['title']}")  # Debug
        else:
            # Si pas de "titre :", essayer d'extraire le titre depuis une ligne qui contient "auteur"
            # Cas comme "Hématologieauteur : capsule"
            title_from_line = re.search(r'([A-Za-zÀ-ÿ\s\+\-\&]+?)auteur\s*:', all_metadata_text, re.IGNORECASE)
            if title_from_line:
                potential_title = title_from_line.group(1).strip()
                # Nettoyer le titre (enlever UE du début si présent)
                potential_title = re.sub(r'^UE\s+[\d\.S]+\s*-?\s*', '', potential_title, flags=re.IGNORECASE)
                if potential_title:
                    metadata['title'] = potential_title
                    print(f"Titre extrait de la ligne avec auteur: {metadata['title']}")  # Debug
        
        # Si toujours pas de titre, essayer ligne par ligne
        if not metadata['title']:
            for line in metadata_lines:
                # Chercher une ligne qui ressemble à un titre (après UE, avant auteur/date)
                if not re.search(r'UE\s+[\d\.S]+', line, re.IGNORECASE) and \
                   not re.search(r'auteur\s*:', line, re.IGNORECASE) and \
                   not re.search(r'\d{1,2}/\d{1,2}/\d{4}', line) and \
                   line.strip():
                    metadata['title'] = line.strip()
                    print(f"Titre trouvé ligne par ligne: {metadata['title']}")  # Debug
                    break
        
        # Si pas de titre trouvé dans les métadonnées, essayer de l'extraire du nom de fichier ou première ligne
        if not metadata['title'] and metadata_lines:
            # Essayer la première ligne après UE
            for line in metadata_lines:
                if not re.search(r'UE\s+[\d\.S]+', line, re.IGNORECASE) and line and not metadata['title']:
                    # Nettoyer la ligne des autres éléments
                    clean_line = line.strip()
                    clean_line = re.sub(r'auteur\s*:.*$', '', clean_line, flags=re.IGNORECASE)
                    clean_line = re.sub(r'\d{1,2}/\d{1,2}/\d{4}', '', clean_line)
                    clean_line = clean_line.strip()
                    if clean_line:
                        metadata['title'] = clean_line
                        print(f"Titre extrait et nettoyé: {metadata['title']}")  # Debug
                        break
        
        # Parser les définitions
        definitions = []
        current_definition = None
        
        print(f"Parsing des définitions à partir de {len(definitions_lines)} lignes")
        
        # Si on a une seule longue ligne, essayer de la diviser par les puces ou patterns
        if len(definitions_lines) == 1 and len(definitions_lines[0]) > 100:
            long_text = definitions_lines[0]
            print(f"Texte long détecté ({len(long_text)} caractères), division par patterns...")
            
            # Essayer de diviser par des patterns typiques
            # Chercher les termes suivis de ':'
            
            # Pattern pour capturer "Terme : définition" suivi d'un autre terme ou fin de ligne
            pattern = r'([A-ZÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖ][^:]+?)\s*:\s*([^A-ZÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖ]*?)(?=\s+[A-ZÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖ][^:]+?\s*:|$)'
            
            matches = re.findall(pattern, long_text)
            print(f"Trouvé {len(matches)} patterns de définitions")
            
            for i, (term, definition) in enumerate(matches):
                term = term.strip()
                definition = definition.strip()
                
                if term and definition:
                    definitions.append({
                        'term': term,
                        'definition': definition
                    })
                    print(f"Définition {i+1}: {term}")
            
            # Si pas de matches, essayer une approche plus simple avec les ':'
            if not definitions:
                print("Tentative de division simple par ':'")
                parts = long_text.split(':')
                
                for i in range(0, len(parts)-1, 2):
                    if i+1 < len(parts):
                        term = parts[i].strip()
                        definition = parts[i+1].strip()
                        
                        # Nettoyer le terme (enlever le texte de la définition précédente)
                        term_words = term.split()
                        if len(term_words) > 10:  # Si trop long, prendre les derniers mots
                            term = ' '.join(term_words[-5:])  # Prendre les 5 derniers mots
                        
                        if term and definition:
                            definitions.append({
                                'term': term,
                                'definition': definition
                            })
                            print(f"Définition simple {len(definitions)}: {term}")
        
        else:
            # Traitement ligne par ligne original - Chaque ligne est déjà une définition !
            for i, line in enumerate(definitions_lines):
                if not line.strip():
                    continue
                
                print(f"Ligne {i}: {line}")  # Debug
                
                # Si la ligne contient ':', c'est probablement une définition
                if ':' in line:
                    parts = line.split(':', 1)
                    if len(parts) == 2:
                        term = parts[0].strip()
                        definition = parts[1].strip()
                        
                        if term and definition:
                            definitions.append({
                                'term': term,
                                'definition': definition
                            })
                            print(f"Définition trouvée: {term}")
                        
                # Chercher les numéros en début de ligne (1., 2., etc.) - pour le format alternatif
                number_match = re.match(r'^\s*(\d+)\.\s*(.+)', line)
                if number_match:
                    # Si on a une définition en cours, l'ajouter
                    if current_definition and current_definition.get('term'):
                        definitions.append(current_definition)
                        print(f"Ajout définition: {current_definition['term']}")
                    
                    # Commencer une nouvelle définition
                    rest_of_line = number_match.group(2).strip()
                    print(f"Nouvelle définition détectée: {rest_of_line}")
                    
                    if ':' in rest_of_line:
                        term, definition = rest_of_line.split(':', 1)
                        current_definition = {
                            'term': term.strip(),
                            'definition': definition.strip()
                        }
                    else:
                        current_definition = {
                            'term': rest_of_line.strip(),
                            'definition': ""
                        }
                    
                elif current_definition and line:
                    # Continuer la définition courante
                    if ':' in line and not current_definition['definition']:
                        # Le ':' est sur cette ligne
                        if current_definition['term'] in line:
                            # Le terme continue sur cette ligne
                            parts = line.split(':', 1)
                            if len(parts) == 2:
                                current_definition['definition'] = parts[1].strip()
                        else:
                            # C'est une nouvelle partie de la définition
                            if current_definition['definition']:
                                current_definition['definition'] += ' ' + line.strip()
                            else:
                                current_definition['definition'] = line.strip()
                    else:
                        # Ajouter à la définition existante
                        if current_definition['definition']:
                            current_definition['definition'] += ' ' + line.strip()
                        else:
                            current_definition['definition'] = line.strip()
            
            # Ajouter la dernière définition
            if current_definition and current_definition.get('term'):
                definitions.append(current_definition)
                print(f"Ajout dernière définition: {current_definition['term']}")
        
        # Si aucune définition trouvée avec les méthodes précédentes, essayer une approche globale
        if not definitions:
            print("Aucune définition trouvée, essai d'une approche alternative sur tout le texte...")
            
            # Rejoindre tout le texte des définitions
            all_text = ' '.join(definitions_lines)
            
            # Chercher des patterns avec des mots en majuscules suivis de ':'
            pattern = r'([A-ZÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖ][a-zàáâãäåæçèéêëìíîïðñòóôõö\s\(\)]+?)\s*:\s*([^A-ZÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖ]*?)(?=\s+[A-ZÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖ][a-zàáâãäåæçèéêëìíîïðñòóôõö\s\(\)]+?\s*:|$)'
            
            matches = re.findall(pattern, all_text, re.MULTILINE | re.DOTALL)
            
            for term, definition in matches:
                term = term.strip()
                definition = definition.strip()
                
                if term and definition and len(term) < 100:  # Éviter les termes trop longs
                    definitions.append({
                        'term': term,
                        'definition': definition
                    })
                    print(f"Définition alternative trouvée: {term}")
        
        print(f"Métadonnées finales: {metadata}")  # Debug
        print(f"Nombre de définitions trouvées: {len(definitions)}")  # Debug
        for i, d in enumerate(definitions):
            print(f"Définition {i+1}: {d['term'][:50]}...")
        
        return {
            'metadata': metadata,
            'definitions': definitions
        }
        
    except Exception as e:
        print(f"Erreur lors du parsing: {e}")
        import traceback
        traceback.print_exc()
        return None

def generate_course_key(metadata):
    """Génère une clé unique pour le cours"""
    ue = metadata.get('ue', '').replace('.', '_').replace(' ', '_').lower()
    title = metadata.get('title', '').lower()
    title = re.sub(r'[^a-z0-9\s]', '', title)
    title = '_'.join(title.split())
    
    return f"ue_{ue}_{title}"

@app.route('/')
def index():
    """Redirige vers la page d'accueil frontend"""
    return send_from_directory('../../', 'index.html')

@app.route('/service-worker.js')
def serve_service_worker():
    """Sert le Service Worker depuis la racine avec headers appropriés"""
    response = send_from_directory('../../', 'service-worker.js')
    response.headers['Service-Worker-Allowed'] = '/'
    response.headers['Content-Type'] = 'application/javascript'
    response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
    return response

@app.route('/src/frontend/pages/<path:filename>')
def serve_pages(filename):
    """Sert les pages HTML depuis src/frontend/pages/"""
    return send_from_directory('../frontend/pages', filename)

@app.route('/src/frontend/assets/<path:subpath>/<path:filename>')
def serve_assets(subpath, filename):
    """Sert les assets (CSS, JS) depuis src/frontend/assets/"""
    return send_from_directory(f'../frontend/assets/{subpath}', filename)

@app.route('/src/data/<path:filename>')
def serve_data(filename):
    """Sert les fichiers de données depuis src/data/"""
    return send_from_directory('../data', filename)

@app.route('/public/<path:subpath>/<path:filename>')
def serve_public(subpath, filename):
    """Sert les fichiers optimisés depuis public/"""
    return send_from_directory(f'../../public/{subpath}', filename)

@app.route('/public/<path:filename>')
def serve_public_root(filename):
    """Sert les fichiers à la racine de public/ (manifest.json, service-worker.js, etc.)"""
    response = send_from_directory('../../public', filename)
    # Permettre au Service Worker de contrôler le scope racine
    if filename == 'service-worker.js':
        response.headers['Service-Worker-Allowed'] = '/'
        response.headers['Content-Type'] = 'application/javascript'
    return response

@app.route('/api/stats')
def get_stats():
    """Retourne les statistiques actuelles"""
    try:
        data = read_json_file()
        total_courses = len(data['courses'])
        total_terms = sum(len(course[1]['definitions']) for course in data['courses'])
        
        stats = {
            'totalCourses': total_courses,
            'totalTerms': total_terms,
            'studiedTerms': data['stats'].get('studiedTerms', 0),
            'correctAnswers': data['stats'].get('correctAnswers', 0)
        }
        
        return jsonify(stats)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/test')
def test_endpoint():
    """Endpoint de test pour vérifier que le serveur fonctionne"""
    return jsonify({
        'status': 'ok',
        'message': 'Serveur fonctionnel',
        'has_odfpy': HAS_ODFPY
    })

@app.route('/api/extract_odt', methods=['POST'])
def extract_odt():
    """Extrait les données d'un fichier ODT uploadé"""
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'Aucun fichier fourni'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'Aucun fichier sélectionné'}), 400
        
        if not file.filename.lower().endswith('.odt'):
            return jsonify({'error': 'Seuls les fichiers .odt sont acceptés'}), 400
        
        # Sauvegarder temporairement le fichier
        temp_path = f"temp_{file.filename}"
        file.save(temp_path)
        
        try:
            # Extraire le texte
            content = extract_text_from_odt(temp_path)
            if not content:
                return jsonify({'error': 'Impossible d\'extraire le contenu du fichier'}), 400
            
            print(f"Contenu extrait du fichier {file.filename}:")
            print("=" * 50)
            print(content)
            print("=" * 50)
            
            # Parser le contenu
            parsed_data = parse_course_content(content)
            if not parsed_data:
                return jsonify({
                    'error': 'Impossible de parser le contenu du fichier',
                    'raw_content': content[:1000]  # Retourner les premiers 1000 caractères pour debug
                }), 400
            
            return jsonify(parsed_data)
            
        finally:
            # Supprimer le fichier temporaire
            if os.path.exists(temp_path):
                os.remove(temp_path)
                
    except Exception as e:
        print(f"Erreur dans extract_odt: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

def get_course_duplicate_status(data):
    """Détermine si un cours existe déjà sans modifier la base de données."""
    if not data or 'metadata' not in data or 'definitions' not in data:
        return None, {'error': 'Données invalides'}, 400

    json_data = read_json_file()
    course_key = generate_course_key(data['metadata'])
    course_title = data['metadata'].get('title', '').strip()
    course_filename = f"{course_title}.odt"

    for course in json_data['courses']:
        existing_key = course[0]
        existing_data = course[1]
        existing_title = existing_data.get('title', '').strip()
        existing_filename = existing_data.get('filename', '').strip()

        existing_course = {
            'title': existing_data.get('title'),
            'date': existing_data.get('date'),
            'author': existing_data.get('author'),
            'ue': existing_data.get('ue'),
            'definitions_count': len(existing_data.get('definitions', []))
        }

        if is_identical_course(existing_data, data):
            return 'duplicate_no_change', {
                'status': 'duplicate_no_change',
                'message': 'Ce fichier de cours est déjà présent',
                'existing_course': existing_course
            }, 200

        if (existing_key == course_key or existing_title == course_title or
                existing_filename == course_filename):
            return 'confirm_update', {
                'status': 'confirm_update',
                'message': 'Cours déjà existant',
                'existing_course': existing_course,
                'new_course': {
                    'title': course_title,
                    'date': data['metadata'].get('date'),
                    'author': data['metadata'].get('author'),
                    'ue': data['metadata'].get('ue'),
                    'definitions_count': len(data['definitions'])
                }
            }, 200

    return 'new', {'status': 'new'}, 200

@app.route('/api/check_course', methods=['POST'])
def check_course():
    """Vérifie l'existence d'un cours sans l'ajouter."""
    try:
        _, response, status_code = get_course_duplicate_status(request.get_json())
        return jsonify(response), status_code
    except Exception as e:
        print(f"Erreur dans check_course: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/api/add_course', methods=['POST'])
def add_course():
    """Ajoute un nouveau cours au fichier JSON"""
    try:
        data = request.get_json()
        
        if not data or 'metadata' not in data or 'definitions' not in data:
            return jsonify({'error': 'Données invalides'}), 400
        
        # Lire le fichier JSON existant
        json_data = read_json_file()
        
        # Générer la clé du cours
        course_key = generate_course_key(data['metadata'])
        
        # Vérifier si le cours existe déjà (par clé, titre ou nom de fichier)
        existing_course_index = None
        course_title = data['metadata'].get('title', '').strip()
        course_filename = f"{course_title}.odt"
        
        for i, course in enumerate(json_data['courses']):
            existing_key = course[0]
            existing_data = course[1]
            existing_title = existing_data.get('title', '').strip()
            existing_filename = existing_data.get('filename', '').strip()
            
            if is_identical_course(existing_data, data):
                return jsonify({
                    'error': 'Ce fichier de cours est déjà présent',
                    'action_required': 'duplicate_no_change',
                    'existing_course': {
                        'title': existing_data.get('title'),
                        'date': existing_data.get('date'),
                        'author': existing_data.get('author'),
                        'ue': existing_data.get('ue'),
                        'definitions_count': len(existing_data.get('definitions', []))
                    }
                }), 409

            # Vérifier plusieurs critères de doublon
            if (existing_key == course_key or 
                existing_title == course_title or 
                existing_filename == course_filename or
                existing_filename == f"{course_title}.odt"):
                existing_course_index = i
                break
        
        if existing_course_index is not None:
            # Cours déjà existant
            existing_course = json_data['courses'][existing_course_index]
            existing_data = existing_course[1]
            
            return jsonify({
                'error': 'Cours déjà existant',
                'existing_course': {
                    'title': existing_data.get('title'),
                    'date': existing_data.get('date'),
                    'author': existing_data.get('author'),
                    'ue': existing_data.get('ue'),
                    'definitions_count': len(existing_data.get('definitions', []))
                },
                'new_course': {
                    'title': course_title,
                    'date': data['metadata'].get('date'),
                    'author': data['metadata'].get('author'),
                    'ue': data['metadata'].get('ue'),
                    'definitions_count': len(data['definitions'])
                },
                'action_required': 'confirm_update'
            }), 409  # Conflict status code
        
        # Créer l'entrée du cours
        course_entry = {
            'title': course_title,
            'date': data['metadata'].get('date', ''),
            'ue': data['metadata'].get('ue', ''),
            'author': data['metadata'].get('author', ''),
            'definitions': data['definitions'],
            'filename': course_filename
        }
        
        # Ajouter le nouveau cours
        json_data['courses'].append([course_key, course_entry])
        
        # Mettre à jour les statistiques
        total_terms = sum(len(course[1]['definitions']) for course in json_data['courses'])
        json_data['stats']['totalTerms'] = total_terms
        json_data['exportDate'] = datetime.now().isoformat()
        
        # Sauvegarder le fichier JSON
        write_json_file(json_data)
        
        return jsonify({
            'success': True,
            'message': 'Cours ajouté avec succès',
            'courseKey': course_key,
            'totalTerms': total_terms,
            'totalCourses': len(json_data['courses'])
        })
        
    except Exception as e:
        print(f"Erreur dans add_course: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/api/update_course', methods=['POST'])
def update_course():
    """Met à jour un cours existant"""
    try:
        data = request.get_json()
        
        # Nouveau format simplifié depuis l'interface d'édition
        if 'key' in data and 'data' in data:
            return update_course_simple(data)
        
        # Ancien format (compatibilité)
        if not data or 'metadata' not in data or 'definitions' not in data:
            return jsonify({'error': 'Données invalides'}), 400
        
        # Lire le fichier JSON existant
        json_data = read_json_file()
        
        # Générer la clé du cours
        course_key = generate_course_key(data['metadata'])
        course_title = data['metadata'].get('title', '').strip()
        
        # Trouver le cours existant
        existing_course_index = None
        for i, course in enumerate(json_data['courses']):
            existing_key = course[0]
            existing_data = course[1]
            existing_title = existing_data.get('title', '').strip()
            
            if (existing_key == course_key or existing_title == course_title):
                existing_course_index = i
                break
        
        if existing_course_index is None:
            return jsonify({'error': 'Cours non trouvé pour mise à jour'}), 404
        
        # Mettre à jour le cours
        course_entry = {
            'title': course_title,
            'date': data['metadata'].get('date', ''),
            'ue': data['metadata'].get('ue', ''),
            'author': data['metadata'].get('author', ''),
            'definitions': data['definitions'],
            'filename': f"{course_title}.odt"
        }
        
        json_data['courses'][existing_course_index] = [course_key, course_entry]
        
        # Mettre à jour les statistiques
        total_terms = sum(len(course[1]['definitions']) for course in json_data['courses'])
        json_data['stats']['totalTerms'] = total_terms
        json_data['exportDate'] = datetime.now().isoformat()
        
        # Sauvegarder le fichier JSON
        write_json_file(json_data)
        
        return jsonify({
            'success': True,
            'message': 'Cours mis à jour avec succès',
            'courseKey': course_key,
            'totalTerms': total_terms,
            'totalCourses': len(json_data['courses'])
        })
        
    except Exception as e:
        print(f"Erreur dans update_course: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

def update_course_simple(data):
    """Mise à jour simplifiée depuis l'interface d'édition"""
    try:
        course_key = data['key']
        course_data = data['data']
        
        # Lire le fichier JSON existant
        json_data = read_json_file()
        
        # Trouver le cours à mettre à jour
        course_index = None
        for i, course in enumerate(json_data['courses']):
            if course[0] == course_key:
                course_index = i
                break
        
        if course_index is None:
            return jsonify({'error': 'Cours non trouvé'}), 404
        
        # Mettre à jour les données du cours
        updated_course_data = {
            'title': course_data.get('title', ''),
            'ue': course_data.get('ue', ''),
            'author': course_data.get('author', ''),
            'definitions': course_data.get('definitions', []),
            'date': course_data.get('date', ''),
            'filename': json_data['courses'][course_index][1].get('filename', f"{course_data.get('title', '')}.odt")
        }
        
        # Remplacer les données du cours
        json_data['courses'][course_index] = [course_key, updated_course_data]
        
        # Mettre à jour les statistiques
        total_terms = sum(len(course[1].get('definitions', [])) for course in json_data['courses'])
        json_data['stats']['totalTerms'] = total_terms
        json_data['exportDate'] = datetime.now().isoformat()
        
        # Sauvegarder
        write_json_file(json_data)
        
        return jsonify({'success': True, 'message': 'Cours mis à jour avec succès'})
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Configuration pour les images
IMAGES_METADATA_FILE = 'images_metadata.json'
IMAGES_FOLDER = 'images'
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'pdf'}

def allowed_file(filename):
    """Vérifier si l'extension du fichier est autorisée"""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def load_images_metadata():
    """Charger les métadonnées des images"""
    try:
        with open(IMAGES_METADATA_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        return {
            "images": [],
            "categories": {
                "anatomie-physiologie": {
                    "name": "Anatomie & Physiologie",
                    "icon": "🫀",
                    "description": "Schémas anatomiques et mécanismes physiologiques"
                },
                "systemes": {
                    "name": "Systèmes & Processus",
                    "icon": "⚙️", 
                    "description": "Processus pathologiques et systémiques"
                },
                "normes": {
                    "name": "Normes & Protocoles",
                    "icon": "📋",
                    "description": "Valeurs de référence et protocoles de soins"
                }
            }
        }

def save_images_metadata(data):
    """Sauvegarder les métadonnées des images"""
    with open(IMAGES_METADATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

@app.route('/api/upload_image', methods=['POST'])
def upload_image():
    """Upload d'une image avec métadonnées"""
    try:
        # Vérifier qu'un fichier est présent
        if 'file' not in request.files:
            return jsonify({'error': 'Aucun fichier fourni'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'Aucun fichier sélectionné'}), 400
        
        if not allowed_file(file.filename):
            return jsonify({'error': 'Type de fichier non autorisé'}), 400
        
        # Récupérer les métadonnées
        category = request.form.get('category')
        title = request.form.get('title', '').strip()
        description = request.form.get('description', '').strip()
        
        if not category or not title:
            return jsonify({'error': 'Catégorie et titre obligatoires'}), 400
        
        # Traiter les tags (vide par défaut)
        tags = []
        
        # Créer le dossier de catégorie si nécessaire
        category_folder = os.path.join(IMAGES_FOLDER, category)
        os.makedirs(category_folder, exist_ok=True)
        
        # Sécuriser le nom de fichier et sauvegarder
        filename = secure_filename(file.filename)
        filepath = os.path.join(category_folder, filename)
        
        # Vérifier si le fichier existe déjà et renommer si nécessaire
        base_name, ext = os.path.splitext(filename)
        counter = 1
        while os.path.exists(filepath):
            filename = f"{base_name}_{counter}{ext}"
            filepath = os.path.join(category_folder, filename)
            counter += 1
        
        file.save(filepath)
        
        # Charger les métadonnées existantes
        metadata = load_images_metadata()
        
        # Créer l'entrée pour la nouvelle image
        new_image = {
            'id': f"img_{len(metadata['images']) + 1:03d}",
            'filename': filename,
            'original_name': file.filename,
            'category': category,
            'subcategory': None,
            'title': title,
            'description': description if description else None,
            'tags': tags,
            'uploaded_date': datetime.now().strftime('%Y-%m-%d'),
            'size': f"{os.path.getsize(filepath)/1024:.1f}KB",
            'type': file.content_type.split('/')[-1] if file.content_type else filename.split('.')[-1].lower()
        }
        
        # Ajouter à la liste et sauvegarder
        metadata['images'].append(new_image)
        save_images_metadata(metadata)
        
        return jsonify({
            'success': True,
            'message': f'Image "{title}" uploadée avec succès !',
            'image': new_image
        })
        
    except Exception as e:
        print(f"Erreur dans upload_image: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/api/images')
def get_images():
    """Récupérer la liste des images"""
    try:
        metadata = load_images_metadata()
        return jsonify(metadata)
    except Exception as e:
        print(f"Erreur dans get_images: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/delete_image', methods=['DELETE'])
def delete_image():
    """Supprimer une image"""
    try:
        data = request.get_json()
        image_path = data.get('imagePath')
        
        if not image_path:
            return jsonify({'error': 'Chemin d\'image manquant'}), 400
        
        # Enlever le préfixe 'images/' si présent
        if image_path.startswith('images/'):
            image_path = image_path[7:]
        
        # Construire le chemin complet
        full_path = os.path.join('images', image_path)
        
        # Vérifier que le fichier existe
        if not os.path.exists(full_path):
            return jsonify({'error': 'Image non trouvée'}), 404
        
        # Supprimer le fichier physique
        os.remove(full_path)
        
        # Mettre à jour les métadonnées
        metadata = load_images_metadata()
        
        # Trouver et supprimer l'image des métadonnées
        original_count = len(metadata['images'])
        metadata['images'] = [img for img in metadata['images'] 
                            if not (img['category'] + '/' + img['filename']) == image_path]
        
        if len(metadata['images']) == original_count:
            return jsonify({'error': 'Image non trouvée dans les métadonnées'}), 404
        
        # Sauvegarder les métadonnées mises à jour
        save_images_metadata(metadata)
        
        return jsonify({'success': True, 'message': 'Image supprimée avec succès'})
        
    except Exception as e:
        print(f"Erreur dans delete_image: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/api/delete_course', methods=['DELETE'])
def delete_course():
    """Supprimer un cours"""
    try:
        data = request.get_json()
        course_key = data.get('courseKey')
        
        if not course_key:
            return jsonify({'error': 'Clé de cours manquante'}), 400
        
        # Lire le fichier JSON
        json_data = read_json_file()
        
        # Trouver et supprimer le cours
        original_count = len(json_data['courses'])
        json_data['courses'] = [course for course in json_data['courses'] if course[0] != course_key]
        
        if len(json_data['courses']) == original_count:
            return jsonify({'error': 'Cours non trouvé'}), 404
        
        # Mettre à jour les statistiques
        json_data['stats']['totalTerms'] = sum(len(course[1]['definitions']) for course in json_data['courses'])
        
        # Sauvegarder le fichier
        write_json_file(json_data)
        
        return jsonify({'success': True, 'message': 'Cours supprimé avec succès'})
        
    except Exception as e:
        print(f"Erreur dans delete_course: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/api/update_definition', methods=['POST'])
def update_definition():
    """Mettre à jour une définition spécifique depuis un signalement"""
    try:
        data = request.get_json()
        term = data.get('term')
        ue = data.get('ue')
        new_definition = data.get('newDefinition')
        
        if not term or not new_definition:
            return jsonify({'error': 'Terme et nouvelle définition requis'}), 400
        
        # Lire le fichier JSON
        json_data = read_json_file()
        
        # Chercher le terme dans tous les cours
        found = False
        for course in json_data['courses']:
            course_key, course_data = course
            
            # Vérifier l'UE si fournie
            if ue and course_data.get('ue') != ue:
                continue
            
            # Chercher dans les définitions
            for definition in course_data.get('definitions', []):
                if definition.get('term') == term:
                    # Mettre à jour la définition
                    definition['definition'] = new_definition
                    found = True
                    print(f"✅ Définition mise à jour: {term} dans {course_data.get('title')}")
                    break
            
            if found:
                break
        
        if not found:
            return jsonify({'error': f'Terme "{term}" non trouvé'}), 404
        
        # Mettre à jour la date d'export
        json_data['exportDate'] = datetime.now().isoformat()
        
        # Sauvegarder le fichier JSON
        write_json_file(json_data)
        
        return jsonify({
            'success': True,
            'message': f'Définition de "{term}" mise à jour avec succès',
            'term': term,
            'newDefinition': new_definition
        })
        
    except Exception as e:
        print(f"Erreur dans update_definition: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/api/update_courses', methods=['POST'])
def update_courses():
    """Met à jour l'intégralité du fichier courses.json"""
    try:
        print("📥 Réception de la requête update_courses")
        data = request.get_json()
        
        if not data or 'courses' not in data:
            print("❌ Données invalides - pas de 'courses'")
            return jsonify({'error': 'Données invalides'}), 400
        
        print(f"✅ Données reçues: {len(data.get('courses', []))} cours")
        
        # Mettre à jour la date d'export
        data['exportDate'] = datetime.now().isoformat()
        
        # Recalculer les statistiques si présentes
        if 'stats' in data:
            total_terms = sum(
                len(course[1].get('definitions', [])) 
                for course in data['courses']
            )
            data['stats']['totalTerms'] = total_terms
        
        # Sauvegarder le fichier JSON
        print(f"💾 Sauvegarde dans: {os.path.abspath(JSON_FILE_PATH)}")
        write_json_file(data)
        print("✅ Fichier sauvegardé avec succès")
        
        return jsonify({
            'success': True,
            'message': 'Fichier courses.json mis à jour avec succès',
            'exportDate': data['exportDate']
        })
        
    except Exception as e:
        print(f"❌ Erreur dans update_courses: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/api/ue25/pathologies')
def get_ue25_pathologies():
    """Retourne les données des pathologies UE25"""
    try:
        ue25_file = os.path.join(SCRIPT_DIR, '../data/recap_charts/ue25_pathologies.json')
        
        if not os.path.exists(ue25_file):
            return jsonify({'error': 'Fichier de pathologies non trouvé'}), 404
        
        with open(ue25_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        return jsonify(data)
    
    except Exception as e:
        print(f"Erreur dans get_ue25_pathologies: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/term/importance', methods=['POST'])
def update_term_importance():
    """
    Met à jour l'importance d'un terme dans courses.json
    
    Body JSON:
    {
        "ue": "2.2.S1",
        "term": "Cellule",
        "importance": "indispensable" | "utile" | "optionnel" | null (pour supprimer)
    }
    """
    try:
        data = request.get_json()
        
        if not data or 'ue' not in data or 'term' not in data:
            return jsonify({'error': 'Données manquantes: ue et term requis'}), 400
        
        ue = data.get('ue')
        term = data.get('term')
        importance = data.get('importance')  # peut être null
        
        # Valider l'importance si fournie
        valid_importance = ['indispensable', 'utile', 'optionnel']
        if importance is not None and importance not in valid_importance:
            return jsonify({'error': f'Importance invalide. Doit être: {", ".join(valid_importance)} ou null'}), 400
        
        print(f"📝 Mise à jour du terme: {term} ({ue}) -> {importance}")
        
        # Charger les données actuelles
        courses_data = read_json_file()
        
        # Chercher le cours et le terme correspondant
        found = False
        for course_key, course in courses_data.get('courses', []):
            if course.get('ue') == ue:
                definitions = course.get('definitions', [])
                for definition in definitions:
                    if definition.get('term') == term:
                        # Mettre à jour ou supprimer l'importance
                        if importance is None:
                            if 'importance' in definition:
                                del definition['importance']
                                print(f"✂️ Importance supprimée de {term}")
                        else:
                            definition['importance'] = importance
                            print(f"✅ Importance mise à jour: {importance}")
                        
                        found = True
                        break
                
                if found:
                    break
        
        if not found:
            return jsonify({'error': f'Terme "{term}" non trouvé dans l\'UE "{ue}"'}), 404
        
        # Mettre à jour la date d'export
        courses_data['exportDate'] = datetime.now().isoformat()
        
        # Sauvegarder le fichier
        write_json_file(courses_data)
        
        return jsonify({
            'success': True,
            'message': f'Importance du terme "{term}" mise à jour avec succès',
            'term': term,
            'ue': ue,
            'importance': importance
        })
        
    except Exception as e:
        print(f"❌ Erreur dans update_term_importance: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/charts/list')
def list_charts():
    """Liste tous les fichiers CSV disponibles dans recap_charts et role_ide_charts"""
    try:
        charts = []
        
        # Répertoires à scanner
        data_dir = os.path.join(SCRIPT_DIR, '../data')
        recap_charts_dir = os.path.join(data_dir, 'recap_charts')
        role_ide_charts_dir = os.path.join(data_dir, 'role_ide_charts')
        
        # Scanner recap_charts
        if os.path.isdir(recap_charts_dir):
            for filename in os.listdir(recap_charts_dir):
                if filename.endswith('.csv'):
                    filepath = os.path.join(recap_charts_dir, filename)
                    charts.append({
                        'filename': filename,
                        'type': 'recap',
                        'path': f'/src/data/recap_charts/{filename}',
                        'ue': filename.replace('.csv', '')  # Nom du fichier = UE
                    })
                    print(f"✓ Fichier recap trouvé: {filename}")
        
        # Scanner role_ide_charts
        if os.path.isdir(role_ide_charts_dir):
            for filename in os.listdir(role_ide_charts_dir):
                if filename.endswith('.csv'):
                    filepath = os.path.join(role_ide_charts_dir, filename)
                    charts.append({
                        'filename': filename,
                        'type': 'role_ide',
                        'path': f'/src/data/role_ide_charts/{filename}',
                        'ue': filename.replace('.csv', '')
                    })
                    print(f"✓ Fichier role_ide trouvé: {filename}")
        
        print(f"📊 Total de fichiers trouvés: {len(charts)}")
        return jsonify({
            'success': True,
            'charts': charts,
            'count': len(charts)
        })
        
    except Exception as e:
        print(f"❌ Erreur dans list_charts: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    print("🚀 Serveur IFSI Lannion démarré sur http://localhost:5000")
    print("📁 Fichier JSON:", os.path.abspath(JSON_FILE_PATH))
    print("📂 Dossier statique:", os.path.abspath(app.static_folder))
    app.run(debug=True, host='0.0.0.0', port=5000)
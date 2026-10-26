#!/usr/bin/env python3
"""
Génération complète de la base de données Anat'PASS Poly (UE5 - Mineure Santé).
- Extrait tous les schémas anatomiques du PDF poly.pdf
- Associe chaque schéma à son Chapitre, Section, Sous-section et Légende
- Analyse par OCR Apple Vision pour extraire tous les termes anatomiques
- Fusionne intelligemment les textes multi-lignes
- Masque proprement les étiquettes et applique des badges numérotés circulaires (1, 2, 3...)
- Génère les variantes acceptées (accents, articles, abréviations médicales m./lig./a./v./n., synonymes)
- Produit data/planches.json et data/planches.js dans /Users/nicolasgandoin/Desktop/AnatPASS_Poly
"""

import fitz  # PyMuPDF
import subprocess
import os
import re
import json
import io
import unicodedata
from PIL import Image, ImageDraw, ImageFont

PDF_PATH = "/Users/nicolasgandoin/Desktop/poly.pdf"
DEST_DIR = "/Users/nicolasgandoin/Desktop/AnatPASS_Poly"
IMAGES_DIR = os.path.join(DEST_DIR, "images")
DATA_DIR = os.path.join(DEST_DIR, "data")
DATA_JSON = os.path.join(DATA_DIR, "planches.json")
DATA_JS = os.path.join(DATA_DIR, "planches.js")
SCRATCH_DIR = os.path.join(DEST_DIR, "scratch")
OCR_BIN = "/Users/nicolasgandoin/.gemini/antigravity-ide/brain/06133152-e1b4-48b1-aee0-c3e6776596bc/scratch/ocr_full_bin"

os.makedirs(IMAGES_DIR, exist_ok=True)
os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(SCRATCH_DIR, exist_ok=True)

# 10 Chapitres officiels d'après le Sommaire
CHAPTERS = [
    (1, "Membre supérieur", 7, 32),
    (2, "Membre inférieur", 33, 72),
    (3, "Le squelette axial", 73, 94),
    (4, "Appareil respiratoire", 95, 116),
    (5, "Appareil cardio-vasculaire", 117, 162),
    (6, "Appareil digestif", 163, 208),
    (7, "Appareil urinaire", 209, 218),
    (8, "Appareil reproducteur féminin", 219, 232),
    (9, "Appareil reproducteur masculin", 233, 246),
    (10, "Appareil nerveux central", 247, 288)
]

def get_chapter(p_num):
    for ch_id, ch_name, start_p, end_p in CHAPTERS:
        if start_p <= p_num <= end_p:
            return ch_id, ch_name
    return 0, "Généralités"

def clean_label(text):
    text = re.sub(r"\s+", " ", text).strip()
    return text

def generate_accepted(label):
    variants = [label]
    low = label.lower()
    variants.append(low)
    
    # Sans tiret ou numéros en tête
    low = re.sub(r"^[\d\.\-\)\*•]+\s*", "", low)
    variants.append(low)
    
    # Sans accents
    no_acc = ''.join(c for c in unicodedata.normalize('NFD', low) if unicodedata.category(c) != 'Mn')
    variants.append(no_acc)
    
    # Abréviations médicales
    expansions = [
        (r'\bm\.\s*', 'muscle '),
        (r'\blig\.\s*', 'ligament '),
        (r'\blt\.\s*', 'ligament '),
        (r'\ba\.\s*', 'artère '),
        (r'\bv\.\s*', 'veine '),
        (r'\bn\.\s*', 'nerf '),
        (r'\bproc\.\s*', 'processus ')
    ]
    for pattern, repl in expansions:
        if re.search(pattern, low):
            exp_str = re.sub(pattern, repl, low)
            variants.append(exp_str)
            exp_no_acc = ''.join(c for c in unicodedata.normalize('NFD', exp_str) if unicodedata.category(c) != 'Mn')
            variants.append(exp_no_acc)
            short_str = re.sub(pattern, '', low)
            variants.append(short_str)
            short_no_acc = ''.join(c for c in unicodedata.normalize('NFD', short_str) if unicodedata.category(c) != 'Mn')
            variants.append(short_no_acc)

    # Sans articles
    curr_variants = list(variants)
    for v in curr_variants:
        no_art = re.sub(r'^(le|la|les|l[\'’]|un|une|des|du|au|aux)\s*', '', v)
        variants.append(no_art)
        no_art_no_acc = re.sub(r'^(le|la|les|l[\'’]|un|une|des|du|au|aux)\s*', '', no_acc)
        variants.append(no_art_no_acc)

    # Extraction parenthèses ex: "ulna (cubitus)" -> "ulna", "cubitus"
    m = re.match(r'([^(]+)\(([^)]+)\)', label)
    if m:
        p1 = m.group(1).strip().lower()
        p2 = m.group(2).strip().lower()
        variants.extend([p1, p2])
        v1 = ''.join(c for c in unicodedata.normalize('NFD', p1) if unicodedata.category(c) != 'Mn')
        v2 = ''.join(c for c in unicodedata.normalize('NFD', p2) if unicodedata.category(c) != 'Mn')
        variants.extend([v1, v2])

    clean_set = set()
    for v in variants:
        v_c = clean_label(v)
        if len(v_c) > 1:
            clean_set.add(v_c)
    return list(clean_set)

HEAD_NOUNS_AND_ABBREVIATIONS = {
    # Abréviations médicales
    'n', 'nn', 'm', 'mm', 'a', 'aa', 'v', 'vv', 'vx', 'lig', 'ligg', 'r', 'rr', 'br', 'proc', 'art', 'tub',
    # Os et repères osseux cardinaux
    'tête', 'tete', 'col', 'tubérosité', 'tuberosite', 'tubercule', 'processus', 'apophyse', 
    'épicondyle', 'epicondyle', 'condyle', 'incisure', 'échancrure', 'echancrure', 'trochlée', 'trochlee', 
    'capitulum', 'olécrâne', 'olecrane', 'patella', 'fémur', 'femur', 'tibia', 'fibula', 
    'humérus', 'humerus', 'radius', 'ulna', 'cubitus', 'scapula', 'omoplate', 'clavicule', 
    'sternum', 'côte', 'cote', 'vertèbre', 'vertebre', 'sacrum', 'coccyx', 'carpe', 'tarse', 
    'métacarpe', 'metacarpe', 'métatarse', 'metatarse', 'phalange', 'trochanter', 'malléole', 
    'malleole', 'acromion', 'crête', 'crete', 'épine', 'epine', 'diaphyse', 'épiphyse', 
    'epiphyse', 'métaphyse', 'metaphyse', 'os', 'calvaria', 'voûte', 'voute', 'facette',
    # Articulations & ligaments
    'ligament', 'ligaments', 'capsule', 'synoviale', 'ménisque', 'menisque', 
    'labrum', 'bourrelet', 'disque', 'tendon', 'gaine', 'bourse', 'fascia', 'aponévrose', 
    'aponevrose', 'syssarcose', 'articulation',
    # Muscles
    'muscle', 'muscles', 'chef', 'ventre', 'faisceau',
    # Vaisseaux & nerfs
    'artère', 'artere', 'artères', 'arteres', 'veine', 'veines', 
    'nerf', 'nerfs', 'rameau', 'rameaux', 'branche', 'branches', 
    'tronc', 'troncs', 'plexus', 'arcade', 'conduit', 'canal', 'canaux', 'vaisseau', 'vaisseaux', 
    'sinus', 'hiatus', 'foramen', 'orifice', 'nœud', 'noeud', 'ganglion', 'racine',
    # Organes & régions
    'atrium', 'ventricule', 'valve', 'valvule', 'aorte', 'apex', 'fosse', 'fossette', 
    'gouttière', 'gouttiere', 'sillon', 'cavité', 'cavite', 'cartilage', 'face', 'bord', 
    'angle', 'lobe', 'lobule', 'hile', 'pédicule', 'pedicule', 'péritoine', 'peritoine', 
    'plèvre', 'plevre', 'poumon', 'trachée', 'trachee', 'bronche', 'larynx', 'pharynx', 
    'œsophage', 'oesophage', 'estomac', 'duodénum', 'duodenum', 'jéjunum', 'jejunum', 
    'iléon', 'ileon', 'côlon', 'colon', 'rectum', 'foie', 'vésicule', 'vesicule', 
    'pancréas', 'pancreas', 'rate', 'rein', 'uretère', 'uretere', 'urètre', 'uretre', 
    'vessie', 'ovaire', 'trompe', 'utérus', 'uterus', 'vagin', 'testicule', 'prostate', 
    'pénis', 'penis', 'moelle', 'encéphale', 'encephale', 'cerveau', 'cervelet', 
    'bulbe', 'pont', 'thalamus', 'mésencéphale', 'mesencephale', 'gyrus', 'scissure', 'méninge'
}

def is_new_legend_start(cand_text):
    clean = cand_text.strip()
    if not clean:
        return True
    # 1. Puce, tiret, astérisque, numéro
    if re.match(r'^[•\*\d+\.\-\>]|\(\d+\)', clean):
        return True
    # 2. Abréviation anatomique ou substantif cardinal au début
    first_token = re.split(r'[\s\.\-]+', clean)[0].lower()
    if first_token in HEAD_NOUNS_AND_ABBREVIATIONS:
        return True
    return False

def should_merge(curr_text, cand_text, v_dist, h_overlap, width_curr, width_cand, cx_dist):
    # 1. Règle horizontale stricte : même colonne obligatoire
    min_w = min(width_curr, width_cand)
    if h_overlap < min_w * 0.35 or cx_dist > 30:
        return False

    # 2. Règle verticale stricte : interligne très serré
    if v_dist < -4 or v_dist > 8:
        return False

    # 3. RÈGLE D'OR : UNE FLÈCHE = UNE LÉGENDE !
    # Si la ligne candidate commence une nouvelle légende distincte, INTERDICTION FORMELLE DE FUSIONNER !
    if is_new_legend_start(cand_text):
        return False

    # CAS A : Trait d'union alphabétique en fin de ligne (ex: 'processus -' ou 'fosse supra-')
    if re.search(r'[a-zA-ZÀ-ÿ]-$', curr_text.strip()):
        return True

    # CAS B : La ligne suivante commence par une préposition ou parenthèse
    cand_low = cand_text.lower().strip()
    if re.match(r'^(de\s+|du\s+|des\s+|de\s+la\s+|d[\'’]|et\s+|en\s+|vers\s+|pour\s+|\()', cand_low):
        return True

    # CAS C : La première ligne est un substantif court (ex: 'incisure' ou 'M. COURT' ou 'surface articulaire')
    # et la ligne suivante est son qualificatif adjectival (ex: 'trochléaire', 'ADDUCTEUR', 'carpienne')
    if len(curr_text.split()) <= 2:
        return True

    return False

def merge_stacked_boxes(boxes):
    """Fusionne UNIQUEMENT les morceaux d'une même légende coupée sur 2 lignes.
       Respecte strictement la règle : Une flèche = Une légende."""
    sorted_boxes = sorted(boxes, key=lambda b: (b['y0'], b['x0']))
    merged = []
    used = set()
    for i in range(len(sorted_boxes)):
        if i in used: continue
        curr = sorted_boxes[i]
        curr_text = curr['text']
        curr_x0, curr_y0, curr_x1, curr_y1 = curr['x0'], curr['y0'], curr['x1'], curr['y1']
        
        j = i + 1
        while j < len(sorted_boxes):
            if j not in used:
                cand = sorted_boxes[j]
                v_dist = cand['y0'] - curr_y1
                h_overlap = min(curr_x1, cand['x1']) - max(curr_x0, cand['x0'])
                width_curr = curr_x1 - curr_x0
                width_cand = cand['x1'] - cand['x0']
                cx_dist = abs((cand['x0'] + cand['x1'])/2 - (curr_x0 + curr_x1)/2)
                
                if should_merge(curr_text, cand['text'], v_dist, h_overlap, width_curr, width_cand, cx_dist):
                    if curr_text.endswith('-'):
                        if curr_text.endswith(' -'):
                            curr_text = curr_text[:-2].strip() + ' ' + cand['text']
                        else:
                            curr_text = curr_text[:-1].strip() + cand['text']
                    else:
                        curr_text = curr_text + ' ' + cand['text']
                    curr_x0 = min(curr_x0, cand['x0'])
                    curr_y0 = min(curr_y0, cand['y0'])
                    curr_x1 = max(curr_x1, cand['x1'])
                    curr_y1 = max(curr_y1, cand['y1'])
                    used.add(j)
                    j += 1
                    continue
                elif v_dist > 15:
                    break
            j += 1
        merged.append({'text': curr_text, 'x0': curr_x0, 'y0': curr_y0, 'x1': curr_x1, 'y1': curr_y1})
    return merged

print("=== Début de l'analyse du polycopié poly.pdf ===")
doc = fitz.open(PDF_PATH)
print(f"Document ouvert : {len(doc)} pages.")

# Extraction de la structure hiérarchique page par page
page_meta = {}
curr_sec = ""
curr_subsec = ""

for p_idx in range(len(doc)):
    p_num = p_idx + 1
    ch_id, ch_name = get_chapter(p_num)
    page = doc[p_idx]
    blocks = page.get_text("dict")["blocks"]
    
    for b in blocks:
        if b.get("type") == 0:
            for line in b["lines"]:
                txt = "".join(s["text"] for s in line["spans"]).strip()
                sz = line["spans"][0].get("size", 0) if line["spans"] else 0
                
                if re.match(r"^(I|II|III|IV|V|VI|VII|VIII|IX|X)\.\s+([A-ZÀ-Ÿ].*)", txt) and sz >= 14:
                    curr_sec = clean_label(txt)
                    curr_subsec = ""
                elif re.match(r"^([A-Z]\.|\d+\.)\s+([A-ZÀ-Ÿ].*)", txt) and sz >= 11:
                    curr_subsec = clean_label(txt)

    page_meta[p_num] = {
        "chapter_id": ch_id,
        "chapter_name": ch_name,
        "section": curr_sec,
        "subsection": curr_subsec
    }

# Police pour le dessin des badges
badge_font = None
for f_path in ["/System/Library/Fonts/Helvetica.ttc", "/System/Library/Fonts/Supplemental/Arial.ttf"]:
    if os.path.exists(f_path):
        badge_font = ImageFont.truetype(f_path, 13)
        break
if not badge_font:
    badge_font = ImageFont.load_default()

all_planches = []
planche_id = 1
seen_hashes = set()

print("\n=== Extraction et Traitement des Schémas ===")

for p_idx in range(len(doc)):
    p_num = p_idx + 1
    ch_id, ch_name = get_chapter(p_num)
    if ch_id == 0:
        continue # Ignorer pages de préface / sommaire

    page = doc[p_idx]
    text_blocks = []
    for b in page.get_text("dict")["blocks"]:
        if b.get("type") == 0:
            full_t = " ".join("".join(s["text"] for s in l["spans"]) for l in b["lines"]).strip()
            if full_t:
                font = b["lines"][0]["spans"][0].get("font", "")
                sz = b["lines"][0]["spans"][0].get("size", 0)
                text_blocks.append((b["bbox"], font, sz, full_t))

    imgs = page.get_images(full=True)
    meaningful_imgs = [img for img in imgs if img[0] != 5]

    for img_info in meaningful_imgs:
        xref = img_info[0]
        base_img = doc.extract_image(xref)
        w, h = base_img["width"], base_img["height"]
        
        # Ignorer trop petites images (icônes, puces, décorations)
        if w < 160 or h < 160:
            continue

        img_bytes = base_img["image"]
        img_hash = hash(img_bytes[:1000] + img_bytes[-1000:])
        if img_hash in seen_hashes:
            continue
        seen_hashes.add(img_hash)

        # Trouver le rect sur la page
        rects = page.get_image_rects(xref)
        img_rect = rects[0] if rects else None

        # Recherche de la légende dans le texte à proximité
        caption = ""
        if img_rect:
            candidates = []
            for bbox, font, sz, txt in text_blocks:
                is_below = 0 <= bbox[1] - img_rect.y1 <= 45 and (img_rect.x0 - 50 <= bbox[0] <= img_rect.x1 + 50)
                is_above = 0 <= img_rect.y0 - bbox[3] <= 35 and (img_rect.x0 - 50 <= bbox[0] <= img_rect.x1 + 50)
                is_italic = "italic" in font.lower()
                has_kw = any(k in txt.lower() for k in ["vue ", "schéma", "coupe", "figure", "différentes", "face "])
                
                if (is_below or is_above) and (is_italic or has_kw or len(txt) < 80):
                    priority = 0
                    if is_below and is_italic: priority += 10
                    if is_below: priority += 5
                    if has_kw: priority += 3
                    candidates.append((priority, txt))
            if candidates:
                candidates.sort(key=lambda c: c[0], reverse=True)
                caption = clean_label(candidates[0][1])

        # Titre et sous-titre de fallback
        sec_info = page_meta[p_num]
        title = caption if caption else (sec_info["subsection"] or sec_info["section"] or f"Schéma {planche_id}")
        if len(title) > 90:
            title = title[:87] + "..."
            
        subtitle = sec_info["subsection"] if caption and sec_info["subsection"] != caption else sec_info["section"]

        # Sauvegarder image temporaire pour OCR
        tmp_png = os.path.join(SCRATCH_DIR, f"tmp_{xref}.png")
        orig_pil = Image.open(io.BytesIO(img_bytes)).convert("RGB")
        orig_pil.save(tmp_png)

        # Lancer OCR avec coordonnées
        res = subprocess.run([OCR_BIN, tmp_png, "--boxes"], capture_output=True, text=True)
        raw_lines = [l.strip() for l in res.stdout.split("\n") if l.strip()]
        if os.path.exists(tmp_png):
            os.remove(tmp_png)

        # Parser les boîtes OCR
        W, H = orig_pil.size
        cand_boxes = []
        for line in raw_lines:
            if "||" not in line: continue
            parts = line.rsplit("||", 1)
            text, coords = parts[0].strip(), parts[1].strip()
            
            # Filtre des mentions d'orientation, bruit et watermarks
            text_low = text.lower()
            if any(k in text_low for k in [
                "elsevier", "drake et al", "studentconsult", "gray's anatomy", "grav's anatomy",
                "vue antérieure", "vue postérieure", "vue latérale", "vue supérieure", "vue inférieure",
                "vue de face", "face antérieure", "face postérieure", "tutorat", "mineure santé", "page "
            ]):
                continue
            # Filtrer les pavés de légende de figures du type "Figure 4. Anatomie du canal tarsien..."
            if (text_low.startswith("figure ") or text_low.startswith("fig. ")) and len(text) > 30:
                continue
            if text.count(';') >= 2 or len(re.findall(r'\b\d+\.\s*', text)) >= 2:
                continue
            if len(text) < 2 or text.isdigit():
                continue

            coord_parts = [c.strip() for c in coords.split(",") if c.strip()]
            if len(coord_parts) != 4:
                continue
            try:
                bx, by, bw, bh = map(float, coord_parts)
            except ValueError:
                continue

            x0 = int(bx * W)
            x1 = int((bx + bw) * W)
            y0 = int((1.0 - (by + bh)) * H)
            y1 = int((1.0 - by) * H)
            
            cand_boxes.append({"text": text, "x0": x0, "y0": y0, "x1": x1, "y1": y1})

        # Fusion des étiquettes multi-lignes
        merged_boxes = merge_stacked_boxes(cand_boxes)

        # S'il y a moins de 2 termes anatomiques identifiés, ignorer
        if len(merged_boxes) < 2:
            continue

        # Création de l'image de Quiz (Masquée avec badges numérotés)
        quiz_pil = orig_pil.copy()
        draw = ImageDraw.Draw(quiz_pil)

        items = []
        item_counter = 1

        for box in merged_boxes:
            lbl = clean_label(box["text"])
            if len(lbl) < 2 or lbl.lower() in ["droite", "gauche", "ventral", "dorsal", "crânial", "caudal"]:
                continue

            x0, y0, x1, y1 = box["x0"], box["y0"], box["x1"], box["y1"]
            
            # 1. Masquer le texte avec un rectangle blanc propre légèrement élargi
            pad = 3
            draw.rounded_rectangle([max(0, x0 - pad), max(0, y0 - pad), min(W, x1 + pad), min(H, y1 + pad)], radius=4, fill="white", outline="#cbd5e1", width=1)
            
            # 2. Placer un badge circulaire numéroté élégant
            cx = (x0 + x1) // 2
            cy = (y0 + y1) // 2
            r = max(11, (y1 - y0) // 2 + 2)
            draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill="#0284c7", outline="#0369a1", width=2)
            
            num_str = str(item_counter)
            bbox_t = draw.textbbox((0, 0), num_str, font=badge_font)
            tw = bbox_t[2] - bbox_t[0]
            th = bbox_t[3] - bbox_t[1]
            draw.text((cx - tw // 2, cy - th // 2 - 1), num_str, fill="white", font=badge_font)

            items.append({
                "id": f"p{planche_id}-{item_counter}",
                "num": item_counter,
                "label": lbl,
                "accepted": generate_accepted(lbl),
                "box": [x0, y0, x1, y1]
            })
            item_counter += 1

        if len(items) < 2:
            continue

        # Sauvegarde des images optimisées WebP
        img_name_quiz = f"schema_{planche_id:03d}.webp"
        img_name_orig = f"schema_{planche_id:03d}_orig.webp"
        dest_quiz = os.path.join(IMAGES_DIR, img_name_quiz)
        dest_orig = os.path.join(IMAGES_DIR, img_name_orig)

        quiz_pil.save(dest_quiz, "WEBP", quality=88, method=6)
        orig_pil.save(dest_orig, "WEBP", quality=88, method=6)

        planche_data = {
            "id": planche_id,
            "number": f"Schéma {planche_id}",
            "chapter_id": ch_id,
            "chapter": ch_name,
            "section": sec_info["section"],
            "subsection": sec_info["subsection"],
            "title": title,
            "subtitle": subtitle,
            "page": p_num,
            "image": f"images/{img_name_quiz}",
            "image_original": f"images/{img_name_orig}",
            "sections": [
                {
                    "name": "Légende anatomique",
                    "items": items
                }
            ]
        }
        all_planches.append(planche_data)
        print(f"  ✓ [{ch_name[:12]}] Schéma {planche_id:03d} (p.{p_num}) : {title[:35]} ({len(items)} éléments)")
        planche_id += 1

print(f"\nSauvegarde de {len(all_planches)} schémas dans {DATA_JSON}...")
with open(DATA_JSON, "w", encoding="utf-8") as f:
    json.dump(all_planches, f, ensure_ascii=False, indent=2)

print(f"Génération du module JavaScript autonome {DATA_JS}...")
with open(DATA_JS, "w", encoding="utf-8") as f:
    f.write("// Base de données complète Anat'PASS Poly embarquée\n")
    f.write("const EMBEDDED_PLANCHES = ")
    json.dump(all_planches, f, ensure_ascii=False, indent=2)
    f.write(";\n")

print(f"=== Extraction terminée avec succès : {len(all_planches)} planches générées ! ===")

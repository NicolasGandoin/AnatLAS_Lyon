# 🩺 Anat'LAS Lyon — Entraîneur de Schémas d'Anatomie (Polycopié PASS Lyon Est)

Application interactive moderne conçue pour l'apprentissage par cœur et l'entraînement intensif sur l'intégralité des **390 schémas d'anatomie** du **Polycopié officiel de cours (PASS / L.AS Lyon Est — UE5)**.

---

## 🎯 Fonctionnalités & Innovations

- **10 Chapitres Complets & Structurés** :
  1. **Membre supérieur** (Os, articulations, myologie, vascularisation)
  2. **Membre inférieur** (Coxo-fémorale, genou, jambe, pied, loges musculaires)
  3. **Le squelette axial** (Crâne, boîte crânienne, étages du rachis, vertèbres)
  4. **Appareil respiratoire** (Larynx, voies aériennes, poumons, plèvres, médiastin)
  5. **Appareil cardio-vasculaire** (Cœur, cavités, valves, artères et veines du corps)
  6. **Appareil digestif** (Cavité orale, œsophage, estomac, foie, pancréas, côlon)
  7. **Appareil urinaire** (Reins, uretères, néphrons)
  8. **Appareil reproducteur féminin** (Utérus, ovaires, trompes, vagin)
  9. **Appareil reproducteur masculin** (Testicules, voies spermatiques, prostate)
  10. **Appareil nerveux central** (Moelle spinale, tronc cérébral, cervelet, hémisphères cérébraux)

- **Double Mode d'Affichage du Schéma** :
  - 🎯 **Mode Quiz** : Toutes les légendes sont masquées et remplacées par des pastilles numérotées bien visibles pointées par les flèches d'origine.
  - 👁️ **Mode Original** : Affiche instantanément le schéma avec les légendes complètes d'origine pour vérifier ou réviser passivement.

- **Écran Partagé & Ergonomie Tablette** :
  - **À gauche** : Le schéma anatomique en haute définition avec zoom à la molette / pincement deux doigts et pan à la souris / 1 doigt.
  - **À droite** : La feuille de test avec numéros et zones de saisie interactive.
  - **Sélecteur de mode** : *Schéma*, *Partagé*, ou *Test* (idéal avec le clavier virtuel ouvert).

- **Moteur de Validation Intelligent** :
  - **Strict PASS** : Exige la terminologie exacte officielle du polycopié. Les synonymes sont reconnus et signalés avec le terme officiel attendu.
  - **Tolérant + Rappel** : Valide les synonymes anatomiques tout en affichant la désignation officielle.
  - **Tolérance intelligente** : Insensible aux accents, articles (*le/la/les/l'*), et gère les abréviations médicales (*m. = muscle*, *lig. = ligament*, *a. = artère*, etc.).
  - **Validation instantanée** : Validation au fil de l'eau ou avec <kbd>Entrée</kbd>, avec son de confirmation (Web Audio API) et passage automatique au champ suivant.

- **Outils de Révision** :
  - Bouton œil pour révéler un numéro individuel.
  - Bouton "Tout révéler" pour révision passive.
  - Bouton "Recommencer" pour remettre à zéro le schéma.
  - Tableau de bord de révision avec suivi global et répartition par chapitre.

---

## 🚀 Comment lancer l'application sur Mac ?

1. **Double-cliquez simplement sur `Lancer_AnatPASS.command`**.
2. L'application s'ouvre automatiquement dans votre navigateur (Safari, Chrome...).

*(Alternative : vous pouvez aussi ouvrir directement `index.html` dans Safari ou Chrome).*

---

## 📱 Utilisation sur iPad / Tablette

1. Connectez votre iPad au même réseau Wi-Fi que votre Mac.
2. Lancez `Lancer_AnatPASS.command` sur le Mac.
3. Tapez l'adresse IP affichée dans Safari sur l'iPad (ex: `http://192.168.1.XX:8080`).
4. Touchez le bouton de partage **⎋** puis **« Sur l'écran d'accueil »**.
5. L'application s'ouvre alors en plein écran sans aucune barre d'adresse, comme une application native iPad !

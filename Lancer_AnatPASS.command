#!/bin/bash
# ==============================================================================
# Anat'PASS — Lanceur 1-clic pour macOS
# Double-cliquez sur ce fichier pour ouvrir l'application dans votre navigateur
# ==============================================================================

cd "$(dirname "$0")"

# Recherche d'un port libre à partir de 8080
PORT=8080
while lsof -i :$PORT >/dev/null 2>&1; do
    PORT=$((PORT+1))
done

# Détection de l'adresse IP locale du Mac pour l'iPad
IP_LOCALE=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || ipconfig getifaddr en2 2>/dev/null || echo "votre-adresse-ip")

echo "========================================================"
echo "         🩺 Anat'PASS — Entraîneur de Schémas UE5        "
echo "========================================================"
echo ""
echo "💻 Sur ce Mac :"
echo "   http://localhost:$PORT"
echo ""
echo "📱 Sur votre iPad (connecté au même Wi-Fi) :"
echo "   http://$IP_LOCALE:$PORT"
echo ""
echo "--------------------------------------------------------"
echo "💡 Comment l'installer comme une vraie App sur iPad :"
echo "   1. Sur l'iPad, ouvrez Safari et tapez : http://$IP_LOCALE:$PORT"
echo "   2. Touchez le bouton Partager ⎋ (carré avec flèche vers le haut)"
echo "   3. Touchez « Sur l'écran d'accueil » puis « Ajouter »"
echo "   -> Anat'PASS est installée en plein écran avec son icône !"
echo "========================================================"
echo ""
echo "Ouverture dans votre navigateur..."

# Lancement du serveur local en arrière-plan
python3 -m http.server $PORT &
SERVER_PID=$!

# Attente brève que le serveur soit prêt
sleep 0.6

# Ouverture du navigateur par défaut (Safari, Chrome...)
open "http://localhost:$PORT"

echo "Application active ! Laissez cette fenêtre ouverte pendant vos révisions."
echo "Pour quitter, fermez simplement cette fenêtre de terminal."

# Attente de la fin du processus
wait $SERVER_PID

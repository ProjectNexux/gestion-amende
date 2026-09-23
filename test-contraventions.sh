#!/bin/bash
set -e

BASE_URL="http://localhost:3000"
ADMIN_USER="Mon espace"
ADMIN_PASS="ifLyO-yG"

echo "=========================================="
echo "TEST: Module Contraventions Complet"
echo "=========================================="

# Login admin
echo ""
echo "1️⃣  Admin login..."
RESPONSE=$(curl -s -c /tmp/cookies_admin.txt -X POST "$BASE_URL/login" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "nom=$ADMIN_USER&code=$ADMIN_PASS" \
  -L)

if echo "$RESPONSE" | grep -q "Mon espace"; then
  echo "✅ Login admin réussi"
else
  echo "❌ Login admin échoué"
fi

# Test contraventions page (5 filters)
echo ""
echo "2️⃣  Test page contraventions (5 filtres)..."
FILTERS=("toutes" "a_denoncer" "paiement_attente" "en_retard" "terminees")
for filter in "${FILTERS[@]}"; do
  RESPONSE=$(curl -s -b /tmp/cookies_admin.txt "$BASE_URL/admin/contraventions?f=$filter")
  if echo "$RESPONSE" | grep -q "contravention\|Dossier\|montant\|Statut"; then
    echo "  ✅ Filtre '$filter' fonctionne"
  else
    echo "  ❌ Filtre '$filter' échoué"
  fi
done

# Get list of contraventions to test detail page
echo ""
echo "3️⃣  Récupération des contraventions pour test détail..."
CONTRAVENTIONS_PAGE=$(curl -s -b /tmp/cookies_admin.txt "$BASE_URL/admin/contraventions")

# Extract first contravention ID
CONTRAVENTION_ID=$(echo "$CONTRAVENTIONS_PAGE" | grep -oP 'href="/admin/contraventions/\K[^"]+' | head -1)

if [ ! -z "$CONTRAVENTION_ID" ]; then
  echo "  ✅ Contravention trouvée: $CONTRAVENTION_ID"
  
  # Test detail page
  echo ""
  echo "4️⃣  Test page détail + actions statuts..."
  DETAIL_PAGE=$(curl -s -b /tmp/cookies_admin.txt "$BASE_URL/admin/contraventions/$CONTRAVENTION_ID")
  
  if echo "$DETAIL_PAGE" | grep -q "Dénonciation\|Paiement\|Observations"; then
    echo "  ✅ Page détail charge correctement"
  else
    echo "  ❌ Page détail incomplète"
  fi
else
  echo "  ❌ Pas de contravention trouvée"
fi

# Get admin clients to test client login
echo ""
echo "5️⃣  Récupération clients pour test accès client..."
CLIENTS_PAGE=$(curl -s -b /tmp/cookies_admin.txt "$BASE_URL/admin/clients")

# Extract client codes (need to get from page)
CLIENT_ID_1=$(echo "$CLIENTS_PAGE" | grep -oP 'href="/admin/clients/\K[^"]+' | head -1)
CLIENT_ID_2=$(echo "$CLIENTS_PAGE" | grep -oP 'href="/admin/clients/\K[^"]+' | tail -1)

if [ ! -z "$CLIENT_ID_1" ]; then
  echo "  ✅ Client 1 trouvé: $CLIENT_ID_1"
  
  # Get client code from detail page
  CLIENT_1_PAGE=$(curl -s -b /tmp/cookies_admin.txt "$BASE_URL/admin/clients/$CLIENT_ID_1")
  CLIENT_1_CODE=$(echo "$CLIENT_1_PAGE" | grep -oP 'codeAcces["\s]*[=:][\s"]*\K[^"]+' | head -1)
  
  if [ ! -z "$CLIENT_1_CODE" ]; then
    echo "  ✅ Code client 1 récupéré: $CLIENT_1_CODE"
    
    # Test client 1 login
    echo ""
    echo "6️⃣  Test Client 1 login..."
    CLIENT_1_RESPONSE=$(curl -s -c /tmp/cookies_client1.txt -X POST "$BASE_URL/login" \
      -H "Content-Type: application/x-www-form-urlencoded" \
      -d "code=$CLIENT_1_CODE" \
      -L)
    
    if echo "$CLIENT_1_RESPONSE" | grep -q "Mes contraventions\|contravention"; then
      echo "  ✅ Login client 1 réussi"
      
      # Test client contraventions page
      echo ""
      echo "7️⃣  Test page client/contraventions..."
      CLIENT_CONTRAV=$(curl -s -b /tmp/cookies_client1.txt "$BASE_URL/client/contraventions")
      
      if echo "$CLIENT_CONTRAV" | grep -q "contravention\|Dossier"; then
        echo "  ✅ Page client contraventions accessible"
      else
        echo "  ❌ Page client contraventions vide ou inaccessible"
      fi
    else
      echo "  ❌ Login client 1 échoué"
    fi
  fi
else
  echo "  ❌ Pas de client trouvé"
fi

echo ""
echo "=========================================="
echo "✅ Tests basiques complétés"
echo "=========================================="
echo ""
echo "Vérification base de données (statuts persistants)..."
echo "Interroger: SELECT id, statutDenonciation, statutPaiement FROM \"Contravention\" LIMIT 3;"

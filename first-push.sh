#!/bin/bash

# Script para el primer push a ambos repositorios
# Ejecutar DESPUÉS de crear los repositorios en GitHub y GitLab

set -e

echo "🚀 Primer push a repositorios remotos..."
echo ""

# Verificar que tenemos commits
if ! git log --oneline -1 > /dev/null 2>&1; then
    echo "❌ No hay commits en el repositorio local"
    exit 1
fi

echo "📊 Último commit:"
git log --oneline -1
echo ""

# Push inicial a GitHub
echo "🐙 Primer push a GitHub Cabify..."
if git push -u github main; then
    echo "✅ GitHub configurado como upstream"
else
    echo "❌ Error al hacer push a GitHub"
    echo "💡 Verifica que el repositorio existe:"
    echo "   https://github.com/cabify/n8n-nodes-aws-bedrock-assumerole"
    echo ""
    echo "🔧 Para crear el repositorio con GitHub CLI:"
    echo "   gh repo create cabify/n8n-nodes-aws-bedrock-assumerole --public"
    exit 1
fi

echo ""

# Push inicial a GitLab
echo "🦊 Primer push a GitLab interno..."
if git push -u gitlab main; then
    echo "✅ GitLab configurado correctamente"
else
    echo "❌ Error al hacer push a GitLab"
    echo "💡 Verifica que:"
    echo "   1. El proyecto existe en GitLab"
    echo "   2. Tienes acceso SSH: ssh -T git@gitlab.otters.xyz"
    echo "   3. El path es correcto: platform/business-automation/n8n-nodes-aws-bedrock-assumerole"
    exit 1
fi

echo ""
echo "🎉 ¡Repositorios configurados exitosamente!"
echo ""
echo "📍 URLs de los repositorios:"
echo "   🐙 GitHub: https://github.com/cabify/n8n-nodes-aws-bedrock-assumerole"
echo "   🦊 GitLab: https://gitlab.otters.xyz/platform/business-automation/n8n-nodes-aws-bedrock-assumerole"
echo ""
echo "🔄 Para futuros cambios, usa: ./sync-repos.sh"

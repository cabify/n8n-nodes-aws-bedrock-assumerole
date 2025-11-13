#!/bin/bash

# Script para sincronizar el código con ambos repositorios
# GitHub Cabify y GitLab interno

set -e

echo "🔄 Sincronizando repositorios..."
echo ""

# Verificar que estamos en la rama main
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "main" ]; then
    echo "⚠️  No estás en la rama main. Rama actual: $CURRENT_BRANCH"
    read -p "¿Continuar de todas formas? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Operación cancelada"
        exit 1
    fi
fi

# Mostrar estado actual
echo "📊 Estado actual:"
git status --short
echo ""

# Push a GitHub (principal)
echo "🐙 Subiendo a GitHub Cabify..."
if git push github main; then
    echo "✅ GitHub actualizado correctamente"
else
    echo "❌ Error al subir a GitHub"
    echo "💡 Asegúrate de que el repositorio existe en GitHub:"
    echo "   https://github.com/cabify/n8n-nodes-aws-bedrock-assumerole"
    exit 1
fi

# Push tags to GitHub
echo "🏷️  Subiendo tags a GitHub..."
if git push github --tags; then
    echo "✅ Tags de GitHub actualizados"
else
    echo "⚠️  No se pudieron subir los tags a GitHub (puede que no haya tags nuevos)"
fi

echo ""

# Push a GitLab (espejo)
echo "🦊 Subiendo a GitLab interno..."
if git push gitlab main; then
    echo "✅ GitLab actualizado correctamente"
else
    echo "❌ Error al subir a GitLab"
    echo "💡 Asegúrate de que:"
    echo "   1. El proyecto existe en GitLab interno"
    echo "   2. Tienes permisos de escritura"
    echo "   3. Tu clave SSH está configurada"
    exit 1
fi

# Push tags to GitLab
echo "🏷️  Subiendo tags a GitLab..."
if git push gitlab --tags; then
    echo "✅ Tags de GitLab actualizados"
else
    echo "⚠️  No se pudieron subir los tags a GitLab (puede que no haya tags nuevos)"
fi

echo ""
echo "🎉 Sincronización completa!"
echo ""
echo "📍 Repositorios actualizados:"
echo "   🐙 GitHub: https://github.com/cabify/n8n-nodes-aws-bedrock-assumerole"
echo "   🦊 GitLab: https://gitlab.otters.xyz/platform/business-automation/n8n-nodes-aws-bedrock-assumerole"

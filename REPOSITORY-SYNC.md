# Sincronización de Repositorios GitHub y GitLab

## 📋 Configuración Actual

El proyecto está configurado para sincronizarse con dos repositorios:

- **🐙 GitHub Cabify** (Principal): `https://github.com/cabify/n8n-nodes-aws-bedrock-assumerole`
- **🦊 GitLab Interno** (Espejo): `git@gitlab.otters.xyz:platform/business-automation/n8n-nodes-aws-bedrock-assumerole`

## 🚀 Primer Setup (Solo una vez)

### 1. Crear Repositorio en GitHub Cabify

**Opción A: GitHub CLI**
```bash
gh auth login
gh repo create cabify/n8n-nodes-aws-bedrock-assumerole \
  --description "n8n community node for AWS Bedrock with AssumeRole authentication" \
  --public
```

**Opción B: Web Interface**
1. Ve a https://github.com/orgs/cabify/repositories
2. New repository → `n8n-nodes-aws-bedrock-assumerole`
3. Public, sin README inicial

### 2. Crear Proyecto en GitLab Interno

1. Ve a https://gitlab.otters.xyz/platform/business-automation
2. New project → `n8n-nodes-aws-bedrock-assumerole`
3. O verifica que el path existe

### 3. Primer Push

```bash
# Ejecutar el script de primer push
./first-push.sh
```

## 🔄 Workflow de Desarrollo

### Para Cambios Regulares

```bash
# 1. Hacer cambios en el código
git add .
git commit -m "Descripción del cambio"

# 2. Sincronizar ambos repositorios
./sync-repos.sh
```

### Para Cambios Manuales

```bash
# Push individual a GitHub
git push github main

# Push individual a GitLab
git push gitlab main
```

## 🛠️ Scripts Disponibles

### `first-push.sh`
- **Uso**: Solo la primera vez después de crear los repositorios
- **Función**: Configura upstream tracking y hace el push inicial
- **Ejecutar**: `./first-push.sh`

### `sync-repos.sh`
- **Uso**: Para todos los pushes posteriores
- **Función**: Sincroniza cambios con ambos repositorios
- **Ejecutar**: `./sync-repos.sh`

## 🔍 Verificación de Estado

### Verificar Remotes
```bash
git remote -v
# Debería mostrar:
# github  https://github.com/cabify/n8n-nodes-aws-bedrock-assumerole.git
# gitlab  git@gitlab.otters.xyz:platform/business-automation/n8n-nodes-aws-bedrock-assumerole.git
```

### Verificar Conectividad
```bash
# Test GitHub
git ls-remote github

# Test GitLab SSH
ssh -T git@gitlab.otters.xyz
```

### Verificar Sincronización
```bash
# Ver último commit en cada remote
git log --oneline -1 github/main
git log --oneline -1 gitlab/main
```

## 🚨 Troubleshooting

### Error: Repository not found (GitHub)
```bash
# Verificar que el repo existe
curl -s https://api.github.com/repos/cabify/n8n-nodes-aws-bedrock-assumerole

# Recrear remote si es necesario
git remote remove github
git remote add github https://github.com/cabify/n8n-nodes-aws-bedrock-assumerole.git
```

### Error: Permission denied (GitLab)
```bash
# Verificar SSH key
ssh -T git@gitlab.otters.xyz

# Verificar permisos en el proyecto GitLab
# Contactar admin si es necesario
```

### Error: Divergent branches
```bash
# Si los repos se desincronizaron
git fetch --all
git status

# Resolver conflictos manualmente o forzar push (cuidado)
git push --force-with-lease github main
git push --force-with-lease gitlab main
```

## 📊 Estrategia de Branching

### Rama Principal
- **main**: Código estable y listo para producción
- Ambos repositorios mantienen la misma rama main

### Ramas de Feature (Recomendado)
```bash
# Crear rama de feature
git checkout -b feature/nueva-funcionalidad

# Trabajar en la feature
git add . && git commit -m "Implementar nueva funcionalidad"

# Push solo a GitHub para review
git push github feature/nueva-funcionalidad

# Después del merge a main, sincronizar
git checkout main
git pull github main
./sync-repos.sh
```

## 🎯 Best Practices

1. **Siempre usar scripts**: `./sync-repos.sh` en lugar de push manual
2. **Verificar antes de push**: `git status` y `git log --oneline -5`
3. **Mantener sincronizados**: No hacer push a solo uno de los repos
4. **Usar branches**: Para features grandes, usar ramas separadas
5. **Documentar cambios**: Commits descriptivos y CHANGELOG actualizado

## 📈 Monitoreo

### Verificación Diaria
```bash
# Script para verificar sincronización
git fetch --all
echo "GitHub: $(git rev-parse github/main)"
echo "GitLab: $(git rev-parse gitlab/main)"
echo "Local:  $(git rev-parse main)"
```

### Alertas Automáticas
- Configurar webhooks en ambos repos para notificaciones
- Monitorear que ambos repos tengan el mismo commit hash

¡Con esta configuración, tendrás sincronización automática entre GitHub Cabify y GitLab interno! 🚀

# Configuración de Repositorios GitHub y GitLab

## 📋 Pasos para Configurar los Repositorios

### 1. 🐙 Crear Repositorio en GitHub Cabify

**Opción A: Usando GitHub CLI (recomendado)**
```bash
# Instalar GitHub CLI si no lo tienes
brew install gh

# Autenticarte con GitHub
gh auth login

# Crear el repositorio en la organización Cabify
gh repo create cabify/n8n-nodes-aws-bedrock-assumerole \
  --description "n8n community node for AWS Bedrock with AssumeRole authentication" \
  --public \
  --clone=false

# Añadir el remote de GitHub
git remote add github https://github.com/cabify/n8n-nodes-aws-bedrock-assumerole.git
```

**Opción B: Manualmente en GitHub Web**
1. Ve a https://github.com/orgs/cabify/repositories
2. Haz clic en "New repository"
3. Nombre: `n8n-nodes-aws-bedrock-assumerole`
4. Descripción: `n8n community node for AWS Bedrock with AssumeRole authentication`
5. Público
6. No inicializar con README (ya tenemos el código)
7. Crear repositorio

Luego añadir el remote:
```bash
git remote add github https://github.com/cabify/n8n-nodes-aws-bedrock-assumerole.git
```

### 2. 🦊 Configurar GitLab Interno

```bash
# Añadir remote para GitLab interno
git remote add gitlab git@gitlab.otters.xyz:platform/business-automation/n8n-nodes-aws-bedrock-assumerole.git

# Verificar que tienes acceso SSH a GitLab
ssh -T git@gitlab.otters.xyz
```

**Nota**: Es posible que necesites crear el proyecto en GitLab primero:
1. Ve a https://gitlab.otters.xyz/platform/business-automation
2. Crear nuevo proyecto: `n8n-nodes-aws-bedrock-assumerole`
3. O usar el path existente si ya está creado

### 3. 🚀 Subir Código a Ambos Repositorios

```bash
# Subir a GitHub (principal)
git push github main

# Subir a GitLab (espejo)
git push gitlab main
```

### 4. 🔄 Configurar Branch por Defecto

```bash
# Establecer GitHub como origin principal
git remote rename origin old-origin 2>/dev/null || true
git remote rename github origin

# Verificar configuración
git remote -v
```

### 5. 📝 Configurar Repositorio para Desarrollo

```bash
# Configurar upstream tracking
git branch --set-upstream-to=origin/main main

# Verificar configuración
git status
```

## 🔧 Comandos de Mantenimiento

### Sincronizar Ambos Repositorios
```bash
# Hacer cambios y commit
git add .
git commit -m "Tu mensaje de commit"

# Push a ambos repositorios
git push origin main        # GitHub (principal)
git push gitlab main        # GitLab (espejo)
```

### Script de Sincronización Automática
```bash
#!/bin/bash
# sync-repos.sh
echo "🔄 Sincronizando repositorios..."
git push origin main && echo "✅ GitHub actualizado"
git push gitlab main && echo "✅ GitLab actualizado"
echo "🎉 Sincronización completa"
```

## 📊 Estado Actual

- ✅ **Git Local**: Inicializado con commit inicial
- ⏳ **GitHub Cabify**: Pendiente de crear repositorio
- ⏳ **GitLab Interno**: Pendiente de configurar remote
- ⏳ **Sincronización**: Pendiente de primer push

## 🎯 Próximos Pasos

1. Ejecutar los comandos de la sección 1 para crear el repo en GitHub
2. Ejecutar los comandos de la sección 2 para configurar GitLab
3. Hacer el primer push a ambos repositorios
4. Configurar el workflow de sincronización

¡Una vez completados estos pasos, tendrás el código disponible en ambas plataformas! 🚀

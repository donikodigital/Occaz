# backend/Dockerfile
# backend/Dockerfile
#
# Build multi-étapes : l'étape "builder" contient tout ce qu'il faut
# pour compiler (devDependencies incluses), l'image finale ne garde
# que le strict nécessaire pour tourner — sensiblement plus légère et
# avec une surface d'attaque plus réduite qu'une image "tout en un".

# --- Étape 1 : dépendances + génération du client Prisma ---
FROM node:22-alpine AS deps
WORKDIR /app
# Le moteur Prisma (musl) a besoin d'OpenSSL, absent par défaut d'Alpine —
# sans ça, échec au démarrage ("Error loading shared library libssl.so").
RUN apk add --no-cache openssl
COPY package.json package-lock.json ./
RUN npm ci
COPY prisma ./prisma
RUN npx prisma generate

# --- Étape 2 : compilation TypeScript ---
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/prisma ./prisma
COPY . .
RUN npm run build

# --- Étape 3 : dépendances de production uniquement ---
# Le CLI `prisma` est une devDependency (seul @prisma/client, le
# runtime, est nécessaire en production) — donc pas de nouvelle
# génération ici, on récupère directement le client déjà généré à
# l'étape "deps" plutôt que de réinstaller le CLI juste pour ça.
FROM node:22-alpine AS production-deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=deps /app/node_modules/.prisma ./node_modules/.prisma

# --- Étape 4 : image finale ---
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache openssl

# Utilisateur non-root — bonne pratique standard, évite qu'un
# éventuel accès au conteneur donne directement les droits root.
RUN addgroup -g 1001 -S nodejs && adduser -S nestjs -u 1001
COPY --from=production-deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY package.json ./

USER nestjs

EXPOSE 3000

# Utilisé par Docker/Render pour savoir si le conteneur est prêt à
# recevoir du trafic — voir src/health/health.controller.ts pour la
# distinction liveness/readiness ; ce healthcheck vise la readiness,
# la plus utile pour un load balancer.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/v1/health/ready', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "dist/main"]

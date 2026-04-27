# Kiosco Tracker (Next.js + Supabase)

## Configuracion local

1. Instala dependencias:

```bash
npm install
```

2. Crea `.env.local` con:

```bash
NEXT_PUBLIC_SUPABASE_URL=tu_url_de_supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key
```

3. En Supabase SQL Editor ejecuta el contenido de `supabase-schema.sql`.
4. En Supabase Auth habilita Email/Password.
5. Levanta local:

```bash
npm run dev
```

## Deploy en Vercel

1. Importa el proyecto en Vercel.
2. En `Project Settings -> Environment Variables` agrega:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Haz deploy.

Con eso la app queda funcional con autenticacion y datos persistentes por usuaria.

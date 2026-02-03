#!/bin/bash

echo "🕉️  Setting up Heartfulness RAG System..."

# Create directory structure
mkdir -p src/{components,pages,services,hooks,lib,types,config}
mkdir -p src/components/{ui,chat,admin,layout}
mkdir -p src/pages/{admin,chat,auth}
mkdir -p public

echo "✅ Created directory structure"

# Create vite.config.ts
cat > vite.config.ts << 'EOF'
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  server: {
    port: 5174
  }
});
EOF

# Create tsconfig.json
cat > tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
EOF

# Create tsconfig.node.json
cat > tsconfig.node.json << 'EOF'
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts"]
}
EOF

# Create tailwind.config.js
cat > tailwind.config.js << 'EOF'
/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
	],
  theme: {
    extend: {
      colors: {
        spiritual: {
          primary: '#8B4789',
          secondary: '#D4A574',
          accent: '#6B9080'
        }
      }
    },
  },
  plugins: [],
}
EOF

# Create postcss.config.js
cat > postcss.config.js << 'EOF'
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
EOF

# Create index.html
cat > index.html << 'EOF'
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/om.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Heartfulness - Spiritual Learning System</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
EOF

# Create .env.example
cat > .env.example << 'EOF'
# Supabase (same project as case-wise-crm)
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# OpenRouter for Grok LLM
VITE_OPENROUTER_API_KEY=your_openrouter_key
VITE_OPENROUTER_MODEL=google/gemini-2.0-flash-exp:free

# OpenAI for Embeddings
VITE_OPENAI_API_KEY=your_openai_key
EOF

echo "✅ Created configuration files"
echo "🎉 Project setup complete!"
echo ""
echo "Next steps:"
echo "  1. Copy .env.example to .env.local"
echo "  2. Fill in your API keys"
echo "  3. Run: npm install"
echo "  4. Run: npm run dev"


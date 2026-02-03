#!/bin/bash

# Read environment variables from .env.local and add to Vercel

echo "Setting up Vercel environment variables..."

# Source the .env.local file
source .env.local

# Add each variable to Vercel (production, preview, development)
echo "$VITE_SUPABASE_URL" | vercel env add VITE_SUPABASE_URL production --force
echo "$VITE_SUPABASE_ANON_KEY" | vercel env add VITE_SUPABASE_ANON_KEY production --force
echo "$VITE_OPENAI_API_KEY" | vercel env add VITE_OPENAI_API_KEY production --force
echo "$VITE_OPENROUTER_API_KEY" | vercel env add VITE_OPENROUTER_API_KEY production --force

echo "✅ Environment variables set!"
echo "Now redeploying to apply changes..."

vercel --prod --yes

echo "🎉 Deployment complete!"

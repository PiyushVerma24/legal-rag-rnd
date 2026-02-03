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
        // Legal branding colors (for auth, headers, titles only)
        legal: {
          primary: '#3b82f6', // Blue
          secondary: '#1e3a8a', // Navy
          accent: '#d4af37', // Gold
          accentHover: '#b8941f'
        },
        // Dark theme - KEEP ORIGINAL HEARTFULNESS STYLE
        // (orange accents work great for chat interface)
        dark: {
          bg: {
            primary: '#1E1E1E',
            secondary: '#2B2B2B',
            tertiary: '#2A2A2A',
            elevated: '#333333'
          },
          border: {
            primary: '#3A3A3A',
            secondary: '#404040'
          },
          text: {
            primary: '#FFFFFF',
            secondary: '#B0B0B0',
            muted: '#808080'
          },
          accent: {
            orange: '#E87D5F', // KEEP ORIGINAL ORANGE - works great for chat
            orangeHover: '#D97757',
            pink: '#E06C75',
            // Add legal blue as additional option
            blue: '#3b82f6',
            blueHover: '#2563eb',
            gold: '#d4af37'
          }
        }
      }
    },
  },
  plugins: [],
}

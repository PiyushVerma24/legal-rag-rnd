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
        },
        // New dark theme colors inspired by provided design
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
            orange: '#E87D5F',
            orangeHover: '#D97757',
            pink: '#E06C75'
          }
        }
      }
    },
  },
  plugins: [],
}

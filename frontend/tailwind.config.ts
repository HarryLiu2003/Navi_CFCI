import type { Config } from "tailwindcss";

export default {
    darkMode: 'media',
    content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  safelist: [
    // Gray
    'bg-gray-50', 'text-gray-700', 'border-gray-100',
    // Red
    'bg-red-50', 'text-red-700', 'border-red-100',
    // Orange
    'bg-orange-50', 'text-orange-700', 'border-orange-100',
    // Yellow
    'bg-yellow-50', 'text-yellow-700', 'border-yellow-100',
    // Green
    'bg-green-50', 'text-green-700', 'border-green-100',
    // Teal
    'bg-teal-50', 'text-teal-700', 'border-teal-100',
    // Blue
    'bg-blue-50', 'text-blue-700', 'border-blue-100',
    // Indigo
    'bg-indigo-50', 'text-indigo-700', 'border-indigo-100',
    // Purple
    'bg-purple-50', 'text-purple-700', 'border-purple-100',
    // Pink
    'bg-pink-50', 'text-pink-700', 'border-pink-100',
    // Add ring classes used in the modal for selected color swatch
    'ring-2', 
    'ring-offset-1', 
    'ring-foreground'
  ],
  theme: {
  	extend: {
  		colors: {
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			}
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;

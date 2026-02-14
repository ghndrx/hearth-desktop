/** @type {import('tailwindcss').Config} */
export default {
	content: ['./src/**/*.{html,js,svelte,ts}'],
	theme: {
		extend: {
			colors: {
				// Hearth brand colors - warm, cozy theme
				hearth: {
					50: '#fef7ee',
					100: '#fcecd7',
					200: '#f8d5ae',
					300: '#f3b87a',
					400: '#ed9344',
					500: '#e87620',
					600: '#d95e16',
					700: '#b44614',
					800: '#903918',
					900: '#743116',
					950: '#3f170a'
				},
				// Dark theme colors
				dark: {
					50: '#f6f6f7',
					100: '#e1e2e6',
					200: '#c3c5cc',
					300: '#9ea1ab',
					400: '#797d8a',
					500: '#5f6370',
					600: '#4b4e59',
					700: '#3e404a',
					800: '#35373e',
					900: '#2f3136',
					950: '#1e1f22'
				}
			}
		}
	},
	plugins: []
};

<script lang="ts">
	export let size: number = 12;
	export let color: string = 'currentColor';
	export let direction: 'up' | 'down' | 'left' | 'right' = 'down';
	
	$: rotation = {
		up: 180,
		down: 0,
		left: 90,
		right: -90
	}[direction];
</script>

<svg 
	width={size} 
	height={size} 
	viewBox="0 0 24 24" 
	fill="none" 
	stroke={color} 
	stroke-width="2" 
	stroke-linecap="round" 
	stroke-linejoin="round"
	style="transform: rotate({rotation}deg); transition: transform 0.2s"
>
	<polyline points="6 9 12 15 18 9" />
</svg>

<script lang="ts">
	export let size: number = 20;
	export let className: string = '';
</script>

<svg
	viewBox="0 0 24 24"
	width={size}
	height={size}
	fill="currentColor"
	class={className}
	aria-hidden="true"
>
	<!-- Megaphone body -->
	<path d="M18 11V10C18 9.447 18.447 9 19 9C19.553 9 20 9.447 20 10V14C20 14.553 19.553 15 19 15C18.447 15 18 14.553 18 14V13H17V18C17 18.553 16.553 19 16 19C15.447 19 15 18.553 15 18V13H6V18C6 19.103 5.103 20 4 20C2.897 20 2 19.103 2 18V14.247C2.313 14.085 2.685 14 3 14V13.5C3 13.224 2.776 13 2.5 13H2V11H2.5C2.776 11 3 10.776 3 10.5V10C3 9.685 2.313 9.915 2 9.753V6C2 4.897 2.897 4 4 4C5.103 4 6 4.897 6 6V11H18Z"/>
	<!-- Sound lines -->
	<path d="M21.5 8.5L23 7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
	<path d="M21.5 12H23.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
	<path d="M21.5 15.5L23 17" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
</svg>

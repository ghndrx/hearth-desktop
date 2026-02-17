<script lang="ts">
  export let variant: 'primary' | 'secondary' | 'danger' | 'success' | 'ghost' = 'primary';
  export let size: 'sm' | 'md' | 'lg' = 'md';
  export let disabled = false;
  export let type: 'button' | 'submit' | 'reset' = 'button';
  export let fullWidth = false;
  export let ariaLabel: string | undefined = undefined;

  const variantClasses = {
    primary: 'bg-blurple-500 hover:bg-blurple-600 text-white',
    secondary: 'bg-gray-600 hover:bg-gray-700 text-white',
    danger: 'bg-red-500 hover:bg-red-600 text-white',
    success: 'bg-green-500 hover:bg-green-600 text-white',
    ghost: 'bg-transparent hover:bg-white/10 text-gray-300 hover:text-white',
  };

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
  };

  $: buttonClass = `
    ${variantClasses[variant]}
    ${sizeClasses[size]}
    ${fullWidth ? 'w-full' : ''}
    rounded font-medium transition-colors duration-150
    focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800
    disabled:opacity-50 disabled:cursor-not-allowed
  `.trim();
</script>

<button
  {type}
  {disabled}
  class={buttonClass}
  aria-label={ariaLabel}
  on:click
>
  <slot />
</button>

<style>
  button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    white-space: nowrap;
  }
</style>

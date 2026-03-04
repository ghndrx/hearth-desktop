<script lang="ts">
	import { onMount } from 'svelte';

	interface StatusCode {
		code: number;
		name: string;
		description: string;
		category: string;
	}

	const STATUS_CODES: StatusCode[] = [
		// 1xx Informational
		{ code: 100, name: 'Continue', description: 'Server received request headers, client should proceed', category: '1xx' },
		{ code: 101, name: 'Switching Protocols', description: 'Server is switching protocols as requested', category: '1xx' },
		{ code: 102, name: 'Processing', description: 'Server has received and is processing the request', category: '1xx' },
		{ code: 103, name: 'Early Hints', description: 'Used to return some response headers before final response', category: '1xx' },
		// 2xx Success
		{ code: 200, name: 'OK', description: 'Request succeeded', category: '2xx' },
		{ code: 201, name: 'Created', description: 'Request succeeded and a new resource was created', category: '2xx' },
		{ code: 202, name: 'Accepted', description: 'Request accepted for processing but not completed', category: '2xx' },
		{ code: 203, name: 'Non-Authoritative Info', description: 'Returned meta-info is from a cached copy', category: '2xx' },
		{ code: 204, name: 'No Content', description: 'Request succeeded but no content to return', category: '2xx' },
		{ code: 205, name: 'Reset Content', description: 'Request succeeded, client should reset document view', category: '2xx' },
		{ code: 206, name: 'Partial Content', description: 'Partial resource returned due to range header', category: '2xx' },
		{ code: 207, name: 'Multi-Status', description: 'Multiple status codes for multiple resources', category: '2xx' },
		{ code: 208, name: 'Already Reported', description: 'Members already enumerated in previous reply', category: '2xx' },
		{ code: 226, name: 'IM Used', description: 'Server fulfilled GET with instance manipulations', category: '2xx' },
		// 3xx Redirection
		{ code: 300, name: 'Multiple Choices', description: 'Multiple options for the requested resource', category: '3xx' },
		{ code: 301, name: 'Moved Permanently', description: 'Resource has been permanently moved to new URL', category: '3xx' },
		{ code: 302, name: 'Found', description: 'Resource temporarily at different URL', category: '3xx' },
		{ code: 303, name: 'See Other', description: 'Response at another URI using GET', category: '3xx' },
		{ code: 304, name: 'Not Modified', description: 'Resource not modified since last request', category: '3xx' },
		{ code: 305, name: 'Use Proxy', description: 'Resource must be accessed through a proxy', category: '3xx' },
		{ code: 307, name: 'Temporary Redirect', description: 'Temporarily at different URL, same method', category: '3xx' },
		{ code: 308, name: 'Permanent Redirect', description: 'Permanently at different URL, same method', category: '3xx' },
		// 4xx Client Errors
		{ code: 400, name: 'Bad Request', description: 'Server cannot process due to client error', category: '4xx' },
		{ code: 401, name: 'Unauthorized', description: 'Authentication required and has failed or not provided', category: '4xx' },
		{ code: 402, name: 'Payment Required', description: 'Reserved for future use', category: '4xx' },
		{ code: 403, name: 'Forbidden', description: 'Server refuses to authorize the request', category: '4xx' },
		{ code: 404, name: 'Not Found', description: 'Requested resource could not be found', category: '4xx' },
		{ code: 405, name: 'Method Not Allowed', description: 'Request method not supported for resource', category: '4xx' },
		{ code: 406, name: 'Not Acceptable', description: 'Resource not acceptable per Accept headers', category: '4xx' },
		{ code: 407, name: 'Proxy Auth Required', description: 'Authentication with proxy required', category: '4xx' },
		{ code: 408, name: 'Request Timeout', description: 'Server timed out waiting for the request', category: '4xx' },
		{ code: 409, name: 'Conflict', description: 'Request conflicts with current state of resource', category: '4xx' },
		{ code: 410, name: 'Gone', description: 'Resource is no longer available and won\'t return', category: '4xx' },
		{ code: 411, name: 'Length Required', description: 'Content-Length header is required', category: '4xx' },
		{ code: 412, name: 'Precondition Failed', description: 'Precondition in headers evaluated to false', category: '4xx' },
		{ code: 413, name: 'Payload Too Large', description: 'Request entity is larger than server accepts', category: '4xx' },
		{ code: 414, name: 'URI Too Long', description: 'URI requested is too long to process', category: '4xx' },
		{ code: 415, name: 'Unsupported Media Type', description: 'Media format not supported by server', category: '4xx' },
		{ code: 416, name: 'Range Not Satisfiable', description: 'Range specified in header cannot be fulfilled', category: '4xx' },
		{ code: 417, name: 'Expectation Failed', description: 'Expect request-header field requirement not met', category: '4xx' },
		{ code: 418, name: 'I\'m a Teapot', description: 'Server refuses to brew coffee with a teapot', category: '4xx' },
		{ code: 421, name: 'Misdirected Request', description: 'Request directed at server unable to respond', category: '4xx' },
		{ code: 422, name: 'Unprocessable Entity', description: 'Request well-formed but semantically incorrect', category: '4xx' },
		{ code: 423, name: 'Locked', description: 'Resource being accessed is locked', category: '4xx' },
		{ code: 424, name: 'Failed Dependency', description: 'Request failed due to failure of previous request', category: '4xx' },
		{ code: 425, name: 'Too Early', description: 'Server unwilling to risk processing replay', category: '4xx' },
		{ code: 426, name: 'Upgrade Required', description: 'Client should switch to a different protocol', category: '4xx' },
		{ code: 428, name: 'Precondition Required', description: 'Origin server requires conditional request', category: '4xx' },
		{ code: 429, name: 'Too Many Requests', description: 'User has sent too many requests (rate limiting)', category: '4xx' },
		{ code: 431, name: 'Headers Too Large', description: 'Server unwilling to process - headers too large', category: '4xx' },
		{ code: 451, name: 'Unavailable For Legal', description: 'Resource unavailable for legal reasons', category: '4xx' },
		// 5xx Server Errors
		{ code: 500, name: 'Internal Server Error', description: 'Generic server-side error', category: '5xx' },
		{ code: 501, name: 'Not Implemented', description: 'Server does not support the request method', category: '5xx' },
		{ code: 502, name: 'Bad Gateway', description: 'Server acting as gateway received invalid response', category: '5xx' },
		{ code: 503, name: 'Service Unavailable', description: 'Server temporarily unable to handle request', category: '5xx' },
		{ code: 504, name: 'Gateway Timeout', description: 'Gateway did not receive timely response', category: '5xx' },
		{ code: 505, name: 'HTTP Version Not Supported', description: 'HTTP version not supported', category: '5xx' },
		{ code: 506, name: 'Variant Also Negotiates', description: 'Circular reference in content negotiation', category: '5xx' },
		{ code: 507, name: 'Insufficient Storage', description: 'Server unable to store representation', category: '5xx' },
		{ code: 508, name: 'Loop Detected', description: 'Server detected infinite loop processing request', category: '5xx' },
		{ code: 510, name: 'Not Extended', description: 'Further extensions required for request', category: '5xx' },
		{ code: 511, name: 'Network Auth Required', description: 'Network authentication required', category: '5xx' }
	];

	const CATEGORIES = [
		{ id: 'all', name: 'All', color: 'bg-gray-500' },
		{ id: '1xx', name: '1xx Info', color: 'bg-blue-500' },
		{ id: '2xx', name: '2xx Success', color: 'bg-green-500' },
		{ id: '3xx', name: '3xx Redirect', color: 'bg-yellow-500' },
		{ id: '4xx', name: '4xx Client', color: 'bg-orange-500' },
		{ id: '5xx', name: '5xx Server', color: 'bg-red-500' }
	];

	let searchQuery = '';
	let selectedCategory = 'all';
	let copiedCode: number | null = null;
	let expandedCode: number | null = null;

	$: filteredCodes = STATUS_CODES.filter((code) => {
		const matchesCategory = selectedCategory === 'all' || code.category === selectedCategory;
		const matchesSearch =
			searchQuery === '' ||
			code.code.toString().includes(searchQuery) ||
			code.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
			code.description.toLowerCase().includes(searchQuery.toLowerCase());
		return matchesCategory && matchesSearch;
	});

	function getCategoryColor(category: string): string {
		const cat = CATEGORIES.find((c) => c.id === category);
		return cat?.color ?? 'bg-gray-500';
	}

	function getCategoryTextColor(category: string): string {
		switch (category) {
			case '1xx':
				return 'text-blue-400';
			case '2xx':
				return 'text-green-400';
			case '3xx':
				return 'text-yellow-400';
			case '4xx':
				return 'text-orange-400';
			case '5xx':
				return 'text-red-400';
			default:
				return 'text-gray-400';
		}
	}

	async function copyToClipboard(code: number) {
		try {
			await navigator.clipboard.writeText(code.toString());
			copiedCode = code;
			setTimeout(() => {
				copiedCode = null;
			}, 2000);
		} catch (err) {
			console.error('Failed to copy:', err);
		}
	}

	function toggleExpand(code: number) {
		expandedCode = expandedCode === code ? null : code;
	}

	function handleKeydown(event: KeyboardEvent, code: number) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			toggleExpand(code);
		}
	}
</script>

<div class="flex h-full flex-col bg-gray-900 text-gray-100">
	<!-- Header -->
	<div class="flex items-center justify-between border-b border-gray-700 p-3">
		<div class="flex items-center gap-2">
			<svg class="h-5 w-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
				/>
			</svg>
			<h2 class="text-sm font-semibold">HTTP Status Codes</h2>
		</div>
		<span class="rounded bg-gray-700 px-2 py-0.5 text-xs text-gray-300">
			{filteredCodes.length} codes
		</span>
	</div>

	<!-- Search -->
	<div class="border-b border-gray-700 p-3">
		<div class="relative">
			<svg
				class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
				fill="none"
				stroke="currentColor"
				viewBox="0 0 24 24"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
				/>
			</svg>
			<input
				type="text"
				bind:value={searchQuery}
				placeholder="Search by code, name, or description..."
				class="w-full rounded-lg border border-gray-600 bg-gray-800 py-2 pl-10 pr-4 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
			/>
		</div>
	</div>

	<!-- Category Filters -->
	<div class="flex flex-wrap gap-2 border-b border-gray-700 p-3">
		{#each CATEGORIES as category}
			<button
				class="rounded-full px-3 py-1 text-xs font-medium transition-colors
					{selectedCategory === category.id
					? `${category.color} text-white`
					: 'bg-gray-700 text-gray-300 hover:bg-gray-600'}"
				on:click={() => (selectedCategory = category.id)}
			>
				{category.name}
			</button>
		{/each}
	</div>

	<!-- Status Code List -->
	<div class="flex-1 overflow-y-auto p-3">
		{#if filteredCodes.length === 0}
			<div class="flex flex-col items-center justify-center py-8 text-gray-400">
				<svg class="mb-2 h-12 w-12 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
					/>
				</svg>
				<p class="text-sm">No status codes found</p>
			</div>
		{:else}
			<div class="space-y-2">
				{#each filteredCodes as status}
					<div
						class="group rounded-lg border border-gray-700 bg-gray-800 transition-colors hover:border-gray-600"
					>
						<div
							class="flex cursor-pointer items-center gap-3 p-3"
							role="button"
							tabindex="0"
							on:click={() => toggleExpand(status.code)}
							on:keydown={(e) => handleKeydown(e, status.code)}
						>
							<!-- Status Code Badge -->
							<div
								class="flex h-10 w-16 shrink-0 items-center justify-center rounded-md {getCategoryColor(
									status.category
								)}"
							>
								<span class="text-sm font-bold text-white">{status.code}</span>
							</div>

							<!-- Name and Description -->
							<div class="min-w-0 flex-1">
								<div class="flex items-center gap-2">
									<span class="font-medium {getCategoryTextColor(status.category)}">
										{status.name}
									</span>
								</div>
								<p class="mt-0.5 truncate text-xs text-gray-400">
									{status.description}
								</p>
							</div>

							<!-- Actions -->
							<div class="flex shrink-0 items-center gap-2">
								<button
									class="rounded p-1.5 text-gray-400 transition-colors hover:bg-gray-700 hover:text-white"
									title="Copy code"
									on:click|stopPropagation={() => copyToClipboard(status.code)}
								>
									{#if copiedCode === status.code}
										<svg class="h-4 w-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M5 13l4 4L19 7"
											/>
										</svg>
									{:else}
										<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
											/>
										</svg>
									{/if}
								</button>
								<svg
									class="h-4 w-4 text-gray-400 transition-transform {expandedCode === status.code
										? 'rotate-180'
										: ''}"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
								</svg>
							</div>
						</div>

						<!-- Expanded Details -->
						{#if expandedCode === status.code}
							<div class="border-t border-gray-700 bg-gray-850 p-3">
								<div class="space-y-2 text-sm">
									<div class="flex items-start gap-2">
										<span class="shrink-0 font-medium text-gray-400">Category:</span>
										<span class={getCategoryTextColor(status.category)}>
											{status.category === '1xx' && 'Informational'}
											{status.category === '2xx' && 'Success'}
											{status.category === '3xx' && 'Redirection'}
											{status.category === '4xx' && 'Client Error'}
											{status.category === '5xx' && 'Server Error'}
										</span>
									</div>
									<div class="flex items-start gap-2">
										<span class="shrink-0 font-medium text-gray-400">Description:</span>
										<span class="text-gray-200">{status.description}</span>
									</div>
									<div class="flex items-start gap-2">
										<span class="shrink-0 font-medium text-gray-400">Common Use:</span>
										<span class="text-gray-200">
											{#if status.code === 200}
												Standard response for successful HTTP requests
											{:else if status.code === 201}
												Successful POST request that created a new resource
											{:else if status.code === 204}
												Successful DELETE request with no response body
											{:else if status.code === 301}
												SEO-friendly permanent URL redirect
											{:else if status.code === 302}
												Temporary redirect, often for login flows
											{:else if status.code === 304}
												Cache validation, resource unchanged
											{:else if status.code === 400}
												Invalid request syntax or parameters
											{:else if status.code === 401}
												Missing or invalid authentication token
											{:else if status.code === 403}
												User authenticated but lacks permission
											{:else if status.code === 404}
												Resource doesn't exist at the URL
											{:else if status.code === 405}
												Wrong HTTP method for the endpoint
											{:else if status.code === 409}
												Concurrent modification conflict
											{:else if status.code === 422}
												Validation errors on request body
											{:else if status.code === 429}
												Rate limit exceeded, retry later
											{:else if status.code === 500}
												Unhandled server exception
											{:else if status.code === 502}
												Upstream server returned invalid response
											{:else if status.code === 503}
												Server overloaded or in maintenance
											{:else if status.code === 504}
												Upstream server timeout
											{:else}
												See HTTP specification for details
											{/if}
										</span>
									</div>
								</div>
							</div>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	</div>

	<!-- Footer -->
	<div class="border-t border-gray-700 bg-gray-800 px-3 py-2">
		<p class="text-center text-xs text-gray-500">
			Click a status code to expand details • Click copy icon to copy code
		</p>
	</div>
</div>

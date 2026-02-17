/**
 * Keyboard Navigation Utilities for Accessibility (WCAG 2.1.1)
 * 
 * Provides utilities for implementing keyboard navigation in lists,
 * menus, grids, and other interactive components.
 */

export type NavigationDirection = 'up' | 'down' | 'left' | 'right' | 'home' | 'end';

export interface KeyboardNavigationOptions {
	/** Whether navigation wraps around at boundaries */
	wrap?: boolean;
	/** Callback when an item is selected (Enter/Space) */
	onSelect?: (index: number) => void;
	/** Callback when navigation changes focused item */
	onNavigate?: (index: number, direction: NavigationDirection) => void;
	/** Callback when Escape is pressed */
	onEscape?: () => void;
	/** Whether to enable grid navigation (left/right in addition to up/down) */
	gridNavigation?: boolean;
	/** Number of columns for grid navigation */
	gridColumns?: number;
	/** Selector for focusable items within the container */
	itemSelector?: string;
}

/**
 * Handles keyboard navigation within a list or grid of items.
 * Returns true if the event was handled and should prevent default.
 */
export function handleListKeyboard(
	event: KeyboardEvent,
	currentIndex: number,
	itemCount: number,
	options: KeyboardNavigationOptions = {}
): { handled: boolean; newIndex: number } {
	const {
		wrap = true,
		onSelect,
		onNavigate,
		onEscape,
		gridNavigation = false,
		gridColumns = 1
	} = options;

	let newIndex = currentIndex;
	let handled = false;

	switch (event.key) {
		case 'ArrowUp':
			if (gridNavigation) {
				newIndex = currentIndex - gridColumns;
				if (newIndex < 0) {
					newIndex = wrap ? itemCount + newIndex : currentIndex;
				}
			} else {
				newIndex = currentIndex - 1;
				if (newIndex < 0) {
					newIndex = wrap ? itemCount - 1 : 0;
				}
			}
			handled = true;
			onNavigate?.(newIndex, 'up');
			break;

		case 'ArrowDown':
			if (gridNavigation) {
				newIndex = currentIndex + gridColumns;
				if (newIndex >= itemCount) {
					newIndex = wrap ? newIndex - itemCount : currentIndex;
				}
			} else {
				newIndex = currentIndex + 1;
				if (newIndex >= itemCount) {
					newIndex = wrap ? 0 : itemCount - 1;
				}
			}
			handled = true;
			onNavigate?.(newIndex, 'down');
			break;

		case 'ArrowLeft':
			if (gridNavigation) {
				newIndex = currentIndex - 1;
				if (newIndex < 0 || (currentIndex % gridColumns === 0)) {
					newIndex = wrap ? (currentIndex === 0 ? itemCount - 1 : currentIndex - 1) : currentIndex;
				}
				handled = true;
				onNavigate?.(newIndex, 'left');
			}
			break;

		case 'ArrowRight':
			if (gridNavigation) {
				newIndex = currentIndex + 1;
				if (newIndex >= itemCount || ((currentIndex + 1) % gridColumns === 0)) {
					newIndex = wrap ? (currentIndex === itemCount - 1 ? 0 : currentIndex + 1) : currentIndex;
				}
				handled = true;
				onNavigate?.(newIndex, 'right');
			}
			break;

		case 'Home':
			newIndex = 0;
			handled = true;
			onNavigate?.(newIndex, 'home');
			break;

		case 'End':
			newIndex = itemCount - 1;
			handled = true;
			onNavigate?.(newIndex, 'end');
			break;

		case 'Enter':
		case ' ':
			if (currentIndex >= 0 && currentIndex < itemCount) {
				onSelect?.(currentIndex);
				handled = true;
			}
			break;

		case 'Escape':
			onEscape?.();
			handled = true;
			break;
	}

	if (handled) {
		event.preventDefault();
		event.stopPropagation();
	}

	return { handled, newIndex: Math.max(0, Math.min(newIndex, itemCount - 1)) };
}

/**
 * Svelte action for roving tabindex navigation.
 * Makes only the currently focused item tabbable.
 */
export function rovingTabindex(node: HTMLElement, options: KeyboardNavigationOptions = {}) {
	const { itemSelector = '[role="option"], [role="menuitem"], [role="tab"], button' } = options;
	let currentIndex = 0;

	function getItems(): HTMLElement[] {
		return Array.from(node.querySelectorAll<HTMLElement>(itemSelector));
	}

	function updateTabindex(index: number) {
		const items = getItems();
		items.forEach((item, i) => {
			item.setAttribute('tabindex', i === index ? '0' : '-1');
		});
		currentIndex = index;
	}

	function focusItem(index: number) {
		const items = getItems();
		if (items[index]) {
			items[index].focus();
			updateTabindex(index);
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		const items = getItems();
		if (items.length === 0) return;

		const { handled, newIndex } = handleListKeyboard(event, currentIndex, items.length, {
			...options,
			onNavigate: (idx) => {
				focusItem(idx);
				options.onNavigate?.(idx, 'down');
			},
			onSelect: (idx) => {
				const items = getItems();
				items[idx]?.click();
				options.onSelect?.(idx);
			}
		});

		if (handled && newIndex !== currentIndex) {
			focusItem(newIndex);
		}
	}

	function handleFocus(event: FocusEvent) {
		const items = getItems();
		const target = event.target as HTMLElement;
		const index = items.indexOf(target);
		if (index !== -1) {
			updateTabindex(index);
		}
	}

	// Initialize
	updateTabindex(0);

	node.addEventListener('keydown', handleKeydown);
	node.addEventListener('focusin', handleFocus);

	return {
		update(newOptions: KeyboardNavigationOptions) {
			Object.assign(options, newOptions);
		},
		destroy() {
			node.removeEventListener('keydown', handleKeydown);
			node.removeEventListener('focusin', handleFocus);
		}
	};
}

/**
 * Focus trap for modals and dialogs.
 * Keeps focus within the specified container.
 */
export function focusTrap(node: HTMLElement) {
	const focusableSelector =
		'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), ' +
		'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

	function getFocusableElements(): HTMLElement[] {
		return Array.from(node.querySelectorAll<HTMLElement>(focusableSelector));
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key !== 'Tab') return;

		const focusable = getFocusableElements();
		if (focusable.length === 0) return;

		const first = focusable[0];
		const last = focusable[focusable.length - 1];

		if (event.shiftKey && document.activeElement === first) {
			event.preventDefault();
			last.focus();
		} else if (!event.shiftKey && document.activeElement === last) {
			event.preventDefault();
			first.focus();
		}
	}

	// Focus first focusable element on mount
	const focusable = getFocusableElements();
	if (focusable.length > 0) {
		focusable[0].focus();
	}

	node.addEventListener('keydown', handleKeydown);

	return {
		destroy() {
			node.removeEventListener('keydown', handleKeydown);
		}
	};
}

/**
 * Type-ahead search for lists.
 * Allows users to type to quickly navigate to items.
 */
export function typeAhead(
	node: HTMLElement,
	options: {
		itemSelector?: string;
		textSelector?: string;
		onMatch?: (index: number, element: HTMLElement) => void;
	} = {}
) {
	const { itemSelector = '[role="option"]', textSelector = '', onMatch } = options;
	let searchString = '';
	let searchTimeout: ReturnType<typeof setTimeout>;

	function getItems(): HTMLElement[] {
		return Array.from(node.querySelectorAll<HTMLElement>(itemSelector));
	}

	function getItemText(item: HTMLElement): string {
		if (textSelector) {
			const textEl = item.querySelector(textSelector);
			return textEl?.textContent?.toLowerCase() || '';
		}
		return item.textContent?.toLowerCase() || '';
	}

	function handleKeydown(event: KeyboardEvent) {
		// Only handle printable characters
		if (event.key.length !== 1 || event.ctrlKey || event.altKey || event.metaKey) {
			return;
		}

		// Clear timeout and append character
		clearTimeout(searchTimeout);
		searchString += event.key.toLowerCase();

		// Find matching item
		const items = getItems();
		const matchIndex = items.findIndex((item) =>
			getItemText(item).startsWith(searchString)
		);

		if (matchIndex !== -1) {
			onMatch?.(matchIndex, items[matchIndex]);
		}

		// Clear search string after delay
		searchTimeout = setTimeout(() => {
			searchString = '';
		}, 500);
	}

	node.addEventListener('keydown', handleKeydown);

	return {
		destroy() {
			node.removeEventListener('keydown', handleKeydown);
			clearTimeout(searchTimeout);
		}
	};
}

/**
 * Announces a message to screen readers.
 */
export function announce(message: string, priority: 'polite' | 'assertive' = 'polite') {
	const announcer = document.createElement('div');
	announcer.setAttribute('role', 'status');
	announcer.setAttribute('aria-live', priority);
	announcer.setAttribute('aria-atomic', 'true');
	announcer.className = 'sr-only';
	announcer.textContent = message;
	
	document.body.appendChild(announcer);
	
	setTimeout(() => {
		document.body.removeChild(announcer);
	}, 1000);
}

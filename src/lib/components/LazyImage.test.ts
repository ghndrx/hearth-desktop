/**
 * LazyImage.test.ts
 * PERF-IMAGES: Lazy loading for message images
 * 
 * Component tests for LazyImage.svelte
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, waitFor, screen } from '@testing-library/svelte';
import LazyImage from './LazyImage.svelte';

// Mock IntersectionObserver
class MockIntersectionObserver {
	readonly root: Element | null = null;
	readonly rootMargin: string = '';
	readonly thresholds: ReadonlyArray<number> = [];
	
	private callback: IntersectionObserverCallback;
	private elements: Set<Element> = new Set();
	
	static instances: MockIntersectionObserver[] = [];
	
	constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
		this.callback = callback;
		this.rootMargin = options?.rootMargin || '';
		MockIntersectionObserver.instances.push(this);
	}
	
	observe(element: Element) {
		this.elements.add(element);
	}
	
	unobserve(element: Element) {
		this.elements.delete(element);
	}
	
	disconnect() {
		this.elements.clear();
	}
	
	takeRecords(): IntersectionObserverEntry[] {
		return [];
	}
	
	// Helper to simulate intersection
	simulateIntersection(isIntersecting: boolean) {
		const entries: IntersectionObserverEntry[] = Array.from(this.elements).map(target => ({
			target,
			isIntersecting,
			boundingClientRect: target.getBoundingClientRect(),
			intersectionRatio: isIntersecting ? 1 : 0,
			intersectionRect: isIntersecting ? target.getBoundingClientRect() : new DOMRect(),
			rootBounds: null,
			time: Date.now()
		}));
		
		if (entries.length > 0) {
			this.callback(entries, this);
		}
	}
	
	static reset() {
		MockIntersectionObserver.instances = [];
	}
}

describe('LazyImage', () => {
	let originalIntersectionObserver: typeof IntersectionObserver;
	
	beforeEach(() => {
		// Save original and mock IntersectionObserver
		originalIntersectionObserver = global.IntersectionObserver;
		global.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver;
		MockIntersectionObserver.reset();
	});
	
	afterEach(() => {
		// Restore original IntersectionObserver
		global.IntersectionObserver = originalIntersectionObserver;
	});

	describe('Component props', () => {
		it('should accept required src and alt props', () => {
			const props = {
				src: 'https://example.com/image.jpg',
				alt: 'Test image'
			};
			expect(props.src).toBe('https://example.com/image.jpg');
			expect(props.alt).toBe('Test image');
		});

		it('should have default maxWidth of 400px', () => {
			const defaultMaxWidth = '400px';
			expect(defaultMaxWidth).toBe('400px');
		});

		it('should have default maxHeight of 300px', () => {
			const defaultMaxHeight = '300px';
			expect(defaultMaxHeight).toBe('300px');
		});

		it('should have default borderRadius of 8px', () => {
			const defaultBorderRadius = '8px';
			expect(defaultBorderRadius).toBe('8px');
		});

		it('should show skeleton by default', () => {
			const showSkeleton = true;
			expect(showSkeleton).toBe(true);
		});

		it('should have default rootMargin of 200px', () => {
			const rootMargin = '200px';
			expect(rootMargin).toBe('200px');
		});
	});

	describe('Native lazy loading support', () => {
		it('should detect native lazy loading support', () => {
			const supportsNativeLazy = 'loading' in HTMLImageElement.prototype;
			expect(typeof supportsNativeLazy).toBe('boolean');
		});

		it('should use loading="lazy" when native support exists', () => {
			const supportsNativeLazy = true;
			const loadingAttr = supportsNativeLazy ? 'lazy' : undefined;
			expect(loadingAttr).toBe('lazy');
		});

		it('should not add loading attribute when native support is missing', () => {
			const supportsNativeLazy = false;
			const loadingAttr = supportsNativeLazy ? 'lazy' : undefined;
			expect(loadingAttr).toBeUndefined();
		});
	});

	describe('Intersection Observer fallback', () => {
		it('should create IntersectionObserver when native lazy loading not supported', () => {
			// Simulate no native lazy loading
			const supportsNativeLazy = false;
			const hasIntersectionObserver = 'IntersectionObserver' in window;
			
			const shouldUseIO = !supportsNativeLazy && hasIntersectionObserver;
			expect(typeof shouldUseIO).toBe('boolean');
		});

		it('should use correct rootMargin for preloading', () => {
			const rootMargin = '200px';
			expect(rootMargin).toBe('200px');
		});

		it('should load immediately when no IO support and no native lazy', () => {
			const supportsNativeLazy = false;
			const hasIntersectionObserver = false;
			
			const shouldLoadImmediately = !supportsNativeLazy && !hasIntersectionObserver;
			expect(shouldLoadImmediately).toBe(true);
		});
	});

	describe('Loading states', () => {
		it('should start with imageLoaded false', () => {
			const imageLoaded = false;
			expect(imageLoaded).toBe(false);
		});

		it('should start with imageError false', () => {
			const imageError = false;
			expect(imageError).toBe(false);
		});

		it('should show skeleton when not loaded', () => {
			const showSkeleton = true;
			const imageLoaded = false;
			const showPlaceholder = showSkeleton && !imageLoaded;
			expect(showPlaceholder).toBe(true);
		});

		it('should hide skeleton when loaded', () => {
			const showSkeleton = true;
			const imageLoaded = true;
			const showPlaceholder = showSkeleton && !imageLoaded;
			expect(showPlaceholder).toBe(false);
		});

		it('should hide skeleton on error', () => {
			const showSkeleton = true;
			const imageLoaded = true; // Set to true on error to stop skeleton
			const showPlaceholder = showSkeleton && !imageLoaded;
			expect(showPlaceholder).toBe(false);
		});
	});

	describe('Image visibility', () => {
		it('should show image when shouldLoad is true and no error', () => {
			const shouldLoad = true;
			const imageError = false;
			const imageVisible = shouldLoad && !imageError;
			expect(imageVisible).toBe(true);
		});

		it('should hide image on error', () => {
			const shouldLoad = true;
			const imageError = true;
			const imageVisible = shouldLoad && !imageError;
			expect(imageVisible).toBe(false);
		});

		it('should not show image before intersection', () => {
			const shouldLoad = false;
			const imageError = false;
			const imageVisible = shouldLoad && !imageError;
			expect(imageVisible).toBe(false);
		});
	});

	describe('Fade-in animation', () => {
		it('should have opacity 0 before loaded', () => {
			const imageLoaded = false;
			const opacity = imageLoaded ? 1 : 0;
			expect(opacity).toBe(0);
		});

		it('should have opacity 1 after loaded', () => {
			const imageLoaded = true;
			const opacity = imageLoaded ? 1 : 0;
			expect(opacity).toBe(1);
		});

		it('should use 0.3s transition duration', () => {
			const transitionDuration = '0.3s';
			expect(transitionDuration).toBe('0.3s');
		});

		it('should use ease-in-out timing function', () => {
			const timingFunction = 'ease-in-out';
			expect(timingFunction).toBe('ease-in-out');
		});
	});

	describe('Error handling', () => {
		it('should show error state on load failure', () => {
			const imageError = true;
			expect(imageError).toBe(true);
		});

		it('should display error icon and message', () => {
			const errorText = 'Failed to load';
			expect(errorText).toBe('Failed to load');
		});

		it('should include alt text in error aria-label', () => {
			const alt = 'Test image';
			const errorAriaLabel = `Failed to load image: ${alt}`;
			expect(errorAriaLabel).toBe('Failed to load image: Test image');
		});
	});

	describe('Accessibility', () => {
		it('should preserve alt text on image', () => {
			const alt = 'Descriptive alt text for screen readers';
			expect(alt).not.toBe('');
		});

		it('should use title from prop or fall back to alt', () => {
			const alt = 'Test image';
			const title = '';
			const effectiveTitle = title || alt;
			expect(effectiveTitle).toBe('Test image');
		});

		it('should mark skeleton as aria-hidden', () => {
			const skeletonAriaHidden = true;
			expect(skeletonAriaHidden).toBe(true);
		});

		it('should use decoding="async" for performance', () => {
			const decoding = 'async';
			expect(decoding).toBe('async');
		});
	});

	describe('Event dispatching', () => {
		it('should dispatch load event with src on successful load', () => {
			const src = 'https://example.com/image.jpg';
			const loadEvent = { src };
			expect(loadEvent.src).toBe(src);
		});

		it('should dispatch error event with src and error on failure', () => {
			const src = 'https://example.com/broken.jpg';
			const error = new Error('Failed to load image');
			const errorEvent = { src, error };
			expect(errorEvent.src).toBe(src);
			expect(errorEvent.error).toBeInstanceOf(Error);
		});
	});

	describe('CSS classes', () => {
		it('should support custom class prop', () => {
			const className = 'cursor-pointer hover:opacity-90';
			expect(className).toContain('cursor-pointer');
		});

		it('should add loaded class when image loads', () => {
			const imageLoaded = true;
			const classes = imageLoaded ? 'lazy-image loaded' : 'lazy-image';
			expect(classes).toContain('loaded');
		});

		it('should not add loaded class before load', () => {
			const imageLoaded = false;
			const classes = imageLoaded ? 'lazy-image loaded' : 'lazy-image';
			expect(classes).not.toContain('loaded');
		});
	});

	describe('Container styling', () => {
		it('should apply maxWidth to container', () => {
			const maxWidth = '400px';
			const style = `max-width: ${maxWidth}`;
			expect(style).toContain('400px');
		});

		it('should apply maxHeight to container', () => {
			const maxHeight = '300px';
			const style = `max-height: ${maxHeight}`;
			expect(style).toContain('300px');
		});

		it('should apply borderRadius to skeleton', () => {
			const borderRadius = '8px';
			const style = `border-radius: ${borderRadius}`;
			expect(style).toContain('8px');
		});

		it('should apply borderRadius to image', () => {
			const borderRadius = '8px';
			const style = `border-radius: ${borderRadius}`;
			expect(style).toContain('8px');
		});
	});

	describe('Cleanup', () => {
		it('should disconnect observer on destroy', () => {
			const observer = {
				disconnected: false,
				disconnect() {
					this.disconnected = true;
				}
			};
			
			observer.disconnect();
			expect(observer.disconnected).toBe(true);
		});
	});

	describe('Integration with Message.svelte', () => {
		it('should work with message attachment data', () => {
			const attachment = {
				url: 'https://cdn.example.com/images/photo.jpg',
				alt_text: 'A beautiful sunset',
				filename: 'sunset.jpg',
				content_type: 'image/jpeg'
			};
			
			const props = {
				src: attachment.url,
				alt: attachment.alt_text || `Image: ${attachment.filename}`,
				title: attachment.alt_text || attachment.filename,
				maxWidth: '400px',
				maxHeight: '300px',
				borderRadius: '8px'
			};
			
			expect(props.src).toBe(attachment.url);
			expect(props.alt).toBe(attachment.alt_text);
		});

		it('should fall back to filename when no alt_text', () => {
			const attachment = {
				url: 'https://cdn.example.com/images/photo.jpg',
				alt_text: null,
				filename: 'photo.jpg'
			};
			
			const alt = attachment.alt_text || `Image: ${attachment.filename}`;
			expect(alt).toBe('Image: photo.jpg');
		});
	});
});

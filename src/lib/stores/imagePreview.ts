import { writable } from 'svelte/store';

export interface ImagePreviewState {
  isOpen: boolean;
  src: string;
  alt: string;
  filename: string;
}

const initialState: ImagePreviewState = {
  isOpen: false,
  src: '',
  alt: '',
  filename: '',
};

function createImagePreviewStore() {
  const { subscribe, set, update } = writable<ImagePreviewState>(initialState);

  return {
    subscribe,

    /**
     * Open the image preview modal
     */
    open(options: { src: string; alt?: string; filename?: string }) {
      set({
        isOpen: true,
        src: options.src,
        alt: options.alt || '',
        filename: options.filename || 'image',
      });
    },

    /**
     * Close the image preview modal
     */
    close() {
      update((state) => ({
        ...state,
        isOpen: false,
      }));
    },

    /**
     * Reset to initial state
     */
    reset() {
      set(initialState);
    },
  };
}

export const imagePreviewStore = createImagePreviewStore();

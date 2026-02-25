/**
 * Onboarding Store
 * 
 * Tracks onboarding completion state and progress.
 * Persists to localStorage to remember returning users.
 */

import { writable, derived } from 'svelte/store';

export interface OnboardingState {
    completed: boolean;
    currentStep: number;
    completedSteps: string[];
    preferences: {
        theme?: 'system' | 'light' | 'dark';
        notifications?: boolean;
        soundAlerts?: boolean;
        autoLaunch?: boolean;
        minimizeToTray?: boolean;
    };
    skippedAt?: string;
    completedAt?: string;
}

const STORAGE_KEY = 'hearth-onboarding';

const defaultState: OnboardingState = {
    completed: false,
    currentStep: 0,
    completedSteps: [],
    preferences: {},
};

function loadState(): OnboardingState {
    if (typeof window === 'undefined') return defaultState;
    
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            return { ...defaultState, ...JSON.parse(saved) };
        }
    } catch (e) {
        console.warn('Failed to load onboarding state:', e);
    }
    return defaultState;
}

function saveState(state: OnboardingState): void {
    if (typeof window === 'undefined') return;
    
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
        console.warn('Failed to save onboarding state:', e);
    }
}

function createOnboardingStore() {
    const { subscribe, set, update } = writable<OnboardingState>(loadState());
    
    return {
        subscribe,
        
        /**
         * Move to the next step
         */
        nextStep: () => {
            update(state => {
                const newState = {
                    ...state,
                    currentStep: state.currentStep + 1,
                };
                saveState(newState);
                return newState;
            });
        },
        
        /**
         * Move to the previous step
         */
        prevStep: () => {
            update(state => {
                const newState = {
                    ...state,
                    currentStep: Math.max(0, state.currentStep - 1),
                };
                saveState(newState);
                return newState;
            });
        },
        
        /**
         * Go to a specific step
         */
        goToStep: (step: number) => {
            update(state => {
                const newState = { ...state, currentStep: step };
                saveState(newState);
                return newState;
            });
        },
        
        /**
         * Mark a step as completed
         */
        completeStep: (stepId: string) => {
            update(state => {
                const completedSteps = state.completedSteps.includes(stepId)
                    ? state.completedSteps
                    : [...state.completedSteps, stepId];
                const newState = { ...state, completedSteps };
                saveState(newState);
                return newState;
            });
        },
        
        /**
         * Update preferences from onboarding
         */
        setPreference: <K extends keyof OnboardingState['preferences']>(
            key: K,
            value: OnboardingState['preferences'][K]
        ) => {
            update(state => {
                const newState = {
                    ...state,
                    preferences: { ...state.preferences, [key]: value },
                };
                saveState(newState);
                return newState;
            });
        },
        
        /**
         * Mark onboarding as complete
         */
        complete: () => {
            update(state => {
                const newState = {
                    ...state,
                    completed: true,
                    completedAt: new Date().toISOString(),
                };
                saveState(newState);
                return newState;
            });
        },
        
        /**
         * Skip onboarding
         */
        skip: () => {
            update(state => {
                const newState = {
                    ...state,
                    completed: true,
                    skippedAt: new Date().toISOString(),
                };
                saveState(newState);
                return newState;
            });
        },
        
        /**
         * Reset onboarding (for testing/debugging)
         */
        reset: () => {
            const newState = { ...defaultState };
            saveState(newState);
            set(newState);
        },
        
        /**
         * Check if this is a fresh install
         */
        isFreshInstall: (): boolean => {
            const state = loadState();
            return !state.completed && !state.skippedAt;
        },
    };
}

export const onboarding = createOnboardingStore();

// Derived stores for convenience
export const isOnboardingComplete = derived(
    onboarding,
    $onboarding => $onboarding.completed
);

export const currentOnboardingStep = derived(
    onboarding,
    $onboarding => $onboarding.currentStep
);

export const onboardingPreferences = derived(
    onboarding,
    $onboarding => $onboarding.preferences
);

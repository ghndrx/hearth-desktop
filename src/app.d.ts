// See https://kit.svelte.dev/docs/types#app
// for information about these interfaces
declare global {
	namespace App {
		interface Error {
			message: string;
			code?: string;
		}
		interface Locals {
			user?: {
				id: string;
				username: string;
				email: string;
			};
		}
		// eslint-disable-next-line @typescript-eslint/no-empty-object-type
		interface PageData {}
		// eslint-disable-next-line @typescript-eslint/no-empty-object-type
		interface PageState {}
		// eslint-disable-next-line @typescript-eslint/no-empty-object-type
		interface Platform {}
	}
}

export {};

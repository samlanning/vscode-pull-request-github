/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';
import { Event, Disposable } from 'vscode';
import { sep } from 'path';
import * as moment from 'moment';

export function uniqBy<T>(arr: T[], fn: (el: T) => string): T[] {
	const seen = Object.create(null);

	return arr.filter(el => {
		const key = fn(el);

		if (seen[key]) {
			return false;
		}

		seen[key] = true;
		return true;
	});
}

export function dispose<T extends Disposable>(disposables: T[]): T[] {
	disposables.forEach(d => d.dispose());
	return [];
}

export function toDisposable(d: () => void): Disposable {
	return { dispose: d };
}

export function combinedDisposable(disposables: Disposable[]): Disposable {
	return toDisposable(() => dispose(disposables));
}

export function anyEvent<T>(...events: Event<T>[]): Event<T> {
	return (listener, thisArgs = null, disposables?) => {
		const result = combinedDisposable(events.map(event => event(i => listener.call(thisArgs, i))));

		if (disposables) {
			disposables.push(result);
		}

		return result;
	};
}

export function filterEvent<T>(event: Event<T>, filter: (e: T) => boolean): Event<T> {
	return (listener, thisArgs = null, disposables?) => event(e => filter(e) && listener.call(thisArgs, e), null, disposables);
}

export function onceEvent<T>(event: Event<T>): Event<T> {
	return (listener, thisArgs = null, disposables?) => {
		const result = event(e => {
			result.dispose();
			return listener.call(thisArgs, e);
		}, null, disposables);

		return result;
	};
}

function isWindowsPath(path: string): boolean {
	return /^[a-zA-Z]:\\/.test(path);
}

export function isDescendant(parent: string, descendant: string): boolean {
	if (parent === descendant) {
		return true;
	}

	if (parent.charAt(parent.length - 1) !== sep) {
		parent += sep;
	}

	// Windows is case insensitive
	if (isWindowsPath(parent)) {
		parent = parent.toLowerCase();
		descendant = descendant.toLowerCase();
	}

	return descendant.startsWith(parent);
}

export function groupBy<T>(arr: T[], fn: (el: T) => string): { [key: string]: T[] } {
	return arr.reduce((result, el) => {
		const key = fn(el);
		result[key] = [...(result[key] || []), el];
		return result;
	}, Object.create(null));
}

export function formatError(e: any): string {
	if (!(e instanceof Error)) {
		if (typeof e === 'string') {
			return e;
		}

		if (e.gitErrorCode) {
			// known git errors, we should display detailed git error messages.
			return e.message + '. Please check git output for more details';
		}
		return 'Error';
	}

	try {
		let errorMessage = e.message;

		const message = JSON.parse(e.message);
		if (message) {
			errorMessage = message.message;

			const furtherInfo = message.errors && message.errors.map((error: any) => {
				if (typeof error === 'string') {
					return error;
				} else {
					return error.message;
				}
			}).join(', ');
			if (furtherInfo) {
				errorMessage = `${errorMessage}: ${furtherInfo}`;
			}
		}

		return errorMessage;
	} catch (_) {
		return e.message;
	}
}

export interface PromiseAdapter<T, U> {
	(
		value: T,
		resolve:
			(value?: U | PromiseLike<U>) => void,
		reject:
			(reason: any) => void
	): any;
}

const passthrough = (value: any, resolve: (value?: any) => void) => resolve(value);

/**
 * Return a promise that resolves with the next emitted event, or with some future
 * event as decided by an adapter.
 *
 * If specified, the adapter is a function that will be called with
 * `(event, resolve, reject)`. It will be called once per event until it resolves or
 * rejects.
 *
 * The default adapter is the passthrough function `(value, resolve) => resolve(value)`.
 *
 * @param {Event<T>} event the event
 * @param {PromiseAdapter<T, U>?} adapter controls resolution of the returned promise
 * @returns {Promise<U>} a promise that resolves or rejects as specified by the adapter
 */
export async function promiseFromEvent<T, U>(
	event: Event<T>,
	adapter: PromiseAdapter<T, U> = passthrough): Promise<U> {
	let subscription: Disposable;
	return new Promise<U>((resolve, reject) =>
		subscription = event((value: T) => {
			try {
				Promise.resolve(adapter(value, resolve, reject))
					.catch(reject);
			} catch(error) {
				reject(error);
			}
		})
	).then(
		(result: U) => {
			subscription.dispose();
			return result;
		},
		error => {
			subscription.dispose();
			throw error;
		}
	);
}

export function dateFromNow(date: Date | string): string {
	const duration = moment.duration(moment().diff(date));

	if (duration.asMonths() < 1) {
		return moment(date).fromNow();
	} else if (duration.asYears() < 1) {
		return 'on ' + moment(date).format('MMM D');
	} else {
		return 'on ' + moment(date).format('MMM D, YYYY');
	}
}
export interface Predicate<T> {
	(input: T): boolean;
}

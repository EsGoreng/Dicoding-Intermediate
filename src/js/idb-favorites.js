const DB_NAME = 'stories-app-db';
const DB_VERSION = 1;
const STORE_NAME = 'favorites';

function openDB() {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, DB_VERSION);

		request.onerror = () => {
			reject(new Error(`Database failed to open: ${request.error}`));
		};

		request.onupgradeneeded = (event) => {
			const db = event.target.result;
			if (!db.objectStoreNames.contains(STORE_NAME)) {
				db.createObjectStore(STORE_NAME, { keyPath: 'id' });
			}
		};

		request.onsuccess = () => {
			resolve(request.result);
		};
	});
}

export async function saveFavorite(storyData) {
	try {
		const db = await openDB();
		return new Promise((resolve, reject) => {
			const transaction = db.transaction(STORE_NAME, 'readwrite');
			const store = transaction.objectStore(STORE_NAME);
			const request = store.put({
				id: storyData.id,
				title: storyData.title,
				description: storyData.description,
				photoUrl: storyData.photoUrl,
				createdAt: storyData.createdAt,
				author: storyData.author,
				savedAt: new Date().toISOString()
			});

			transaction.oncomplete = () => {
				resolve(true);
			};

			transaction.onerror = () => {
				reject(new Error(`Failed to save favorite: ${transaction.error}`));
			};

			request.onerror = () => {
				reject(new Error(`Put request failed: ${request.error}`));
			};
		});
	} catch (error) {
		console.error('Error saving favorite:', error);
		throw error;
	}
}

export async function deleteFavorite(storyId) {
	try {
		const db = await openDB();
		return new Promise((resolve, reject) => {
			const transaction = db.transaction(STORE_NAME, 'readwrite');
			const store = transaction.objectStore(STORE_NAME);
			const request = store.delete(storyId);

			transaction.oncomplete = () => {
				resolve(true);
			};

			transaction.onerror = () => {
				reject(new Error(`Failed to delete favorite: ${transaction.error}`));
			};

			request.onerror = () => {
				reject(new Error(`Delete request failed: ${request.error}`));
			};
		});
	} catch (error) {
		console.error('Error deleting favorite:', error);
		throw error;
	}
}

export async function getAllFavorites() {
	try {
		const db = await openDB();
		return new Promise((resolve, reject) => {
			const transaction = db.transaction(STORE_NAME, 'readonly');
			const store = transaction.objectStore(STORE_NAME);
			const request = store.getAll();

			request.onsuccess = () => {
				resolve(request.result || []);
			};

			request.onerror = () => {
				reject(new Error(`Get all request failed: ${request.error}`));
			};
		});
	} catch (error) {
		console.error('Error getting favorites:', error);
		throw error;
	}
}

export async function getFavorite(storyId) {
	try {
		const db = await openDB();
		return new Promise((resolve, reject) => {
			const transaction = db.transaction(STORE_NAME, 'readonly');
			const store = transaction.objectStore(STORE_NAME);
			const request = store.get(storyId);

			request.onsuccess = () => {
				resolve(request.result || null);
			};

			request.onerror = () => {
				reject(new Error(`Get request failed: ${request.error}`));
			};
		});
	} catch (error) {
		console.error('Error getting favorite:', error);
		throw error;
	}
}

export async function isFavorited(storyId) {
	const favorite = await getFavorite(storyId);
	return favorite !== null && favorite !== undefined;
}

(function () {
	if ('serviceWorker' in navigator) {
		navigator.serviceWorker.register('/sw.js').catch((err) => {
			console.warn('SW registration failed:', err);
		});
	}

	let deferredPrompt = null;
	window.addEventListener('beforeinstallprompt', (e) => {
		e.preventDefault();
		deferredPrompt = e;
		// inject Install button if not present
		if (!document.getElementById('btn-install')) {
			const btn = document.createElement('button');
			btn.id = 'btn-install';
			btn.textContent = '⬇️ Install App';
			btn.style.cssText = 'position:fixed;right:16px;bottom:80px;z-index:9999;padding:8px 12px;background:#1976d2;color:white;border:none;border-radius:4px;cursor:pointer;';
			document.body.appendChild(btn);
			btn.addEventListener('click', async () => {
				btn.disabled = true;
				if (deferredPrompt) {
					deferredPrompt.prompt();
					await deferredPrompt.userChoice;
					deferredPrompt = null;
					btn.remove();
				}
			});
		}
	});

	// inject enable notification button
	if (!document.getElementById('btn-enable-notif')) {
		const nbtn = document.createElement('button');
		nbtn.id = 'btn-enable-notif';
		nbtn.textContent = '🔔 Enable Notifications';
		nbtn.style.cssText = 'position:fixed;left:16px;bottom:16px;z-index:9999;padding:8px 12px;background:#4caf50;color:white;border:none;border-radius:4px;cursor:pointer;';
		document.body.appendChild(nbtn);
		nbtn.addEventListener('click', async () => {
			if (!('Notification' in window)) {
				alert('Notifications not supported');
				return;
			}
			const perm = await Notification.requestPermission();
			if (perm === 'granted') {
				const reg = await navigator.serviceWorker.getRegistration();
				if (reg) {
					reg.showNotification('Notifications Enabled', {
						body: 'You will receive updates about new stories',
						icon: '/icons/icon-192.png',
						badge: '/icons/icon-72.png'
					});
					nbtn.textContent = '✓ Notifications On';
					nbtn.disabled = true;
				}
			}
		});
	}
})();
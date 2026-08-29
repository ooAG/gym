// GYM OS Service Worker
// Handles push notifications and basic caching

const CACHE_NAME = "gymOS-v1";
const STATIC_ASSETS = ["/", "/manifest.json"];

// ─── Install ─────────────────────────────────────────────

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// ─── Activate ────────────────────────────────────────────

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// ─── Fetch (network-first with cache fallback) ──────────

self.addEventListener("fetch", (event) => {
  // Skip non-GET requests
  if (event.request.method !== "GET") return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache successful responses
        if (response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

// ─── Notification Scheduling ─────────────────────────────
// We use a simple setInterval approach since Background Sync / Periodic Sync
// has limited browser support. The SW stays alive as long as the app is
// added to the home screen.

let notifInterval = null;

function startNotificationScheduler() {
  if (notifInterval) return;

  // Check every 30 minutes
  notifInterval = setInterval(() => {
    checkAndNotify();
  }, 30 * 60 * 1000);

  // Also check immediately
  checkAndNotify();
}

async function checkAndNotify() {
  try {
    // Get current day and time in IST
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const ist = new Date(now.getTime() + istOffset + now.getTimezoneOffset() * 60000);

    const day = ist.getDay(); // 0 = Sunday
    const hour = ist.getHours();

    // Skip Sundays
    if (day === 0) return;

    // Only notify between 7 AM and 10 PM IST
    if (hour < 7 || hour >= 22) return;

    // Check if we already notified this hour
    const lastNotifKey = `gymOS_lastNotif_${ist.toDateString()}_${hour}`;
    const clients = await self.clients.matchAll({ type: "window" });

    // Don't notify if the app is currently open and visible
    if (clients.some((client) => client.visibilityState === "visible")) return;

    // Show the notification
    const workoutType = "your workout"; // Default
    const messages = [
      `🏋️ Bhai, gym ja! ${workoutType} is waiting.`,
      `💪 Time to hit the gym! Don't skip today.`,
      `🔥 Your muscles won't grow by themselves. Let's go!`,
      `⚡ Cult.Fit is waiting for you. Get moving!`,
      `🎯 No excuses today. Push Pull Legs, repeat.`,
      `💯 Champions train when they don't feel like it.`,
    ];

    const message = messages[Math.floor(Math.random() * messages.length)];

    await self.registration.showNotification("GYM OS", {
      body: message,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: "gym-reminder",
      renotify: true,
      vibrate: [200, 100, 200],
      actions: [
        { action: "open", title: "Open App" },
        { action: "dismiss", title: "Later" },
      ],
    });
  } catch (err) {
    console.error("Notification error:", err);
  }
}

// Start scheduler when SW activates
self.addEventListener("activate", () => {
  startNotificationScheduler();
});

// Handle notification clicks
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  if (event.action === "dismiss") return;

  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clients) => {
      // Focus existing window if available
      for (const client of clients) {
        if (client.url.includes(self.location.origin)) {
          return client.focus();
        }
      }
      // Otherwise open new window
      return self.clients.openWindow("/");
    })
  );
});

// Listen for messages from the main app
self.addEventListener("message", (event) => {
  if (event.data?.type === "START_NOTIFICATIONS") {
    startNotificationScheduler();
  }

  if (event.data?.type === "WORKOUT_LOGGED") {
    // User logged a workout today, skip further notifications
    if (notifInterval) {
      clearInterval(notifInterval);
      notifInterval = null;
    }
  }
});

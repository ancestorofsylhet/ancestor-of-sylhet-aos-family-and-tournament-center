let aosInstallPrompt = null;
let aosInstallCompleted = false;
const aosInstallButton = () => document.getElementById("installAppBtn");
const aosIsInstalled = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  window.navigator.standalone === true;

function aosSetInstallButton() {
  const button = aosInstallButton();
  if (!button) return;
  button.hidden = false;
  if (aosIsInstalled() || aosInstallCompleted) {
    button.textContent = "✓ AOS App Installed";
    button.disabled = true;
    button.setAttribute("aria-label", "AOS App is installed");
  } else {
    button.disabled = false;
  }
}

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  aosInstallPrompt = event;
  const button = aosInstallButton();
  if (button && !aosIsInstalled()) {
    button.textContent = "⬇ Install AOS App";
    button.disabled = false;
  }
});

window.addEventListener("appinstalled", () => {
  aosInstallCompleted = true;
  aosInstallPrompt = null;
  aosSetInstallButton();
  alert("AOS App successfully installed. You can now open it from your phone's app list.");
});

window.installAOSApp = async function () {
  if (aosIsInstalled() || aosInstallCompleted) {
    alert("AOS App is already installed on this device.");
    return;
  }
  if (aosInstallPrompt) {
    const promptEvent = aosInstallPrompt;
    aosInstallPrompt = null;
    const button = aosInstallButton();
    try {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      if (choice && choice.outcome === "accepted") {
        if (button) button.textContent = "Install request accepted — checking…";
        window.setTimeout(() => {
          if (!aosInstallCompleted && !aosIsInstalled()) {
            if (button) button.textContent = "Install not confirmed";
            alert("Chrome accepted the install request, but the app installation was not confirmed. Open this website directly in Google Chrome (not an in-app browser), then Chrome ⋮ menu → Install app. If you already see AOS in your App Drawer, open it once.");
          } else {
            aosSetInstallButton();
          }
        }, 12000);
      } else {
        if (button) button.textContent = "⬇ Install AOS App";
      }
    } catch (error) {
      console.warn("AOS install prompt failed:", error);
      if (button) button.textContent = "⬇ Install AOS App";
      alert("AOS App could not be installed from this browser. Open the website in Google Chrome and use ⋮ → Install app.");
    }
    return;
  }
  const ua = navigator.userAgent || "";
  const isIOS = /iphone|ipad|ipod/i.test(ua);
  const isAndroid = /android/i.test(ua);
  if (isIOS) {
    alert("iPhone/iPad: Open in Safari → Share → Add to Home Screen → Add.");
  } else if (isAndroid) {
    alert("Open this website directly in Google Chrome. Then tap ⋮ → Install app. If Install app is not shown, try ⋮ → Add to Home screen.");
  } else {
    alert("Open the browser menu and select Install AOS Tournament Center.");
  }
};

aosSetInstallButton();
window.addEventListener("load", aosSetInstallButton);
window.addEventListener("pageshow", aosSetInstallButton);

if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js", { updateViaCache: "none" })
      .then(registration => registration.update().catch(() => {}))
      .catch(error => console.warn("AOS service worker registration failed:", error));
  });
}

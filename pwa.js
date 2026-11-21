let aosInstallPrompt = null;
const aosInstallButton = () => document.getElementById("installAppBtn");
const aosIsInstalled = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  window.navigator.standalone === true;

function aosSetInstallButton() {
  const button = aosInstallButton();
  if (!button) return;
  button.hidden = false;
  if (aosIsInstalled()) {
    button.textContent = "✓ AOS App Installed";
    button.disabled = true;
    button.setAttribute("aria-label", "AOS App is installed");
  }
}

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  aosInstallPrompt = event;
  aosSetInstallButton();
  const button = aosInstallButton();
  if (button && !aosIsInstalled()) {
    button.textContent = "⬇ Install AOS App";
    button.disabled = false;
  }
});

window.addEventListener("appinstalled", () => {
  aosInstallPrompt = null;
  aosSetInstallButton();
});

window.installAOSApp = async function () {
  if (aosIsInstalled()) {
    alert("AOS App is already installed on this device.");
    return;
  }
  if (aosInstallPrompt) {
    const promptEvent = aosInstallPrompt;
    aosInstallPrompt = null;
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    const button = aosInstallButton();
    if (button && choice && choice.outcome === "accepted") {
      button.textContent = "✓ Installing AOS App";
    }
    return;
  }
  const ua = navigator.userAgent || "";
  const isIOS = /iphone|ipad|ipod/i.test(ua);
  const isAndroid = /android/i.test(ua);
  if (isIOS) {
    alert("iPhone/iPad: Safari-তে Share বাটন চাপুন → Add to Home Screen → Add নির্বাচন করুন।");
  } else if (isAndroid) {
    alert("Android: Chrome-এর ⋮ Menu খুলুন → Install app নির্বাচন করুন। Install না দেখালে Add to Home screen চাপুন।");
  } else {
    alert("Browser menu খুলে Install AOS Tournament Center নির্বাচন করুন।");
  }
};

aosSetInstallButton();
window.addEventListener("load", aosSetInstallButton);

if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js", { updateViaCache: "none" })
      .then(registration => registration.update().catch(() => {}))
      .catch(error => console.warn("AOS app installation support:", error));
  });
}

let aosInstallPrompt=null;
const aosInstallButton=()=>document.getElementById("installAppBtn");
window.addEventListener("beforeinstallprompt",event=>{
 event.preventDefault();
 aosInstallPrompt=event;
 const button=aosInstallButton();
 if(button)button.hidden=false;
});
window.addEventListener("appinstalled",()=>{
 aosInstallPrompt=null;
 const button=aosInstallButton();
 if(button){button.textContent="✓ App Installed";button.disabled=true;}
});
window.installAOSApp=async function(){
 if(aosInstallPrompt){
  aosInstallPrompt.prompt();
  await aosInstallPrompt.userChoice;
  aosInstallPrompt=null;
  return;
 }
 const isIOS=/iphone|ipad|ipod/i.test(navigator.userAgent);
 alert(isIOS
  ?"iPhone/iPad: Safari-তে Share বাটন চাপুন, তারপর “Add to Home Screen” নির্বাচন করুন।"
  :"Chrome/Android: Browser-এর ⋮ Menu খুলে “Install app” অথবা “Add to Home screen” নির্বাচন করুন।");
};
if("serviceWorker" in navigator && (location.protocol==="https:"||location.hostname==="localhost")){
 window.addEventListener("load",()=>navigator.serviceWorker.register("./service-worker.js").catch(error=>console.warn("AOS offline support:",error)));
}
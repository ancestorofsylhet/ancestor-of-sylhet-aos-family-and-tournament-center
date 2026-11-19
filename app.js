
/* AOS Tournament Center — Supabase client application */
const cfg=window.AOS_CONFIG||{};
const ready=!!(cfg.SUPABASE_URL&&cfg.SUPABASE_ANON_KEY&&!cfg.SUPABASE_URL.includes("YOUR_")&&!cfg.SUPABASE_ANON_KEY.includes("YOUR_"));
const db=ready?window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY):null;
let session=null,me=null,role="player",tournaments=[],teams=[],players=[],matches=[],standings=[],auctionPlayers=[],auctionBids=[],champions=[],auctionTeams=[];
let myParticipation=[];
let myTournamentRegs=[];
let currentTournamentCard=null;
let playerMatchStats=[];
let managementMembers=[];
let managementTableReady=false;
let editingManagementId="";
let awardTab="motm";
let teamMembers=[];
let selectedTournamentId="";
let tournamentDetailTab="overview";
let selectedTournamentTeams=[];
let memberTournamentId="";
let memberTeamId="";let auctionTournamentId = "";let auctionTournamentSettings=null,auctionTeamSettings=[],auctionRoom=null,auctionChatMessages=[],auctionRealtimeChannel=null,auctionCallTimer=null,auctionCallAdvancing=false;
const $=id=>document.getElementById(id), msg=(s,type="notice")=>{$("globalMsg").innerHTML=`<div class="notice ${type}">${esc(s)}</div>`;setTimeout(()=>{$("globalMsg").innerHTML=""},6500)};
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function toggleAOSSidebar(force){const side=$("aosSidebar"),shade=$("sidebarShade");if(!side||!shade)return;const open=typeof force==="boolean"?force:!side.classList.contains("open");side.classList.toggle("open",open);shade.classList.toggle("show",open);$("sidebarMenuBtn")?.setAttribute("aria-expanded",String(open));}function go(id){document.querySelectorAll(".page").forEach(x=>x.classList.add("hidden"));const page=$(id);if(!page)return;page.classList.remove("hidden");document.querySelectorAll(".bottom button,.top-nav button,.sidebar-link").forEach(x=>x.classList.toggle("active",x.dataset.id===id));toggleAOSSidebar(false);render();window.scrollTo(0,0)}
function openAuth(){$("authModal").classList.remove("hidden")}
function closeAuth(){$("authModal").classList.add("hidden")}
async function doAuth(mode){if(!db)return msg("আগে config.js-এ Supabase URL ও anon key বসান।","error");const email=$("authEmail").value.trim(),password=$("authPass").value;if(!email||!password)return msg("Email ও Password দিন।","error");const r=mode==="login"?await db.auth.signInWithPassword({email,password}):await db.auth.signUp({email,password});if(r.error)return msg(r.error.message,"error");if(mode==="signup"&&!r.data.session){msg("Account তৈরি হয়েছে। Email verification সম্পন্ন করে Login করুন।","success");return}session=r.data.session;closeAuth();await loadAll();msg("সফলভাবে Login হয়েছে।","success")}
async function logout(){await db.auth.signOut();session=null;me=null;role="player";await loadAll()}
async function init(){if(!ready){msg("Supabase এখনো সংযুক্ত নয়। ZIP-এর SETUP_GUIDE.md অনুসরণ করে config.js তৈরি করুন।");return}const {data}=await db.auth.getSession();session=data.session;db.auth.onAuthStateChange((_e,s)=>{session=s;setTimeout(loadAll,0)});await loadAll();setupAuctionRealtime()}
async function loadAll(){if(!db)return;loadSiteLogo();const {data:{user}}=await db.auth.getUser();me=user;if(user){let p=await db.from("profiles").select("*").eq("id",user.id).maybeSingle();role=p.data?.role||"player"}else role="player";$("userLabel").textContent=user?(user.email+" · "+role):"Guest";$("authBtn").textContent=user?"Logout":"Login";$("authBtn").onclick=user?logout:openAuth;
const [t,p,tm,m,st,a,b,ch]=await Promise.all([
  db.from("tournaments").select("*").order("created_at",{ascending:false}),
  db.from("profiles").select("id,display_name,efootball_id,device,club_name,role,avatar_url,is_active").eq("is_active",true),
  db.from("teams").select("*"),
  db.from("matches").select("*,home:teams!matches_home_team_id_fkey(name),away:teams!matches_away_team_id_fkey(name)").order("round_no"),
  db.from("standings").select("*,team:teams(name)").order("points",{ascending:false}),
  db.from("auction_players").select("*,profile:profiles(display_name,efootball_id,device,avatar_url,is_active),team:teams(id,name)").order("created_at",{ascending:false}),
  db.from("auction_bids").select("*,team:teams(name)").order("created_at",{ascending:false}),
  db.from("champions").select("*").order("created_at",{ascending:false})
]);

tournaments=t.data||[];
players=p.data||[];
teams=tm.data||[];
matches=m.data||[];
standings=st.data||[];
auctionPlayers=(a.data||[]).filter(x=>x.profile?.is_active!==false);
auctionBids=b.data||[];
champions=ch.data||[];// Current player's tournament participation // Team Members Load
const {data:memberData,error:memberError}=await db
  .from("team_members")
  .select(`
    id,
    team_id,
    player_id,
    created_at,
    team:teams(id,name,logo_url,description,captain_id),
    player:profiles(display_name,efootball_id,device,club_name,avatar_url,is_active)
  `);

if(memberError){
  console.error("Team Members Load Error:",memberError);
  teamMembers=[];
}else{
  teamMembers=(memberData||[]).filter(m=>m.player?.is_active!==false);
} 
myParticipation=[];

if(me){
  const {data: participation,error: participationError}=await db
    .from("tournament_participants")
    .select("id,tournament_id,team_id,status,created_at,tournament:tournaments(name,type,status),team:teams(name)")
    .eq("profile_id",me.id)
    .order("created_at",{ascending:false});

  if(participationError){
    console.error("My participation load error:",participationError);
  }else{
    myParticipation=participation||[];
  }
} 

if(me){
 const {data:cardRegs,error:cardRegsError}=await db.from("tournament_participants").select("id,tournament_id,status,created_at,tournament:tournaments(name,type,season)").eq("profile_id",me.id).order("created_at",{ascending:false});
 if(cardRegsError){console.warn("Tournament card registrations:",cardRegsError.message);myTournamentRegs=[];}else myTournamentRegs=cardRegs||[];
}else myTournamentRegs=[];
if(b.error){
  console.error("Auction bids loading error:",b.error);
  auctionBids=[];
}
const statsResult=await db.from("player_match_stats").select("*").order("created_at",{ascending:false});
if(statsResult.error){console.warn("Player stats table not ready:",statsResult.error.message);playerMatchStats=[];}
else{playerMatchStats=statsResult.data||[];}

const managementResult=await db.from("management_members").select("*").order("display_order",{ascending:true}).order("created_at",{ascending:true});
managementTableReady=!managementResult.error;
if(managementResult.error){console.warn("Management table not ready:",managementResult.error.message);managementMembers=[];}
else{managementMembers=managementResult.data||[];}

render();
}
function requireAdmin(){if(!me||!["admin","moderator"].includes(role)){msg("এই কাজের জন্য Admin/Moderator permission প্রয়োজন।","error");return false}return true}
function requireMainAdmin(){if(!me||String(role).toLowerCase()!=="admin"){msg("Management Control Panel শুধু Main Admin ব্যবহার করতে পারবেন।","error");return false}return true}

function loadSiteLogo(){
 const img=$("siteLogo"),fallback=$("siteLogoFallback"),heroImg=$("heroSiteLogo"),heroFallback=$("heroLogoFallback");
 if(!db)return;
 const url=db.storage.from("site-assets").getPublicUrl("branding/aos-logo").data.publicUrl+"?v="+Date.now();
 if(img&&fallback){img.onload=()=>{img.classList.remove("hidden");fallback.classList.add("hidden");};img.onerror=()=>{img.classList.add("hidden");fallback.classList.remove("hidden");};img.src=url;}
 if(heroImg&&heroFallback){heroImg.onload=()=>{heroImg.classList.remove("hidden");heroFallback.classList.add("hidden");};heroImg.onerror=()=>{heroImg.classList.add("hidden");heroFallback.classList.remove("hidden");};heroImg.src=url;}
}
function previewSiteLogo(input){
 const file=input?.files?.[0],preview=$("siteLogoPreview");
 if(!preview)return;
 if(!file){preview.src="";preview.classList.add("hidden");return;}
 const allowed=["image/png","image/jpeg","image/webp","image/svg+xml"];
 if(!allowed.includes(file.type)){input.value="";return msg("PNG, JPG, WEBP বা SVG ছবি নির্বাচন করুন।","error");}
 if(file.size>5*1024*1024){input.value="";return msg("Logo-এর সাইজ 5MB-এর মধ্যে রাখুন।","error");}
 preview.src=URL.createObjectURL(file);preview.classList.remove("hidden");
}
async function uploadSiteLogo(){
 if(!requireMainAdmin())return;
 const input=$("siteLogoFile"),file=input?.files?.[0];
 if(!file)return msg("আগে Logo image নির্বাচন করুন।","error");
 const allowed=["image/png","image/jpeg","image/webp","image/svg+xml"];
 if(!allowed.includes(file.type))return msg("PNG, JPG, WEBP বা SVG ছবি নির্বাচন করুন।","error");
 if(file.size>5*1024*1024)return msg("Logo-এর সাইজ 5MB-এর মধ্যে রাখুন।","error");
 const button=$("siteLogoUploadButton");if(button){button.disabled=true;button.textContent="Uploading...";}
 const {error}=await db.storage.from("site-assets").upload("branding/aos-logo",file,{upsert:true,contentType:file.type,cacheControl:"3600"});
 if(button){button.disabled=false;button.textContent="Upload Website Logo";}
 if(error)return msg("Logo upload হয়নি: "+error.message,"error");
 input.value="";
 const preview=$("siteLogoPreview");if(preview){preview.src="";preview.classList.add("hidden");}
 loadSiteLogo();
 msg("AOS Website Logo সফলভাবে Upload হয়েছে।","success");
}
async function submitProfileEditRequest(payload){
 if(!me)throw new Error("Login প্রয়োজন।");
 const {data:old,error:findError}=await db.from("profile_edit_requests").select("id").eq("player_id",me.id).eq("status","pending").maybeSingle();
 if(findError)throw findError;
 if(old){const {error}=await db.from("profile_edit_requests").update({requested_data:payload,created_at:new Date().toISOString()}).eq("id",old.id);if(error)throw error;}
 else{const {error}=await db.from("profile_edit_requests").insert({player_id:me.id,requested_data:payload,status:"pending"});if(error)throw error;}
}
async function registerPlayer(){
 if(!me)return openAuth();
 const payload={id:me.id,display_name:$("pName").value.trim(),efootball_id:$("pEid").value.trim(),device:$("pDevice").value.trim(),club_name:$("pClub").value.trim()||"Ancestor of Sylhet"};
 if(!payload.display_name||!payload.efootball_id||!payload.device)return msg("Player Name, eFootball ID ও Device দিতে হবে।","error");
 const {data:old,error:findError}=await db.from("profiles").select("id,display_name,efootball_id,device,club_name").eq("id",me.id).maybeSingle();
 if(findError)return msg(findError.message,"error");
 if(old){
  const changed=["display_name","efootball_id","device","club_name"].some(k=>String(payload[k]||"")!==String(old[k]||""));
  if(!changed)return msg("তোমার Player Profile আগে থেকেই Registered আছে।","notice");
  try{await submitProfileEditRequest(payload);msg("Profile পরিবর্তনের অনুরোধ Main Admin-এর অনুমোদনের জন্য পাঠানো হয়েছে।","success");await loadAll();}catch(e){msg("Request submit হয়নি: "+e.message,"error");}
  return;
 }
 const {error}=await db.from("profiles").insert(payload);
 if(error)return msg(error.message,"error");
 msg("Player Registration সফল হয়েছে।","success");await loadAll();
}

function renderTournamentCardMaker(){
 const select=$("cardTournament");if(!select)return;
 const previous=select.value;
 select.innerHTML='<option value="">Select Tournament</option>'+tournaments.map(t=>'<option value="'+esc(t.id)+'">'+esc(t.name)+' · '+esc(t.type||"Tournament")+'</option>').join("");
 if(tournaments.some(t=>String(t.id)===String(previous)))select.value=previous;
 if(me){const p=players.find(x=>String(x.id)===String(me.id))||{};
  if(!$("cardPlayerName").value)$("cardPlayerName").value=p.display_name||"";
  if(!$("cardPlayerDevice").value)$("cardPlayerDevice").value=p.device||"";
  if(!$("cardPlayerEid").value)$("cardPlayerEid").value=p.efootball_id||"";
  if(!$("cardPlayerClub").value)$("cardPlayerClub").value=p.club_name||"";
 }
 const box=$("myTournamentCards");
 if(box)box.innerHTML=myTournamentRegs.map(r=>'<div class="item"><div class="grow"><b>'+esc(r.tournament?.name||"Tournament")+'</b><small>'+esc(r.tournament?.type||"Tournament")+' · '+esc(r.status||"pending")+' · '+new Date(r.created_at).toLocaleDateString()+'</small></div><button class="btn light" onclick="viewSavedTournamentCard(\''+r.tournament_id+'\')">View Card</button></div>').join("")||'<div class="empty">এখনো কোনো Tournament-এ Registration করা হয়নি।</div>';
}
async function registerTournamentCard(){
 if(!me)return openAuth();
 const tournamentId=$("cardTournament").value,name=$("cardPlayerName").value.trim(),device=$("cardPlayerDevice").value.trim(),eid=$("cardPlayerEid").value.trim(),club=$("cardPlayerClub").value.trim(),file=$("cardPlayerPhoto").files?.[0];
 if(!tournamentId||!name||!device||!eid||!club||!file)return msg("Tournament, Photo, Name, Device, User ID ও Club Name—সব তথ্য দিতে হবে।","error");
 if(!["image/png","image/jpeg","image/webp"].includes(file.type))return msg("শুধু JPG, PNG বা WEBP Photo দিন।","error");
 if(file.size>5*1024*1024)return msg("Player Photo সর্বোচ্চ 5MB হতে পারবে।","error");
 const tournament=tournaments.find(t=>String(t.id)===String(tournamentId));if(!tournament)return msg("Tournament পাওয়া যায়নি।","error");
 const button=$("cardRegisterButton");if(button){button.disabled=true;button.textContent="Registration হচ্ছে...";}
 try{
  const ext=(file.name.split(".").pop()||"jpg").toLowerCase(),path=me.id+"/tournament-card-"+Date.now()+"."+ext;
  const up=await db.storage.from("avatars").upload(path,file,{upsert:false,contentType:file.type,cacheControl:"3600"});if(up.error)throw up.error;
  const photoUrl=db.storage.from("avatars").getPublicUrl(path).data?.publicUrl;if(!photoUrl)throw new Error("Player Photo URL তৈরি হয়নি।");
  const profileData={id:me.id,display_name:name,efootball_id:eid,device,club_name:club,avatar_url:photoUrl};
  const {data:old,error:findError}=await db.from("profiles").select("id,display_name,efootball_id,device,club_name,avatar_url").eq("id",me.id).maybeSingle();
  if(findError)throw findError;
  if(!old){const ins=await db.from("profiles").insert(profileData);if(ins.error)throw ins.error;}
  else{
   const changed=["display_name","efootball_id","device","club_name","avatar_url"].some(k=>String(profileData[k]||"")!==String(old[k]||""));
   if(changed){await submitProfileEditRequest(profileData);msg("তোমার দেওয়া তথ্য বর্তমান Profile থেকে আলাদা। Main Admin অনুমোদন করলে Profile Update হবে। অনুমোদনের পর আবার Tournament Registration করবে।","notice");await loadAll();return;}
  }
  const chk=await db.from("tournament_participants").select("id").eq("tournament_id",tournamentId).eq("profile_id",me.id).maybeSingle();if(chk.error)throw chk.error;
  if(!chk.data){const ins=await db.from("tournament_participants").insert({tournament_id:tournamentId,profile_id:me.id,status:"pending"});if(ins.error)throw ins.error;}
  currentTournamentCard={tournament,display_name:name,device,efootball_id:eid,club_name:club,avatar_url:photoUrl};
  await loadAll();await showTournamentCard(currentTournamentCard);
  msg(chk.data?"তুমি এই Tournament-এ আগে থেকেই Registered।":"Tournament Registration সফল হয়েছে। Player Card তৈরি হয়েছে।","success");
 }catch(error){console.error(error);msg("Registration হয়নি: "+(error.message||"Unknown error"),"error");}
 finally{if(button){button.disabled=false;button.textContent="Register & Create Player Card";}}
}

function loadCardPhoto(url){return new Promise(resolve=>{const img=new Image();img.crossOrigin="anonymous";img.onload=()=>resolve(img);img.onerror=()=>resolve(null);img.src=url;});}
async function createTournamentCardCanvas(data){
 const canvas=document.createElement("canvas");canvas.width=1200;canvas.height=700;const x=canvas.getContext("2d"),bg=x.createLinearGradient(0,0,1200,700);
 bg.addColorStop(0,"#174b32");bg.addColorStop(.62,"#236641");bg.addColorStop(1,"#795238");x.fillStyle=bg;x.fillRect(0,0,1200,700);
 x.fillStyle="rgba(255,255,255,.08)";x.beginPath();x.arc(1120,80,260,0,Math.PI*2);x.fill();x.fillStyle="#d5a638";x.fillRect(0,0,1200,14);
 x.fillStyle="#fff";x.font="bold 34px Arial";x.fillText("ANCESTOR OF SYLHET",60,82);x.fillStyle="#f2d17a";x.font="bold 23px Arial";x.fillText("OFFICIAL TOURNAMENT REGISTRATION",60,122);
 x.fillStyle="#fff";x.font="bold 48px Arial";x.fillText(String(data.tournament?.name||"TOURNAMENT").slice(0,30),60,202);x.fillStyle="#f2d17a";x.font="bold 25px Arial";x.fillText("PLAYER REGISTRATION CARD",60,248);
 x.fillStyle="rgba(255,255,255,.12)";x.fillRect(55,285,1090,330);const photo=await loadCardPhoto(data.avatar_url);
 if(photo){x.save();x.beginPath();x.roundRect(90,330,270,270,22);x.clip();const scale=Math.max(270/photo.width,270/photo.height),w=photo.width*scale,h=photo.height*scale;x.drawImage(photo,90+(270-w)/2,330+(270-h)/2,w,h);x.restore();}
 else{x.fillStyle="#fff";x.font="bold 90px Arial";x.fillText(String(data.display_name||"P")[0].toUpperCase(),190,495);}
 const left=410;x.fillStyle="#f2d17a";x.font="bold 20px Arial";x.fillText("PLAYER NAME",left,352);x.fillStyle="#fff";x.font="bold 40px Arial";x.fillText(String(data.display_name||"").slice(0,28),left,400);
 [["DEVICE",data.device],["eFOOTBALL USER ID",data.efootball_id],["CLUB NAME",data.club_name]].forEach((d,i)=>{const y=465+i*58;x.fillStyle="#f2d17a";x.font="bold 17px Arial";x.fillText(d[0],left,y);x.fillStyle="#fff";x.font="bold 25px Arial";x.fillText(String(d[1]||"").slice(0,35),left+260,y);});
 x.fillStyle="#fff";x.font="bold 20px Arial";x.fillText("AOS TOURNAMENT CENTER",60,665);x.fillStyle="#f2d17a";x.textAlign="right";x.fillText(String(data.tournament?.season||"PLAY • COMPETE • ACHIEVE"),1140,665);x.textAlign="left";return canvas;
}
async function showTournamentCard(data){currentTournamentCard=data;const box=$("tournamentCardResult"),img=$("tournamentCardPreview");if(!box||!img)return;const canvas=await createTournamentCardCanvas(data);img.src=canvas.toDataURL("image/png");box.classList.remove("hidden");}
async function downloadTournamentCard(){if(!currentTournamentCard)return msg("আগে Registration করে Card তৈরি করুন।","error");const canvas=await createTournamentCardCanvas(currentTournamentCard),link=document.createElement("a");link.download="AOS-Tournament-Card.png";link.href=canvas.toDataURL("image/png");link.click();}
async function shareTournamentCard(){
 if(!currentTournamentCard)return msg("আগে Registration করে Card তৈরি করুন।","error");
 const canvas=await createTournamentCardCanvas(currentTournamentCard),blob=await new Promise(resolve=>canvas.toBlob(resolve,"image/png"));if(!blob)return msg("Card image তৈরি করা যায়নি।","error");
 const file=new File([blob],"AOS-Tournament-Card.png",{type:"image/png"});
 if(navigator.share&&navigator.canShare?.({files:[file]})){try{await navigator.share({title:"AOS Tournament Registration Card",text:currentTournamentCard.tournament?.name||"AOS Tournament",files:[file]});}catch(error){if(error.name!=="AbortError")msg("Share করা যায়নি। Download করে Share করুন।","error");}}
 else{await downloadTournamentCard();msg("এই Browser-এ direct Share নেই। Card Download হয়েছে—এখন Share করতে পারবেন।","notice");}
}
async function viewSavedTournamentCard(tournamentId){
 if(!me)return openAuth();const tournament=tournaments.find(t=>String(t.id)===String(tournamentId)),p=players.find(x=>String(x.id)===String(me.id));
 if(!tournament||!p?.display_name||!p?.device||!p?.efootball_id||!p?.club_name||!p?.avatar_url)return msg("Card তৈরি করতে Profile-এর সব তথ্য ও Photo সম্পূর্ণ থাকতে হবে।","error");
 await showTournamentCard({tournament:tournament,display_name:p.display_name,device:p.device,efootball_id:p.efootball_id,club_name:p.club_name,avatar_url:p.avatar_url});$("tournamentCardResult").scrollIntoView({behavior:"smooth",block:"start"});
}

async function createTournament(){if(!requireAdmin())return;let x={name:$("tName").value.trim(),type:$("tType").value,season:$("tSeason").value,entry_fee:Number($("tFee").value||0),max_participants:Number($("tMax").value||16),status:$("tStatus").value,created_by:me.id};if(!x.name)return msg("Tournament name দিন।","error");let r=await db.from("tournaments").insert(x);if(r.error)return msg(r.error.message,"error");msg("Tournament তৈরি হয়েছে।","success");await loadAll()}
async function createTeam() {
  if (!requireAdmin()) return;

  const tournamentId = $("teamTournament").value;
  const name = $("teamName").value.trim();
  const captainId = $("captainId").value.trim() || null;

  if (!tournamentId) {
    return msg("Tournament নির্বাচন করুন।", "error");
  }

  if (!name) {
    return msg("Team Name দিন।", "error");
  }

  // এই Tournament-এ একই নামে Team আছে কি না যাচাই
  const { data: assigned, error: checkError } = await db
    .from("tournament_teams")
    .select("team:teams!inner(name)")
    .eq("tournament_id", tournamentId);

  if (checkError) return msg(checkError.message, "error");

  const duplicate = (assigned || []).some(row =>
    String(row.team?.name || "").trim().toLowerCase() === name.toLowerCase()
  );

  if (duplicate) {
    return msg("এই Tournament-এ এই Team Name আগে থেকেই আছে।", "error");
  }

  // নতুন Team তৈরি
  const { data: team, error } = await db
    .from("teams")
    .insert({
      name,
      captain_id: captainId
    })
    .select("id")
    .single();

  if (error) return msg(error.message, "error");

  // Tournament-এর সঙ্গে Team যুক্ত
  const { error: assignError } = await db
    .from("tournament_teams")
    .insert({
      tournament_id: tournamentId,
      team_id: team.id
    });

  if (assignError) {
    return msg(
      "Team তৈরি হয়েছে, কিন্তু Tournament-এ যুক্ত হয়নি: " + assignError.message,
      "error"
    );
  }

  $("teamName").value = "";
  $("captainId").value = "";

  msg("Team সফলভাবে তৈরি ও Tournament-এ যুক্ত হয়েছে।", "success");

  await loadAll();
}

function setupAuctionTournamentSelect() {
  const profileInput = $("auctionProfile");
  if (!profileInput) return;

  let select = $("auctionTournament");

  if (!select) {
    select = document.createElement("select");
    select.id = "auctionTournament";
    select.className = profileInput.className || "";

    const field = document.createElement("div");
    field.className = "field full";

    const label = document.createElement("label");
    label.textContent = "Auction Tournament";

    field.appendChild(label);
    field.appendChild(select);

    const profileField = profileInput.closest(".field") || profileInput;
    if (profileField.parentElement) {
      profileField.parentElement.insertBefore(field, profileField);
    }

    select.addEventListener("change", async function () {
      auctionTournamentId = this.value;
      await loadAuctionTeams(this.value);
    });
  }

  const previous = auctionTournamentId;
  select.innerHTML =
    '<option value="">Select Auction Tournament</option>' +
    tournaments.map(t =>
      `<option value="${esc(t.id)}">${esc(t.name)}</option>`
    ).join("");

  if (tournaments.some(t => String(t.id) === String(previous))) {
    select.value = previous;
  } else {
    select.value = "";
    auctionTournamentId = "";
    auctionTeams = [];
  }
}

// AUCTION ARENA — IPL STYLE TEAM AUCTION
function setupAuctionArenaTournamentSelect() {
  const list = $("auctionList");
  if (!list || !list.parentElement) return;
  let selectorCard = $("auctionSelectorCard");
  if (!selectorCard) {
    selectorCard = document.createElement("div");
    selectorCard.id = "auctionSelectorCard";
    selectorCard.className = "card";
    selectorCard.style.marginBottom = "14px";
    selectorCard.innerHTML = '<div class="head" style="margin:0 0 10px"><h3>AOS Auction Arena</h3><span class="pill gold">LIVE AUCTION</span></div><p class="muted">শুধু Auction Tournament নির্বাচন করুন। Captain/Manager নির্ধারিত Team-এর হয়ে Bid করতে পারবেন।</p><select id="auctionArenaTournament"><option value="">Select Auction Tournament</option></select>';
    list.parentElement.insertBefore(selectorCard, list);
    $("auctionArenaTournament").addEventListener("change", async function () {
      auctionTournamentId = this.value;
      await loadAuctionTeams(this.value);
    });
  }
  let panel = $("auctionControlPanel");
  if (!panel) {
    panel = document.createElement("div");
    panel.id = "auctionControlPanel";
    panel.className = "card";
    panel.style.marginBottom = "14px";
    selectorCard.insertAdjacentElement("afterend", panel);
  }
  let publicPanel = $("auctionTeamsPublic");
  if (!publicPanel) {
    publicPanel = document.createElement("div");
    publicPanel.id = "auctionTeamsPublic";
    publicPanel.className = "card";
    publicPanel.style.marginBottom = "14px";
    panel.insertAdjacentElement("afterend", publicPanel);
  }
  let chatPanel = $("auctionChatPanel");
  if (!chatPanel) {
    chatPanel = document.createElement("div");
    chatPanel.id = "auctionChatPanel";
    chatPanel.className = "card";
    chatPanel.style.marginBottom = "14px";
    publicPanel.insertAdjacentElement("afterend", chatPanel);
  }
  const listParent = list.parentElement;
  if (panel.parentElement !== listParent) listParent.insertBefore(panel, list);
  if (publicPanel.parentElement !== listParent) listParent.insertBefore(publicPanel, list);
  if (chatPanel.parentElement !== listParent) listParent.insertBefore(chatPanel, list);

  const select = $("auctionArenaTournament");
  const auctionOnly = tournaments.filter(t => String(t.type || "").toLowerCase().includes("auction"));
  select.innerHTML = '<option value="">Select Auction Tournament</option>' + auctionOnly.map(t => `<option value="${esc(t.id)}">${esc(t.name)} · ${esc(t.season || "")}</option>`).join("");
  if (auctionOnly.some(t => String(t.id) === String(auctionTournamentId))) select.value = auctionTournamentId;
  else { select.value = ""; if (auctionTournamentId) { auctionTournamentId = ""; auctionTeams = []; auctionTournamentSettings = null; auctionTeamSettings = []; auctionRoom = null; } }
}

async function loadAuctionArenaData(tournamentId) {
  if (!tournamentId) return;
  const [settings,teamSettings,room,chat] = await Promise.all([
    db.from("auction_tournament_settings").select("*").eq("tournament_id",tournamentId).maybeSingle(),
    db.from("auction_team_settings").select("*,team:teams(id,name,logo_url,captain_id)").eq("tournament_id",tournamentId),
    db.from("auction_room_state").select("*").eq("tournament_id",tournamentId).maybeSingle(),
    db.from("auction_chat_messages").select("*,sender:profiles(display_name,avatar_url)").eq("tournament_id",tournamentId).order("created_at",{ascending:false}).limit(40)
  ]);
  auctionTournamentSettings = settings.data || null;
  auctionTeamSettings = teamSettings.data || [];
  auctionRoom = room.data || null;
  auctionChatMessages = (chat.data || []).reverse();
  if (settings.error) console.warn("Auction settings:",settings.error.message);
  if (teamSettings.error) console.warn("Auction team settings:",teamSettings.error.message);
  if (room.error) console.warn("Auction room:",room.error.message);
  if (chat.error) console.warn("Auction chat:",chat.error.message);
}

async function loadAuctionTeams(tournamentId, shouldRender=true) {
  auctionTeams = [];
  if (!tournamentId) {
    auctionTournamentSettings=null;auctionTeamSettings=[];auctionRoom=null;auctionChatMessages=[];
    if (shouldRender) render();
    return;
  }
  const { data, error } = await db.from("tournament_teams")
    .select("team_id, team:teams(id,name,budget,logo_url,captain_id)")
    .eq("tournament_id", tournamentId);
  if (error) {
    console.error("Auction Team Load Error:", error);
    msg("Auction Team Load Error: " + error.message, "error");
  } else {
    auctionTeams = (data || []).map(row => row.team).filter(team => team && team.id);
  }
  await loadAuctionArenaData(tournamentId);
  if (shouldRender) render();
}

async function saveAuctionTournamentSettings() {
  if (!requireMainAdmin()) return;
  if (!auctionTournamentId) return msg("Auction Tournament নির্বাচন করুন।","error");
  const payload={
    tournament_id:auctionTournamentId,
    base_price:Number($("auctionBasePrice")?.value||100),
    initial_budget:Number($("auctionInitialBudget")?.value||10000),
    min_increment:Number($("auctionMinIncrement")?.value||100),
    max_squad_size:Number($("auctionMaxSquad")?.value||10),
    updated_at:new Date().toISOString()
  };
  if(payload.base_price<0||payload.initial_budget<0||payload.min_increment<=0||payload.max_squad_size<1) return msg("সঠিক Auction Settings দিন।","error");
  const {error}=await db.from("auction_tournament_settings").upsert(payload,{onConflict:"tournament_id"});
  if(error)return msg("Auction Settings Save হয়নি: "+error.message,"error");
  await loadAuctionTeams(auctionTournamentId);
  msg("Auction Tournament Settings Save হয়েছে।","success");
}

async function configureAuctionTeam(teamId) {
  if (!requireMainAdmin()) return;
  const budget=Number($("auctionBudget-"+teamId)?.value||0);
  const captainId=$("auctionCaptain-"+teamId)?.value||null;
  const managerId=$("auctionManager-"+teamId)?.value||null;
  const {error}=await db.rpc("aos_configure_auction_team",{
    p_tournament_id:auctionTournamentId,p_team_id:teamId,p_budget:budget,p_captain_id:captainId,p_manager_id:managerId
  });
  if(error)return msg("Team Auction Access Save হয়নি: "+error.message,"error");
  await loadAuctionTeams(auctionTournamentId);
  msg("Team Budget ও Captain/Manager Access Save হয়েছে।","success");
}

async function syncAuctionRegistration() {
  if (!requireMainAdmin()) return;
  if (!auctionTournamentId) return;
  const {data,error}=await db.rpc("aos_sync_auction_players",{p_tournament_id:auctionTournamentId});
  if(error)return msg("Player Sync হয়নি: "+error.message,"error");
  await loadAll();
  msg(Number(data||0)+" জন Registered Player Auction Pool-এ যুক্ত হয়েছে।","success");
}

async function startAuctionLot() {
  if (!requireAdmin()) return;
  const playerId=$("auctionLotSelect")?.value;
  if(!playerId)return msg("Auction Player নির্বাচন করুন।","error");
  const {error}=await db.rpc("aos_set_auction_current_player",{p_tournament_id:auctionTournamentId,p_auction_player_id:playerId});
  if(error)return msg("Auction Lot Start হয়নি: "+error.message,"error");
  await loadAuctionTeams(auctionTournamentId);
  msg("নতুন Auction Lot Live হয়েছে।","success");
}

async function setAuctionRoomStatus(status) {
  if (!requireAdmin()) return;
  const {error}=await db.rpc("aos_set_auction_room_status",{p_tournament_id:auctionTournamentId,p_status:status});
  if(error)return msg(error.message,"error");
  await loadAuctionTeams(auctionTournamentId);
}

async function markAuctionUnsold(playerId) {
  if (!requireAdmin()) return;
  if (!confirm("এই Player-কে Unsold হিসেবে চিহ্নিত করবেন?")) return;
  const {error}=await db.rpc("aos_mark_auction_unsold",{p_auction_player_id:playerId});
  if(error)return msg("Unsold করা যায়নি: "+error.message,"error");
  await loadAll();
  if(auctionTournamentId)await loadAuctionTeams(auctionTournamentId);
  msg("Player Unsold হিসেবে Save হয়েছে।","success");
}

async function advanceAuctionCall() {
  if(auctionCallAdvancing||!auctionTournamentId||!auctionRoom||auctionRoom.room_status!=="live"||!auctionRoom.call_deadline)return;
  if(!["admin","moderator"].includes(role))return;
  if(Date.now()<new Date(auctionRoom.call_deadline).getTime())return;
  auctionCallAdvancing=true;
  const {error}=await db.rpc("aos_advance_auction_call",{p_tournament_id:auctionTournamentId});
  auctionCallAdvancing=false;
  if(error){console.warn("Auction auto call:",error.message);return;}
  await loadAuctionArenaData(auctionTournamentId);
  render();
}

function startAuctionCallTicker() {
  if(auctionCallTimer)clearInterval(auctionCallTimer);
  auctionCallTimer=setInterval(()=>{advanceAuctionCall();},500);
}

async function sendAuctionChatMessage() {
  if(!me)return openAuth();
  const input=$("auctionChatInput"),message=(input?.value||"").trim();
  if(!message||!auctionTournamentId)return;
  const {error}=await db.from("auction_chat_messages").insert({tournament_id:auctionTournamentId,sender_id:me.id,message});
  if(error)return msg("Chat পাঠানো যায়নি: "+error.message,"error");
  input.value="";
  await loadAuctionArenaData(auctionTournamentId);
  renderAuctionChat();
}

function renderAuctionChat() {
  const panel=$("auctionChatPanel");
  if(!panel)return;
  if(!auctionTournamentId){panel.innerHTML='<h3>Auction Room Chat</h3><div class="empty">Auction Tournament নির্বাচন করুন।</div>';return;}
  panel.innerHTML='<div class="head" style="margin:0 0 10px"><h3>Live Auction Chat</h3><span class="pill">Text Chat</span><span class="pill gold">Voice Room · Setup Pending</span></div><p class="muted">লাইভ Mic/Speaker সুবিধা আলাদা Audio Service যুক্ত করার পর চালু হবে। আপাতত এই Tournament-এর Text Chat Live আছে।</p><div id="auctionChatMessages" style="max-height:230px;overflow:auto;display:grid;gap:8px;margin-bottom:12px">'+(auctionChatMessages.map(m=>'<div class="item" style="padding:9px 12px"><div class="grow"><b>'+esc(m.sender?.display_name||"Player")+'</b><small>'+esc(m.message)+'</small></div><small>'+new Date(m.created_at).toLocaleTimeString()+'</small></div>').join("")||'<div class="empty">এখনো কোনো Chat নেই।</div>')+'</div><div style="display:flex;gap:8px"><input id="auctionChatInput" maxlength="500" placeholder="Auction Room-এ message লিখুন..." style="flex:1;min-width:0"><button class="btn" onclick="sendAuctionChatMessage()">Send</button></div><p class="muted">এই Chat শুধু নির্বাচিত Auction Tournament-এর জন্য।</p>';
  const box=$("auctionChatMessages");if(box)box.scrollTop=box.scrollHeight;
}

function renderAuctionControlPanel() {
  const panel=$("auctionControlPanel"),publicPanel=$("auctionTeamsPublic");
  if(!panel||!publicPanel)return;
  if(!auctionTournamentId){panel.innerHTML='<div class="empty">Auction Tournament নির্বাচন করলে এখানে Live Auction Control ও Team Budget দেখা যাবে।</div>';publicPanel.innerHTML='<h3>Teams & Squads</h3><div class="empty">Tournament নির্বাচন করুন।</div>';renderAuctionChat();return;}
  const isMainAdmin=String(role).toLowerCase()==="admin";
  const staff=["admin","moderator"].includes(String(role).toLowerCase());
  const settings=auctionTournamentSettings||{base_price:100,initial_budget:10000,min_increment:100,max_squad_size:10};
  const playerOptions=auctionPlayers.filter(p=>String(p.tournament_id)===String(auctionTournamentId)&&p.status==="available").sort((a,b)=>(a.serial_no||0)-(b.serial_no||0)).map(p=>'<option value="'+p.id+'">'+(p.serial_no?("#"+p.serial_no+" · "):"")+esc(p.profile?.display_name||"Player")+'</option>').join("");
  const profileOptions='<option value="">Not Assigned</option>'+players.map(p=>'<option value="'+p.id+'">'+esc(p.display_name||"Player")+'</option>').join("");
  const teamConfig=auctionTeams.map(t=>{
    const cfg=auctionTeamSettings.find(x=>String(x.team_id)===String(t.id))||{};
    return '<div class="item" style="display:block"><div style="display:flex;align-items:center;gap:10px">'+(t.logo_url?'<img src="'+esc(t.logo_url)+'" style="width:42px;height:42px;object-fit:contain;border-radius:10px">':'<div class="avatar">🏆</div>')+'<div class="grow"><b>'+esc(t.name)+'</b><small>Remaining Budget: '+Number(cfg.budget_remaining??t.budget??0).toLocaleString()+' pts+'</small></div></div>'+(isMainAdmin?'<div class="form" style="margin-top:12px"><div class="field"><label>Team Budget (Virtual Points)</label><input id="auctionBudget-'+t.id+'" type="number" min="0" value="'+Number(cfg.budget_total??settings.initial_budget)+'"></div><div class="field"><label>Captain</label><select id="auctionCaptain-'+t.id+'">'+profileOptions+'</select></div><div class="field"><label>Manager</label><select id="auctionManager-'+t.id+'">'+profileOptions+'</select></div><div class="field"><button class="btn green" onclick="configureAuctionTeam(\''+t.id+'\')">Save Team Access</button></div></div>':'')+'</div>';
  }).join("");
  panel.innerHTML='<div class="head" style="margin:0 0 12px"><h3>Auction Control Center</h3><span class="pill gold">'+(auctionRoom?.room_status||"SETUP").toUpperCase()+'</span></div>'+(isMainAdmin?'<div class="card" style="background:#f8fbff;box-shadow:none;margin-bottom:12px"><h3>Tournament Auction Settings · Main Admin</h3><div class="form"><div class="field"><label>Base Price</label><input id="auctionBasePrice" type="number" min="0" value="'+Number(settings.base_price)+'"></div><div class="field"><label>Each Team Budget (Virtual Points)</label><input id="auctionInitialBudget" type="number" min="0" value="'+Number(settings.initial_budget)+'"></div><div class="field"><label>Minimum Bid Increase</label><input id="auctionMinIncrement" type="number" min="1" value="'+Number(settings.min_increment)+'"></div><div class="field"><label>Maximum Squad Size</label><input id="auctionMaxSquad" type="number" min="1" value="'+Number(settings.max_squad_size)+'"></div><div class="field full"><button class="btn green" onclick="saveAuctionTournamentSettings()">Save Auction Settings</button><button class="btn light" onclick="syncAuctionRegistration()">Sync Registered Players to Auction Pool</button></div></div></div>':'')+(isMainAdmin?'<h3>Captain / Manager & Team Budget Setup</h3><div class="list">'+(teamConfig||'<div class="empty">আগে Tournament-এ Team যুক্ত করুন।</div>')+'</div>':'')+'<div class="card" style="background:#f8fbff;box-shadow:none;margin-top:12px"><div class="head" style="margin:0 0 10px"><h3>Live Auction Lot</h3><span class="pill">'+(auctionRoom?.room_status||"Setup")+'</span></div>'+(auctionRoom?.current_player_id?'<p class="muted">Current Lot: '+esc(auctionPlayers.find(p=>String(p.id)===String(auctionRoom.current_player_id))?.profile?.display_name||"Player")+' · Call: '+(["Bidding","1","2","3","Last Call"][auctionRoom.call_stage||0])+'</p>':'<p class="muted">এখনো কোনো Player Live করা হয়নি।</p>')+(staff?'<div class="form"><div class="field"><label>Next Player</label><select id="auctionLotSelect"><option value="">Select Available Player</option>'+playerOptions+'</select></div><div class="field"><label>Room Control</label><button class="btn green" onclick="startAuctionLot()">Start Selected Player</button></div></div>'+(auctionRoom?.room_status==="live"?'<button class="btn light" onclick="setAuctionRoomStatus(\'paused\')">Pause Auction</button>':'')+(auctionRoom?.room_status==="paused"?'<button class="btn green" onclick="setAuctionRoomStatus(\'live\')">Resume Auction</button>':''):'')+'</div>';
  // Restore Captain and Manager selections after building the control form.
  auctionTeams.forEach(t=>{const cfg=auctionTeamSettings.find(x=>String(x.team_id)===String(t.id));const c=$("auctionCaptain-"+t.id),m=$("auctionManager-"+t.id);if(c)c.value=cfg?.captain_id||t.captain_id||"";if(m)m.value=cfg?.manager_id||"";});
  const currentPlayer=auctionRoom?.current_player_id?auctionPlayers.find(p=>String(p.id)===String(auctionRoom.current_player_id)):null;
  const budgetCards=auctionTeams.map(t=>{
    const cfg=auctionTeamSettings.find(x=>String(x.team_id)===String(t.id))||{};
    const squad=auctionPlayers.filter(p=>String(p.tournament_id)===String(auctionTournamentId)&&String(p.team_id)===String(t.id)&&p.status==="sold");
    return '<details class="item" style="display:block"><summary style="cursor:pointer;display:flex;align-items:center;gap:10px">'+(t.logo_url?'<img src="'+esc(t.logo_url)+'" style="width:38px;height:38px;object-fit:contain;border-radius:8px">':'<div class="avatar">🏆</div>')+'<span class="grow"><b>'+esc(t.name)+'</b><small>Budget Left: '+Number(cfg.budget_remaining??t.budget??0).toLocaleString()+' · Players: '+squad.length+'</small></span></summary><div style="margin-top:12px">'+(squad.map(p=>'<div class="item" style="padding:8px;margin-top:6px">'+(p.profile?.avatar_url?'<img src="'+esc(p.profile.avatar_url)+'" style="width:40px;height:40px;object-fit:cover;border-radius:50%">':'<div class="avatar">👤</div>')+'<div class="grow"><b>'+esc(p.profile?.display_name||"Player")+'</b><small>Sold: '+Number(p.sold_price||0).toLocaleString()+'</small></div></div>').join("")||'<small class="muted">এখনো কোনো Player কেনা হয়নি।</small>')+'</div></details>';
  }).join("");
  const soldRanking=auctionPlayers.filter(p=>String(p.tournament_id)===String(auctionTournamentId)&&p.status==="sold").sort((a,b)=>Number(b.sold_price||0)-Number(a.sold_price||0)).map((p,i)=>{const team=auctionTeams.find(t=>String(t.id)===String(p.team_id));return '<div class="item"><b>#'+(i+1)+'</b>'+(p.profile?.avatar_url?'<img src="'+esc(p.profile.avatar_url)+'" style="width:42px;height:42px;object-fit:cover;border-radius:50%">':'<div class="avatar">👤</div>')+'<div class="grow"><b>'+esc(p.profile?.display_name||"Player")+'</b><small>'+esc(team?.name||"Team")+' · Auction Serial #'+(p.serial_no||"—")+'</small></div><b>'+Number(p.sold_price||0).toLocaleString()+' pts</b></div>';}).join("");
  const budgetRank=[...auctionTeamSettings].sort((a,b)=>Number(b.budget_remaining||0)-Number(a.budget_remaining||0)).map((x,i)=>'<div class="item"><b>#'+(i+1)+'</b><div class="grow"><b>'+esc(x.team?.name||"Team")+'</b><small>Budget remaining</small></div><b>'+Number(x.budget_remaining||0).toLocaleString()+' pts</b></div>').join("");
  publicPanel.innerHTML='<div class="head" style="margin:0 0 12px"><h3>Teams, Budgets & Squads</h3><span class="pill">'+auctionTeams.length+' Teams</span></div>'+(budgetCards||'<div class="empty">এই Tournament-এ Team নেই।</div>')+'<div class="head"><h3>Player Auction Ranking</h3><span class="pill gold">Highest Sold Price</span></div>'+(soldRanking||'<div class="empty">এখনো কোনো Player Sold হয়নি।</div>')+'<div class="head"><h3>Team Budget Ranking</h3></div>'+(budgetRank||'<div class="empty">Team Budget এখনো Configure করা হয়নি।</div>');
  renderAuctionChat();
  if(auctionRoom?.call_deadline)startAuctionCallTicker();
}

function setupAuctionRealtime() {
  if(!db||auctionRealtimeChannel)return;
  auctionRealtimeChannel=db.channel("aos-auction-realtime")
    .on("postgres_changes",{event:"*",schema:"public",table:"auction_bids"},async()=>{await loadAll();if(auctionTournamentId)await loadAuctionTeams(auctionTournamentId);})
    .on("postgres_changes",{event:"*",schema:"public",table:"auction_players"},async()=>{await loadAll();if(auctionTournamentId)await loadAuctionTeams(auctionTournamentId);})
    .on("postgres_changes",{event:"*",schema:"public",table:"auction_team_settings"},async()=>{if(auctionTournamentId){await loadAuctionTeams(auctionTournamentId);}})
    .on("postgres_changes",{event:"*",schema:"public",table:"auction_room_state"},async()=>{if(auctionTournamentId){await loadAuctionTeams(auctionTournamentId);}})
    .on("postgres_changes",{event:"INSERT",schema:"public",table:"auction_chat_messages"},async()=>{if(auctionTournamentId){await loadAuctionArenaData(auctionTournamentId);renderAuctionChat();}})
    .subscribe();
}

function setupAuctionProfileSelect() {
  let select = $("auctionProfile");
  if (!select) return;

  // পুরোনো Input-কে Dropdown-এ পরিবর্তন
  if (select.tagName !== "SELECT") {
    const dropdown = document.createElement("select");
    dropdown.id = "auctionProfile";
    dropdown.className = select.className;
    dropdown.style.cssText = select.style.cssText;
    select.replaceWith(dropdown);
    select = dropdown;
  }

  const previousValue = select.value;
  select.innerHTML =
    '<option value="">Select Auction Player</option>' +
    players
      .filter(p => p.id && p.display_name)
      .map(p => `
        <option value="${esc(p.id)}">${esc(p.display_name)}</option>
      `)
      .join("");

  if (players.some(p => String(p.id) === previousValue)) {
    select.value = previousValue;
  }

  const label = select.closest(".field")?.querySelector("label");
  if (label) label.textContent = "Select Player";
}



async function buyPlayer(auctionPlayerId, teamId) {
  if (!requireAdmin()) return;

  if (!teamId) {
    return msg("আগে একটি Team নির্বাচন করুন।", "error");
  }

  if (!auctionTeams.some(team => String(team.id) === String(teamId))) {
    return msg("নির্বাচিত Team এই Tournament-এর নয়। Tournament ও Team আবার নির্বাচন করুন।", "error");
  }

  const player = auctionPlayers.find(
    a => String(a.id) === String(auctionPlayerId)
  );

  if (!player || player.status !== "available") {
    return msg("এই Player আর Available নেই।", "error");
  }

  const highestBid = auctionBids
    .filter(b => String(b.auction_player_id) === String(auctionPlayerId))
    .sort((a, b) => Number(b.amount) - Number(a.amount))[0];

  const minStep=Number(auctionTournamentSettings?.min_increment||100);
  const suggestedPrice = highestBid
    ? Number(highestBid.amount)+minStep
    : Number(player.base_price);

  const priceInput = prompt(
    "Sold Price লিখুন:",
    String(suggestedPrice)
  );

  if (priceInput === null) return;

  const price = Number(priceInput);

  if (!Number.isFinite(price) || price <= 0) {
    return msg("সঠিক Sold Price দিন।", "error");
  }

  if (!confirm("এই Player-কে নির্বাচিত Team-এ Sold করবেন?")) {
    return;
  }

  const { error } = await db.rpc("aos_buy_player", {
    p_auction_player_id: auctionPlayerId,
    p_team_id: teamId,
    p_price: price
  });

  if (error) {
    console.error("Auction Purchase Error:", error);
    return msg(error.message, "error");
  }

  // Add the purchased player to the selected team's squad.
  // Auction purchases are stored separately from the team_members table,
  // which is what the Squad views read from.
  if (!player.profile_id) {
    msg("Player Sold হয়েছে, কিন্তু Auction Player-এর profile_id পাওয়া যায়নি। Squad-এ যোগ করা যায়নি।", "error");
    await loadAll();
    return;
  }

  const { data: existingMember, error: memberCheckError } = await db
    .from("team_members")
    .select("id")
    .eq("team_id", teamId)
    .eq("player_id", player.profile_id)
    .maybeSingle();

  if (memberCheckError) {
    console.error("Squad membership check error:", memberCheckError);
    msg("Player Sold হয়েছে, কিন্তু Squad membership যাচাই করা যায়নি: " + memberCheckError.message, "error");
    await loadAll();
    return;
  }

  if (!existingMember) {
    const { error: squadError } = await db
      .from("team_members")
      .insert({
        team_id: teamId,
        player_id: player.profile_id
      });

    if (squadError) {
      console.error("Add sold player to squad error:", squadError);
      msg("Player Sold হয়েছে, কিন্তু Squad-এ যোগ করা যায়নি: " + squadError.message, "error");
      await loadAll();
      return;
    }
  }

  msg("Player সফলভাবে Sold হয়েছে এবং Team Squad-এ যুক্ত হয়েছে!", "success");

  await loadAll();
}
async function placeBid(auctionPlayerId, teamId) {
  if (!session) {
    return msg("আগে Login করুন।", "error");
  }

  if (!teamId) {
    return msg("আগে একটি Team নির্বাচন করুন।", "error");
  }

  const player = auctionPlayers.find(
    a => String(a.id) === String(auctionPlayerId)
  );

  if (!player || player.status !== "available") {
    return msg("এই Player আর Available নেই।", "error");
  }

  const bids = auctionBids.filter(
    b => String(b.auction_player_id) === String(auctionPlayerId)
  );

  const highestBid = bids.reduce(
    (max, b) => Math.max(max, Number(b.amount)),
    Number(player.base_price)
  );

  const amountInput = prompt(
    `Current Highest Bid: ${highestBid}\nআপনার Bid Amount লিখুন:`,
    String(highestBid + 100)
  );

  if (amountInput === null) return;

  const amount = Number(amountInput);

  if (!Number.isFinite(amount) || amount <= highestBid) {
    return msg("Highest Bid-এর চেয়ে বেশি Bid দিতে হবে।", "error");
  }

  const { error } = await db.rpc("aos_place_bid", {
    p_auction_player_id: auctionPlayerId,
    p_team_id: teamId,
    p_amount: amount
  });

  if (error) {
    console.error("Auction Bid Error:", error);
    return msg(error.message, "error");
  }

  msg("Bid সফলভাবে জমা হয়েছে!", "success");
  await loadAll();
}

async function generateFixtures() {
  if (!requireAdmin()) return;

  const tid = $("fixtureTournament").value;

  if (!tid) return msg("Tournament নির্বাচন করুন।", "error");

  const { data: assigned, error } = await db
    .from("tournament_teams")
    .select("team_id,team:teams(id,name)")
    .eq("tournament_id", tid);

  if (error) return msg(error.message, "error");

  const selectedTeams = (assigned || [])
    .map(x => x.team)
    .filter(Boolean);

  if (selectedTeams.length < 2) {
    return msg("এই Tournament-এ কমপক্ষে ২টি Team যুক্ত করুন।", "error");
  }

  const { data: oldMatches, error: oldError } = await db
    .from("matches")
    .select("id")
    .eq("tournament_id", tid)
    .eq("stage", "league");

  if (oldError) return msg(oldError.message, "error");

  if (oldMatches?.length) {
    return msg("এই Tournament-এর League Fixture আগে থেকেই তৈরি আছে।", "error");
  }

  const arr = [...selectedTeams];

  if (arr.length % 2 !== 0) arr.push(null);

  const rows = [];
  const totalRounds = arr.length - 1;
  const matchesPerRound = arr.length / 2;

  for (let round = 0; round < totalRounds; round++) {
    for (let i = 0; i < matchesPerRound; i++) {
      const home = arr[i];
      const away = arr[arr.length - 1 - i];

      if (!home || !away) continue;

      rows.push({
        tournament_id: tid,
        home_team_id: home.id,
        away_team_id: away.id,
        round_no: round + 1,
        stage: "league",
        status: "scheduled"
      });
    }

    arr.splice(1, 0, arr.pop());
  }

  const { error: insertError } = await db
    .from("matches")
    .insert(rows);

  if (insertError) return msg(insertError.message, "error");

  msg(`${selectedTeams.length}টি Team-এর ${rows.length}টি Fixture তৈরি হয়েছে।`, "success");

  await loadAll();
}

async function saveResult() {
  if (!requireAdmin()) return;

  const matchId = $("resultMatch").value;
  const homeScore = Number($("homeScore").value);
  const awayScore = Number($("awayScore").value);

  if (!matchId) return msg("একটি Match নির্বাচন করুন।", "error");

  if (
    !Number.isInteger(homeScore) ||
    !Number.isInteger(awayScore) ||
    homeScore < 0 ||
    awayScore < 0
  ) {
    return msg("সঠিক Score দিন।", "error");
  }

  const selectedMatch = matches.find(m => String(m.id) === String(matchId));

  if (!selectedMatch) return msg("Match পাওয়া যায়নি।", "error");

  const isKnockout = selectedMatch.stage === "knockout";

  if (isKnockout && homeScore === awayScore) {
    return msg("Knockout ম্যাচে Draw হতে পারবে না।", "error");
  }

  const winnerId = isKnockout
    ? (homeScore > awayScore
        ? selectedMatch.home_team_id
        : selectedMatch.away_team_id)
    : null;

  if (isKnockout) {
    const { data: laterMatches, error: laterError } = await db
      .from("matches")
      .select("id")
      .eq("tournament_id", selectedMatch.tournament_id)
      .eq("stage", "knockout")
      .gt("round_no", selectedMatch.round_no);

    if (laterError) return msg(laterError.message, "error");

    const { data: existingChampion, error: championError } = await db
      .from("champions")
      .select("id")
      .eq("tournament_id", selectedMatch.tournament_id)
      .maybeSingle();

    if (championError) return msg(championError.message, "error");

    if ((laterMatches && laterMatches.length) || existingChampion) {
      return msg("পরবর্তী রাউন্ড তৈরি হয়েছে। এই Result পরিবর্তন করা যাবে না।", "error");
    }

    // Knockout Result সরাসরি Save
    const { error } = await db
      .from("matches")
      .update({
        home_score: homeScore,
        away_score: awayScore,
        winner_team_id: winnerId,
        status: "completed",
        played_at: new Date().toISOString()
      })
      .eq("id", selectedMatch.id);

    if (error) {
      console.error(error);
      return msg("Winner Save Error: " + error.message, "error");
    }

  } else {
    // League Result আগের RPC দিয়েই Save
    const { error } = await db.rpc("aos_submit_match_result", {
      p_match_id: selectedMatch.id,
      p_home_score: homeScore,
      p_away_score: awayScore
    });

    if (error) {
      console.error(error);
      return msg(error.message, "error");
    }
  }

  msg("Match Result ও Winner সফলভাবে Save হয়েছে।", "success");

  await loadAll();

  if (isKnockout) {
    await advanceKnockout(
      selectedMatch.tournament_id,
      selectedMatch.round_no
    );

    await loadAll();
  }
}

async function makeBracket() {
  if (!requireAdmin()) return;

  const tid = $("bracketTournament").value;

  if (!tid) return msg("Tournament নির্বাচন করুন।", "error");

  const { data: assigned, error } = await db
    .from("tournament_teams")
    .select("team_id,team:teams(id,name)")
    .eq("tournament_id", tid);

  if (error) return msg(error.message, "error");

  const selectedTeams = (assigned || [])
    .map(x => x.team)
    .filter(Boolean);

  if (selectedTeams.length < 2) {
    return msg("কমপক্ষে ২টি Team যুক্ত করুন।", "error");
  }

  const { data: oldMatches, error: matchError } = await db
    .from("matches")
    .select("id")
    .eq("tournament_id", tid)
    .eq("stage", "knockout");

  if (matchError) return msg(matchError.message, "error");

  const { data: oldByes, error: byeCheckError } = await db
    .from("knockout_byes")
    .select("id")
    .eq("tournament_id", tid);

  if (byeCheckError) return msg(byeCheckError.message, "error");

  if (oldMatches?.length || oldByes?.length) {
    return msg("এই Tournament-এর Knockout Bracket আগে থেকেই আছে।", "error");
  }

  const count = selectedTeams.length;

  let bracketSize = 1;
  while (bracketSize < count) bracketSize *= 2;

  const byeCount = bracketSize - count;
  const byeTeams = selectedTeams.slice(0, byeCount);
  const playingTeams = selectedTeams.slice(byeCount);

  const rows = [];

  for (let i = 0; i < playingTeams.length; i += 2) {
    rows.push({
      tournament_id: tid,
      home_team_id: playingTeams[i].id,
      away_team_id: playingTeams[i + 1].id,
      round_no: 100,
      stage: "knockout",
      status: "scheduled"
    });
  }

  if (rows.length) {
    const { error } = await db.from("matches").insert(rows);
    if (error) return msg(error.message, "error");
  }

  if (byeTeams.length) {
    const { error } = await db
      .from("knockout_byes")
      .insert(
        byeTeams.map(team => ({
          tournament_id: tid,
          round_no: 100,
          team_id: team.id
        }))
      );

    if (error) return msg("BYE Error: " + error.message, "error");
  }

  msg(
    `${count}টি Team দিয়ে Knockout তৈরি হয়েছে। BYE: ${byeCount}টি।`,
    "success"
  );

  await loadAll();
}

async function advanceKnockout(tournamentId, roundNo) {
  const { data: currentRound, error } = await db
    .from("matches")
    .select("*")
    .eq("tournament_id", tournamentId)
    .eq("stage", "knockout")
    .eq("round_no", roundNo);

  if (error) return msg(error.message, "error");

  const { data: byeRows, error: byeError } = await db
    .from("knockout_byes")
    .select("*")
    .eq("tournament_id", tournamentId)
    .eq("round_no", roundNo);

  if (byeError) return msg(byeError.message, "error");

  const byes = byeRows || [];
  const playedMatches = currentRound || [];

  if (!playedMatches.length && !byes.length) return;

  // সব Match শেষ হয়েছে কি না
  const allCompleted = playedMatches.every(m =>
    m.status === "completed" && m.winner_team_id
  );

  if (!allCompleted) return;

  // Match Winner + BYE পাওয়া Team
  const entrants = [
    ...playedMatches.map(m => m.winner_team_id),
    ...byes.map(b => b.team_id)
  ];

  const uniqueEntrants = [...new Set(entrants.map(String))];

  if (uniqueEntrants.length !== entrants.length) {
    return msg("একই Team একাধিকবার পাওয়া গেছে।", "error");
  }

  // Final শেষ হলে Champion তৈরি
  if (playedMatches.length === 1 && byes.length === 0) {
    const finalMatch = playedMatches[0];
    const winnerId = finalMatch.winner_team_id;

    const runnerId =
      String(winnerId) === String(finalMatch.home_team_id)
        ? finalMatch.away_team_id
        : finalMatch.home_team_id;

    const { data: teamRows, error: teamError } = await db
      .from("teams")
      .select("id,name")
      .in("id", [winnerId, runnerId]);

    if (teamError) return msg(teamError.message, "error");

    const winner = teamRows.find(t => String(t.id) === String(winnerId));
    const runner = teamRows.find(t => String(t.id) === String(runnerId));

    const tournament = tournaments.find(
      t => String(t.id) === String(tournamentId)
    );

    if (!winner || !runner) {
      return msg("Champion বা Runner-up পাওয়া যায়নি।", "error");
    }

    const { data: existing, error: checkError } = await db
      .from("champions")
      .select("id")
      .eq("tournament_id", tournamentId)
      .maybeSingle();

    if (checkError) return msg(checkError.message, "error");

    if (!existing) {
      const { error: insertError } = await db
        .from("champions")
        .insert({
          tournament_id: tournamentId,
          tournament_name: tournament?.name || "Tournament",
          winner_name: winner.name,
          runner_up: runner.name
        });

      if (insertError) {
        return msg("Champion Save Error: " + insertError.message, "error");
      }
    }

    msg("Champion ও Runner-up তৈরি হয়েছে!", "success");
    return;
  }

  if (uniqueEntrants.length < 2) {
    return msg("পরবর্তী রাউন্ড তৈরির জন্য Team যথেষ্ট নেই।", "error");
  }

  // পরবর্তী রাউন্ড আগে তৈরি হয়েছে কি না
  const nextRoundNo = Number(roundNo) + 1;

  const { data: nextMatches, error: nextError } = await db
    .from("matches")
    .select("id")
    .eq("tournament_id", tournamentId)
    .eq("stage", "knockout")
    .eq("round_no", nextRoundNo);

  if (nextError) return msg(nextError.message, "error");

  const { data: nextByes, error: nextByeError } = await db
    .from("knockout_byes")
    .select("id")
    .eq("tournament_id", tournamentId)
    .eq("round_no", nextRoundNo);

  if (nextByeError) return msg(nextByeError.message, "error");

  if ((nextMatches?.length || 0) + (nextByes?.length || 0)) return;

  const nextRows = [];
  const nextByeRows = [];

  // Team Pairing
  for (let i = 0; i < uniqueEntrants.length; i += 2) {
    if (i + 1 < uniqueEntrants.length) {
      nextRows.push({
        tournament_id: tournamentId,
        home_team_id: uniqueEntrants[i],
        away_team_id: uniqueEntrants[i + 1],
        round_no: nextRoundNo,
        stage: "knockout",
        status: "scheduled"
      });
    } else {
      // বিজোড় Team হলে একটি BYE
      nextByeRows.push({
        tournament_id: tournamentId,
        round_no: nextRoundNo,
        team_id: uniqueEntrants[i]
      });
    }
  }

  if (nextRows.length) {
    const { error: insertError } = await db
      .from("matches")
      .insert(nextRows);

    if (insertError) return msg("Next Round Error: " + insertError.message, "error");
  }

  if (nextByeRows.length) {
    const { error: byeInsertError } = await db
      .from("knockout_byes")
      .insert(nextByeRows);

    if (byeInsertError) {
      return msg("Next Round BYE Error: " + byeInsertError.message, "error");
    }
  }

  msg("Winner ও BYE Team পরবর্তী রাউন্ডে চলে গেছে!", "success");
}


// Dropdown Helper Function
function fillSelect(id, items, label, getValue, getLabel) {
  const el = $(id);
  if (!el) return;

  const previous = el.value;

  el.innerHTML =
    `<option value="">${label}</option>` +
    items.map(item =>
      `<option value="${esc(getValue(item))}">
        ${esc(getLabel(item))}
      </option>`
    ).join("");

  if (items.some(item => String(getValue(item)) === previous)) {
    el.value = previous;
  }
}

// Tournament Dropdown
function populateTournamentSelects() {
  fillSelect(
    "teamTournament",
    tournaments,
    "Select Tournament",
    t => t.id,
    t => t.name
  );

  fillSelect(
    "fixtureTournament",
    tournaments,
    "Select Tournament",
    t => t.id,
    t => t.name
  );

  fillSelect(
    "bracketTournament",
    tournaments,
    "Select Tournament",
    t => t.id,
    t => t.name
  );

  const tournamentSelect = $("teamTournament");

  if (tournamentSelect) {
    tournamentSelect.onchange = loadExistingTeamsForTournament;
  }

  loadExistingTeamsForTournament();
}


async function loadExistingTeamsForTournament() {
  const tournamentId = $("teamTournament")?.value;

  if (!tournamentId) {
    fillSelect(
      "existingTeamSelect",
      [],
      "আগে Tournament নির্বাচন করুন",
      t => t.id,
      t => t.name
    );
    return;
  }

  const { data, error } = await db
    .from("tournament_teams")
    .select("team_id");

  if (error) {
    return msg("Existing Team Load Error: " + error.message, "error");
  }

  // অন্য Tournament-সহ কোথাও যুক্ত থাকা Team বাদ
  const assignedIds = new Set(
    (data || []).map(row => String(row.team_id))
  );

  const availableTeams = teams.filter(
    team => !assignedIds.has(String(team.id))
  );

  fillSelect(
    "existingTeamSelect",
    availableTeams,
    availableTeams.length
      ? "Select Existing Team"
      : "কোনো Unassigned Team নেই",
    t => t.id,
    t => t.name
  );
}// ===============================

// ===============================
// TEAM DETAILS & LOGO MANAGEMENT
// ===============================

let managedTeamId = "";

function ensureTeamManagementUI(){
  const area=$("adminArea");
  if(!area || $("teamManagementCard")) return;

  area.insertAdjacentHTML("afterbegin", `
    <div class="card" id="teamManagementCard" style="margin-bottom:14px">
      <h3>Team Details & Squad Management</h3>
      <p class="muted">Team Logo, Description এবং Captain Update করুন।</p>

      <div class="form">
        <div class="field full">
          <label>Select Team</label>
          <select id="manageTeamSelect">
            <option value="">Select Team</option>
          </select>
        </div>

        <div class="field">
          <label>Team Logo</label>
          <input id="manageTeamLogo" type="file" accept="image/*">
          <small class="muted">Image সর্বোচ্চ 5 MB</small>
        </div>

        <div class="field">
          <label>Current Logo</label>
          <div id="manageTeamLogoPreview" class="avatar">⚽</div>
        </div>

        <div class="field full">
          <label>Team Description</label>
          <textarea id="manageTeamDescription" rows="3" placeholder="Team সম্পর্কে লিখুন"></textarea>
        </div>

        <div class="field full">
          <label>Team Captain</label>
          <select id="manageTeamCaptain">
            <option value="">Select Captain</option>
          </select>
        </div>

        <div class="field full">
          <button class="btn green" onclick="saveTeamDetails()">Save Team Details</button>
        </div>
      </div>
    </div>
  `);
}

function setupTeamManagement(){
  ensureTeamManagementUI();

  const teamSelect=$("manageTeamSelect");
  if(!teamSelect) return;

  fillSelect(
    "manageTeamSelect",
    teams,
    "Select Team",
    t=>t.id,
    t=>t.name
  );

  if(managedTeamId && teams.some(t=>String(t.id)===String(managedTeamId))){
    teamSelect.value=managedTeamId;
  }

  fillSelect(
    "manageTeamCaptain",
    players.filter(p=>p.id && p.display_name),
    "No Captain",
    p=>p.id,
    p=>p.display_name
  );

  teamSelect.onchange=function(){
    managedTeamId=this.value;
    showManagedTeamDetails();
  };

  showManagedTeamDetails();
}

function showManagedTeamDetails(){
  const team=teams.find(t=>String(t.id)===String(managedTeamId));
  const description=$("manageTeamDescription");
  const captain=$("manageTeamCaptain");
  const preview=$("manageTeamLogoPreview");

  if(!team){
    if(description) description.value="";
    if(captain) captain.value="";
    if(preview) preview.innerHTML="⚽";
    return;
  }

  if(description) description.value=team.description||"";
  if(captain) captain.value=team.captain_id||"";

  if(preview){
    preview.innerHTML=team.logo_url
      ? `<img src="${esc(team.logo_url)}" alt="Team Logo" style="width:64px;height:64px;object-fit:contain;border-radius:10px">`
      : "⚽";
  }
}

async function saveTeamDetails(){
  if(!requireAdmin()) return;

  const teamId=$("manageTeamSelect")?.value;
  if(!teamId) return msg("আগে Team নির্বাচন করুন।","error");

  const description=$("manageTeamDescription")?.value.trim()||"";
  const captainId=$("manageTeamCaptain")?.value||null;
  const file=$("manageTeamLogo")?.files?.[0];

  const payload={
    description,
    captain_id:captainId
  };

  if(file){
    if(!file.type.startsWith("image/")){
      return msg("শুধু Image File Upload করা যাবে।","error");
    }
    if(file.size>5*1024*1024){
      return msg("Team Logo সর্বোচ্চ 5 MB হতে পারবে।","error");
    }

    try{
      msg("Team Logo Upload হচ্ছে...","notice");

      const extension=(file.name.split(".").pop()||"png").toLowerCase();
      const safeExtension=/^[a-z0-9]+$/.test(extension)?extension:"png";
      const filePath=teamId+"/"+Date.now()+"."+safeExtension;

      const {error:uploadError}=await db.storage
        .from("team-logos")
        .upload(filePath,file,{
          cacheControl:"3600",
          upsert:false,
          contentType:file.type
        });

      if(uploadError) throw uploadError;

      const {data:urlData}=db.storage
        .from("team-logos")
        .getPublicUrl(filePath);

      const logoUrl=urlData?.publicUrl;
      if(!logoUrl) throw new Error("Team Logo URL তৈরি হয়নি।");

      payload.logo_url=logoUrl;
    }catch(error){
      console.error("TEAM LOGO UPLOAD ERROR:",error);
      return msg("Team Logo Upload Error: "+error.message,"error");
    }
  }

  const {error}=await db
    .from("teams")
    .update(payload)
    .eq("id",teamId);

  if(error){
    console.error("TEAM DETAILS SAVE ERROR:",error);
    return msg("Team Details Save Error: "+error.message,"error");
  }

  managedTeamId=teamId;
  msg("Team Details সফলভাবে Update হয়েছে।","success");

  if($("manageTeamLogo")) $("manageTeamLogo").value="";
  await loadAll();
  showManagedTeamDetails();
}


// ===============================
// PLAYER TEAM ASSIGNMENT
// ===============================


function setupMemberAssignmentSelects(){
  const tournamentSelect=$("memberTournament");
  if(!tournamentSelect) return;

  fillSelect(
    "memberTournament",
    tournaments,
    "Select Tournament",
    t=>t.id,
    t=>t.name
  );

  if(memberTournamentId &&
     tournaments.some(t=>String(t.id)===String(memberTournamentId))){
    tournamentSelect.value=memberTournamentId;
  }

  tournamentSelect.onchange=async function(){
    memberTournamentId=this.value;
    memberTeamId="";
    await loadMemberTeams();
  };

  const teamSelect=$("memberTeam");
  if(teamSelect){
    teamSelect.onchange=function(){
      memberTeamId=this.value;
      renderTeamMemberList();
    };
  }

  const playerSelect=$("memberPlayer");
  if(playerSelect){
    fillSelect(
      "memberPlayer",
      players.filter(p=>p.id && p.display_name),
      "Select Player",
      p=>p.id,
      p=>p.display_name
    );
  }
}


// Selected Tournament-এর Team Load
async function loadMemberTeams(){
  if(!memberTournamentId){
    memberTeamId="";

    fillSelect(
      "memberTeam",
      [],
      "আগে Tournament নির্বাচন করুন",
      t=>t.id,
      t=>t.name
    );

    renderTeamMemberList();
    return;
  }

  const {data,error}=await db
    .from("tournament_teams")
    .select("team_id,team:teams(id,name)")
    .eq("tournament_id",memberTournamentId);

  if(error){
    return msg("Team Load Error: "+error.message,"error");
  }

  const availableTeams=(data||[])
    .map(row=>row.team)
    .filter(Boolean);

  fillSelect(
    "memberTeam",
    availableTeams,
    "Select Team",
    t=>t.id,
    t=>t.name
  );

  if(availableTeams.some(t=>String(t.id)===String(memberTeamId))){
    $("memberTeam").value=memberTeamId;
  }else{
    memberTeamId="";
  }

  renderTeamMemberList();
}


// Player-কে Team-এ Add
async function assignPlayerToTeam(){
  if(!requireAdmin()) return;

  const tournamentId=$("memberTournament").value;
  const teamId=$("memberTeam").value;
  const playerId=$("memberPlayer").value;

  if(!tournamentId) {
    return msg("Tournament নির্বাচন করুন।","error");
  }

  if(!teamId) {
    return msg("Team নির্বাচন করুন।","error");
  }

  if(!playerId) {
    return msg("Player নির্বাচন করুন।","error");
  }

  // Team এই Tournament-এর অন্তর্ভুক্ত কি না যাচাই
  const {data:assignment,error:checkError}=await db
    .from("tournament_teams")
    .select("team_id")
    .eq("tournament_id",tournamentId)
    .eq("team_id",teamId)
    .maybeSingle();

  if(checkError) return msg(checkError.message,"error");

  if(!assignment){
    return msg("এই Team নির্বাচিত Tournament-এর অন্তর্ভুক্ত নয়।","error");
  }

  // একই Player আগে থেকেই এই Team-এ আছে কি না
  const {data:existing,error:existingError}=await db
    .from("team_members")
    .select("id")
    .eq("team_id",teamId)
    .eq("player_id",playerId)
    .maybeSingle();

  if(existingError) return msg(existingError.message,"error");

  if(existing){
    return msg("এই Player আগে থেকেই এই Team-এ আছে।","error");
  }

  const {error}=await db
    .from("team_members")
    .insert({
      team_id:teamId,
      player_id:playerId
    });

  if(error) return msg("Player Add Error: "+error.message,"error");

  memberTournamentId=tournamentId;
  memberTeamId=teamId;

  msg("Player সফলভাবে Team-এ যুক্ত হয়েছে!","success");

  await loadAll();
  await loadMemberTeams();
}


function renderTeamDirectory(){
  const box=$("publicTeamDirectory");
  if(!box)return;
  const activeTeams=teams.map(team=>({
    team,
    members:teamMembers.filter(m=>String(m.team_id)===String(team.id))
  })).filter(x=>x.members.length);
  if(!activeTeams.length){
    box.innerHTML='<div class="empty">এখনো কোনো Team-এর Squad প্রকাশ করা হয়নি।</div>';
    return;
  }
  box.innerHTML=activeTeams.map(({team,members})=>`
    <article class="team-directory-card">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
        ${team.logo_url
          ? `<img src="${esc(team.logo_url)}" alt="${esc(team.name)} logo" style="width:58px;height:58px;object-fit:contain;border-radius:14px;background:#f7f8f3;padding:4px">`
          : `<div class="avatar" style="width:58px;height:58px;display:grid;place-items:center">⚽</div>`}
        <div class="grow" style="min-width:0">
          <h3 style="margin:0">${esc(team.name||"Team")}</h3>
          <small class="muted">${members.length} Squad Player${members.length===1?"":"s"}</small>
        </div>
      </div>
      ${team.description?`<p class="muted" style="margin:0 0 12px">${esc(team.description)}</p>`:""}
      ${members.map(m=>`
        <div class="team-directory-player">
          ${m.player?.avatar_url
            ? `<img src="${esc(m.player.avatar_url)}" alt="${esc(m.player?.display_name||"Player")} photo">`
            : `<div class="team-player-fallback">${esc((m.player?.display_name||"?")[0].toUpperCase())}</div>`}
          <div style="min-width:0;flex:1">
            <b>${esc(m.player?.display_name||"Unknown Player")}</b>
            <small>eFootball ID: ${esc(m.player?.efootball_id||"Not Added")}</small>
            <small>Device: ${esc(m.player?.device||"Not Added")}</small>
            <small>Club: ${esc(m.player?.club_name||"Not Added")}</small>
          </div>
        </div>
      `).join("")}
    </article>
  `).join("");
}

// Selected Team-এর Member List
function renderTeamMemberList(){
  const box=$("teamMemberList");
  if(!box) return;

  if(!memberTeamId){
    box.innerHTML='<div class="empty">Select a Team to see its members.</div>';
    return;
  }

  const members=teamMembers.filter(
    m=>String(m.team_id)===String(memberTeamId)
  );

  box.innerHTML=members.map(m=>`
    <div class="item team-member-detail" style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
      ${m.player?.avatar_url
        ? `<img src="${esc(m.player.avatar_url)}" alt="${esc(m.player?.display_name||"Player")}" style="width:58px;height:58px;object-fit:cover;border-radius:14px;border:1px solid var(--line)">`
        : `<div class="avatar" style="width:58px;height:58px;display:grid;place-items:center">👤</div>`}
      <div class="grow" style="min-width:180px">
        <b>${esc(m.player?.display_name||"Unknown Player")}</b>
        <small style="display:block;margin-top:4px">eFootball ID: ${esc(m.player?.efootball_id||"Not Added")}</small>
        <small style="display:block">Device: ${esc(m.player?.device||"Not Added")}</small>
        <small style="display:block">Club: ${esc(m.player?.club_name||"Not Added")}</small>
      </div>
      ${["admin","moderator"].includes(role)?`
        <button class="btn danger" onclick="removeTeamMember('${m.id}')">Remove</button>
      `:""}
    </div>
  `).join("")||'<div class="empty">এই Team-এ এখনো কোনো Player নেই।</div>';
}


// Team থেকে Player Remove
async function removeTeamMember(memberId){
  if(!requireAdmin()) return;

  if(!confirm("এই Player-কে Team থেকে Remove করবেন?")) return;

  const {error}=await db
    .from("team_members")
    .delete()
    .eq("id",memberId);

  if(error) return msg("Remove Error: "+error.message,"error");

  msg("Player Team থেকে Remove হয়েছে।","success");

  await loadAll();
  renderTeamMemberList();
}

// PLAYER DASHBOARD FUNCTIONS
// ===============================

async function saveMyProfile(){
 if(!me)return openAuth();
 const payload={id:me.id,display_name:$("editPlayerName").value.trim(),efootball_id:$("editPlayerEid").value.trim(),device:$("editPlayerDevice").value.trim(),club_name:$("editPlayerClub").value.trim()||"Ancestor of Sylhet"};
 if(!payload.display_name||!payload.efootball_id||!payload.device)return msg("Player Name, eFootball ID ও Device দিতে হবে।","error");
 try{await submitProfileEditRequest(payload);msg("Profile Edit Request Main Admin-এর অনুমোদনের জন্য পাঠানো হয়েছে।","success");await loadMyProfileRequests();}
 catch(error){msg("Request submit হয়নি: "+error.message,"error");}
}

async function uploadProfilePhoto(){
 if(!me)return openAuth();
 const file=$("profilePhotoFile")?.files?.[0];if(!file)return msg("আগে Photo নির্বাচন করুন।","error");
 if(!file.type.startsWith("image/"))return msg("শুধু Image File Upload করা যাবে।","error");
 if(file.size>5*1024*1024)return msg("Photo সর্বোচ্চ 5 MB হতে পারবে।","error");
 try{
  const extension=(file.name.split(".").pop()||"jpg").toLowerCase(),filePath=me.id+"/profile-request-"+Date.now()+"."+extension;
  const {error:uploadError}=await db.storage.from("avatars").upload(filePath,file,{cacheControl:"3600",upsert:false,contentType:file.type});if(uploadError)throw uploadError;
  const avatarUrl=db.storage.from("avatars").getPublicUrl(filePath).data?.publicUrl;if(!avatarUrl)throw new Error("Photo URL তৈরি হয়নি।");
  const p=players.find(x=>String(x.id)===String(me.id))||{};
  await submitProfileEditRequest({id:me.id,display_name:p.display_name||"",efootball_id:p.efootball_id||"",device:p.device||"",club_name:p.club_name||"Ancestor of Sylhet",avatar_url:avatarUrl});
  msg("Photo Admin Approval-এর জন্য পাঠানো হয়েছে। অনুমোদনের পর Profile-এ দেখা যাবে।","success");await loadMyProfileRequests();
 }catch(error){msg("Photo Request হয়নি: "+error.message,"error");}
}

function renderPlayerDashboard(){
  const box=$("myProfile");
  if(!box) return;

  if(!me){
    box.innerHTML=`
      <div class="empty">
        <h3>Player Dashboard</h3>
        <p>Dashboard দেখতে Login করুন।</p>
        <button class="btn" onclick="openAuth()">Login / Create Account</button>
      </div>`;
    return;
  }

  const profile=players.find(p=>String(p.id)===String(me.id))||{};
  const myTeamMembers=teamMembers.filter(
  m=>String(m.player_id)===String(me.id)
);

const teamIds=[...new Set([
  ...myParticipation.map(p=>p.team_id),
  ...myTeamMembers.map(m=>m.team_id)
].filter(Boolean).map(String))];

  const myMatches=matches.filter(m=>
    teamIds.includes(String(m.home_team_id)) ||
    teamIds.includes(String(m.away_team_id))
  ).sort((a,b)=>
    new Date(b.played_at||b.created_at)-new Date(a.played_at||a.created_at)
  );

  const completed=myMatches.filter(m=>m.status==="completed");

  let wins=0,draws=0,losses=0,goalsFor=0,goalsAgainst=0;

  completed.forEach(m=>{
    const isHome=teamIds.includes(String(m.home_team_id));
    const scoreFor=Number(isHome?m.home_score:m.away_score);
    const scoreAgainst=Number(isHome?m.away_score:m.home_score);

    goalsFor+=scoreFor;
    goalsAgainst+=scoreAgainst;

    if(scoreFor>scoreAgainst) wins++;
    else if(scoreFor===scoreAgainst) draws++;
    else losses++;
  });

  const avatar = profile.avatar_url
  ? `
    <img
      src="${esc(profile.avatar_url)}?t=${Date.now()}"
      alt="Profile Photo"
      class="profile-photo"
      onerror="this.style.display='none';this.nextElementSibling.style.display='grid';"
    >
    <div
      class="profile-photo profile-placeholder"
      style="display:none"
    >
      ${esc((profile.display_name||me.email||"P")[0].toUpperCase())}
    </div>
  `
  : `
    <div class="profile-photo profile-placeholder">
      ${esc((profile.display_name||me.email||"P")[0].toUpperCase())}
    </div>
  `;
  const teamCards=myTeamMembers.map(m=>{
    const team=teams.find(t=>String(t.id)===String(m.team_id))||m.team||{};
    const squad=teamMembers.filter(x=>String(x.team_id)===String(m.team_id));
    const captain=players.find(p=>String(p.id)===String(team.captain_id));

    return `
      <div class="item" style="display:block;margin-bottom:12px">
        <div style="display:flex;align-items:center;gap:10px">
          ${team.logo_url
            ? `<img src="${esc(team.logo_url)}" alt="Team Logo" style="width:54px;height:54px;object-fit:contain;border-radius:10px">`
            : `<div class="avatar">⚽</div>`}
          <div class="grow">
            <b>${esc(team.name||"Team")}</b>
            <small>${esc(team.description||"Team Member")}</small>
          </div>
        </div>
        <div style="margin-top:10px">
          <small><b>Captain:</b> ${esc(captain?.display_name||"Not Assigned")}</small>
          <small style="display:block;margin-top:4px"><b>Squad (${squad.length})</b></small>
          ${squad.map(member=>`
            <div style="display:flex;align-items:center;gap:9px;margin-top:10px;padding:9px;border:1px solid var(--line);border-radius:12px">
              ${member.player?.avatar_url
                ? `<img src="${esc(member.player.avatar_url)}" alt="${esc(member.player?.display_name||"Player")}" style="width:42px;height:42px;object-fit:cover;border-radius:11px">`
                : `<span class="avatar" style="width:42px;height:42px">👤</span>`}
              <div style="min-width:0">
                <b style="display:block">${esc(member.player?.display_name||"Unknown Player")}</b>
                <small style="display:block">eFootball ID: ${esc(member.player?.efootball_id||"Not Added")}</small>
                <small style="display:block">Device: ${esc(member.player?.device||"Not Added")} · Club: ${esc(member.player?.club_name||"Not Added")}</small>
              </div>
            </div>
          `).join("")}
        </div>
      </div>
    `;
  }).join("")||'<div class="empty">এখনো কোনো Team-এ যুক্ত হওনি।</div>';

  const tournamentCards=myParticipation.map(p=>`
    <div class="item">
      <div class="avatar">🏆</div>
      <div class="grow">
        <b>${esc(p.tournament?.name||"Tournament")}</b>
        <small>${esc(p.tournament?.type||"")} · ${esc(p.tournament?.status||"")} · ${esc(p.status||"")}</small>
      </div>
    </div>
  `).join("")||'<div class="empty">এখনো কোনো Tournament-এ অংশগ্রহণ করছ না।</div>';

  const history=myMatches.map(m=>{
    const isHome=teamIds.includes(String(m.home_team_id));
    const myTeam=isHome?(m.home?.name||"My Team"):(m.away?.name||"My Team");
    const opponent=isHome?(m.away?.name||"Opponent"):(m.home?.name||"Opponent");
    const myScore=isHome?m.home_score:m.away_score;
    const opponentScore=isHome?m.away_score:m.home_score;

    let result="Scheduled";
    if(m.status==="completed"){
      result=Number(myScore)>Number(opponentScore)?"WIN":
        Number(myScore)<Number(opponentScore)?"LOSS":"DRAW";
    }

    return `
      <div class="item">
        <div class="avatar">⚽</div>
        <div class="grow">
          <b>${esc(myTeam)} vs ${esc(opponent)}</b>
          <small>${esc(m.stage||"League")} · Round ${m.round_no||"—"}</small>
        </div>
        <div style="text-align:right">
          <b>${myScore??"—"} : ${opponentScore??"—"}</b>
          <small>${result}</small>
        </div>
      </div>`;
  }).join("")||'<div class="empty">এখনো কোনো Match History নেই।</div>';

  box.innerHTML=`
    <div class="dashboard-profile">
      <div class="dashboard-user">
        ${avatar}
        <div class="grow">
          <h3>${esc(profile.display_name||"Player")}</h3>
          <p class="muted">${esc(me.email)}</p>
          <span class="pill">${esc(role)}</span>
        </div>
      </div>

      <div class="profile-details">
        <div><small>eFootball ID</small><b>${esc(profile.efootball_id||"Not Added")}</b></div>
        <div><small>Device</small><b>${esc(profile.device||"Not Added")}</b></div>
        <div><small>Club</small><b>${esc(profile.club_name||"Not Added")}</b></div>
      </div>
    </div>

    <div class="card dashboard-edit">
      <h3>Edit Profile</h3>
      <p class="muted">তোমার পরিবর্তন Main Admin অনুমোদন করার পর Profile-এ যুক্ত হবে।</p>
      <div id="myProfileRequests" class="list" style="margin:10px 0"></div>
      <div class="field">
        <label>Profile Photo</label>
        <input id="profilePhotoFile" type="file" accept="image/*">
        <button class="btn light" style="margin-top:8px" onclick="uploadProfilePhoto()">Upload Photo</button>
      </div>

      <div class="form" style="margin-top:14px">
        <div class="field">
          <label>Player Name</label>
          <input id="editPlayerName" value="${esc(profile.display_name||"")}">
        </div>
        <div class="field">
          <label>eFootball ID</label>
          <input id="editPlayerEid" value="${esc(profile.efootball_id||"")}">
        </div>
        <div class="field">
          <label>Device</label>
          <input id="editPlayerDevice" value="${esc(profile.device||"")}">
        </div>
        <div class="field">
          <label>Club Name</label>
          <input id="editPlayerClub" value="${esc(profile.club_name||"Ancestor of Sylhet")}">
        </div>
        <div class="field full">
          <button class="btn green" onclick="saveMyProfile()">Save Profile</button>
        </div>
      </div>
    </div>

    <div class="head"><h2>My Performance</h2></div>
    <div class="grid dashboard-stats">
      <div class="card"><small>Matches</small><h3>${completed.length}</h3></div>
      <div class="card"><small>Wins</small><h3>${wins}</h3></div>
      <div class="card"><small>Draws</small><h3>${draws}</h3></div>
      <div class="card"><small>Losses</small><h3>${losses}</h3></div>
      <div class="card"><small>Goals For</small><h3>${goalsFor}</h3></div>
      <div class="card"><small>Goals Against</small><h3>${goalsAgainst}</h3></div>
    </div>

    <div class="head"><h2>My Team</h2></div>
    <div class="list">${teamCards}</div>

    <div class="head"><h2>My Tournaments</h2></div>
    <div class="list">${tournamentCards}</div>

    <div class="head"><h2>Match History</h2></div>
    <div class="list">${history}</div>

    <div style="margin-top:18px">
      <button class="btn danger" onclick="logout()">Logout</button>
    </div>
  `;
} 

// Tournament Details: public read view for players and admins
async function openTournament(id){
  const t=tournaments.find(x=>String(x.id)===String(id));
  if(!t)return msg("Tournament পাওয়া যায়নি।","error");
  selectedTournamentId=String(id); tournamentDetailTab="overview";
  const {data,error}=await db.from("tournament_teams").select("team_id,team:teams(id,name,logo_url,description,captain_id)").eq("tournament_id",id);
  if(error){console.error("Tournament teams:",error);selectedTournamentTeams=[];}
  else selectedTournamentTeams=(data||[]).map(x=>x.team).filter(Boolean);
  renderTournamentDetails();
  document.querySelectorAll(".page").forEach(x=>x.classList.add("hidden"));
  let panel=$("tournamentDetailPage"); if(panel)panel.classList.remove("hidden");
  window.scrollTo(0,0);
}
function closeTournament(){selectedTournamentId="";let p=$("tournamentDetailPage");if(p)p.classList.add("hidden");go("tournaments")}
function setTournamentTab(tab){tournamentDetailTab=tab;renderTournamentDetails()}
function renderTournamentDetails(){
  const t=tournaments.find(x=>String(x.id)===String(selectedTournamentId)); if(!t)return;
  let panel=$("tournamentDetailPage");
  if(!panel){panel=document.createElement("section");panel.id="tournamentDetailPage";panel.className="page hidden";panel.style.cssText="padding:18px;max-width:1100px;margin:auto";document.querySelector("main")?.appendChild(panel);if(!document.querySelector("main"))document.body.appendChild(panel);}
  const teamIds=selectedTournamentTeams.map(x=>String(x.id));
  const tm=matches.filter(x=>String(x.tournament_id)===String(t.id));
  const st=standings.filter(x=>String(x.tournament_id)===String(t.id));
  const ap=auctionPlayers.filter(x=>String(x.tournament_id)===String(t.id));
  const tabs=[['overview','Overview'],['teams','Teams'],['squad','Squad'],['auction','Auction'],['matches','Fixtures & Results'],['table','Points Table'],['knockout','Knockout']];
  const nav=tabs.map(([k,label])=>`<button class="btn ${tournamentDetailTab===k?'':'light'}" style="margin:4px" onclick="setTournamentTab('${k}')">${label}</button>`).join('');
  let content='';
  if(tournamentDetailTab==='overview') content=`<div class="card"><h3>${esc(t.name)}</h3><p>Type: ${esc(t.type||'—')} · Season: ${esc(t.season||'—')}</p><p>Status: ${esc(t.status||'—')}</p><p>Entry Fee: ${Number(t.entry_fee||0)} · Maximum Teams/Players: ${t.max_participants||'—'}</p><p>Registered Teams: ${selectedTournamentTeams.length}</p></div>`;
  if(tournamentDetailTab==='teams') content=selectedTournamentTeams.map(x=>`<div class="item" style="display:flex;align-items:center;gap:12px">${x.logo_url?`<img src="${esc(x.logo_url)}" alt="" style="width:48px;height:48px;object-fit:cover;border-radius:10px">`:`<div class="avatar">⚽</div>`}<div><b>${esc(x.name)}</b><small style="display:block">${esc(x.description||'Registered Team')}</small></div></div>`).join('')||'<div class="empty">এই Tournament-এ এখনো Team যুক্ত হয়নি।</div>';
  if(tournamentDetailTab==='squad') {
    const soldPlayers=ap.filter(x=>String(x.status||'').toLowerCase()==='sold');
    content=soldPlayers.map(x=>{
      const buyerTeam=teams.find(team=>String(team.id)===String(x.team_id))||x.team||null;
      const profile=x.profile||players.find(player=>String(player.id)===String(x.profile_id))||{};
      const photo=profile.avatar_url;
      return `<div class=\"item\" style=\"display:flex;align-items:center;gap:12px;margin-bottom:10px\">${photo?`<img src=\"${esc(photo)}\" alt=\"\" style=\"width:58px;height:58px;object-fit:cover;border-radius:50%\">`:`<div class=\"avatar\" style=\"width:58px;height:58px;display:grid;place-items:center\">👤</div>`}<div class=\"grow\"><b>${esc(profile.display_name||'Player')}</b><small style=\"display:block\">কেনা দাম: <b>${Number(x.sold_price||0).toLocaleString()} ৳</b></small><small style=\"display:block\">কিনেছে: <b>${esc(buyerTeam?.name||'Unknown Team')}</b></small></div></div>`;
    }).join('')||'<div class=\"empty\">এই Tournament-এ এখনো কোনো Player Sold হয়নি।</div>';
  }
  if(tournamentDetailTab==='auction') content=ap.map(x=>{const p=x.profile||players.find(z=>String(z.id)===String(x.profile_id))||{};return `<div class="item" style="display:flex;align-items:center;gap:12px">${p.avatar_url?`<img src="${esc(p.avatar_url)}" alt="Player Photo" style="width:68px;height:68px;object-fit:cover;border-radius:14px">`:'<div class="avatar" style="width:68px;height:68px;border-radius:14px">👤</div>'}<div class="grow"><b>${esc(p.display_name||'Player')}</b><small style="display:block">Device: ${esc(p.device||'Not Added')}</small><small style="display:block">User ID: ${esc(p.efootball_id||'Not Added')}</small><small style="display:block">${esc(x.status||'')} · Base Price: ${Number(x.base_price||0)}</small></div></div>`;}).join('')||'<div class="empty">এই Tournament-এর Auction Player পাওয়া যায়নি।</div>';
  if(tournamentDetailTab==='matches') content=tm.map(x=>`<div class="item"><b>${esc(x.home?.name||'TBD')} vs ${esc(x.away?.name||'TBD')}</b><small>Round ${x.round_no||'—'} · ${esc(x.status||'')}</small><b>${x.home_score??'—'} : ${x.away_score??'—'}</b></div>`).join('')||'<div class="empty">এই Tournament-এর Fixture তৈরি হয়নি।</div>';
  if(tournamentDetailTab==='table') content=st.map((x,i)=>`<div class="item"><b>${i+1}. ${esc(x.team?.name||'Team')}</b><small>P ${x.played??0} · W ${x.won??0} · D ${x.drawn??0} · L ${x.lost??0} · GD ${x.goal_difference??0} · Points ${x.points??0}</small></div>`).join('')||'<div class="empty">এই Tournament-এর Points Table পাওয়া যায়নি।</div>';
  if(tournamentDetailTab==='knockout') content=tm.filter(x=>String(x.stage||'').toLowerCase().includes('knockout')||String(x.stage||'').toLowerCase().includes('final')||String(x.stage||'').toLowerCase().includes('semi')).map(x=>`<div class="item"><b>${esc(x.home?.name||'TBD')} vs ${esc(x.away?.name||'TBD')}</b><small>${esc(x.stage||'Knockout')}</small><b>${x.home_score??'—'} : ${x.away_score??'—'}</b></div>`).join('')||'<div class="empty">Knockout fixture এখনো তৈরি হয়নি।</div>';
  panel.innerHTML=`<button class="btn light" onclick="closeTournament()">← Back to Events</button><div class="head"><h2>${esc(t.name)}</h2><span class="pill">${esc(t.status||'')}</span></div><div style="display:flex;flex-wrap:wrap;gap:4px;margin:12px 0">${nav}</div><div>${content}</div>`;
}


/* PUBLIC PLAYER DIRECTORY */
function renderPublicPlayers(){
  const box=$("publicPlayerList");if(!box)return;
  const term=($("playerSearch")?.value||"").trim().toLowerCase();
  const list=players.filter(p=>(p.display_name||"").toLowerCase().includes(term)||(p.efootball_id||"").toLowerCase().includes(term)||(p.club_name||"").toLowerCase().includes(term));
  $("registeredPlayerCount").textContent=players.length+" Players";
  box.innerHTML=list.map(p=>`<div class="card" style="cursor:pointer" onclick="openPublicPlayerProfile('${p.id}')"><div style="display:flex;align-items:center;gap:12px">${p.avatar_url?`<img src="${esc(p.avatar_url)}" alt="Player Photo" style="width:72px;height:72px;object-fit:cover;border-radius:14px">`:'<div class="avatar" style="width:72px;height:72px;border-radius:14px">👤</div>'}<div class="grow"><h3>${esc(p.display_name||"Player")}</h3><small class="muted" style="display:block">Device: ${esc(p.device||"Not Added")}</small><small class="muted" style="display:block">User ID: ${esc(p.efootball_id||"Not Added")}</small></div><span class="pill">View</span></div></div>`).join("")||'<div class="empty">কোনো Player পাওয়া যায়নি।</div>';
}
function openPublicPlayerProfile(id){
  const p=players.find(x=>String(x.id)===String(id));if(!p)return;
  let page=$("publicPlayerDetail");if(!page){page=document.createElement("section");page.id="publicPlayerDetail";page.className="page hidden";document.querySelector("main").appendChild(page);}
  const stats=playerMatchStats.filter(s=>String(s.player_id)===String(id));
  const goals=stats.reduce((n,s)=>n+Number(s.goals||0),0),assists=stats.reduce((n,s)=>n+Number(s.assists||0),0),motm=stats.filter(s=>s.is_motm).length;
  page.innerHTML=`<button class="btn light" onclick="go('playersDirectory')">← Back to Players</button><div class="card" style="margin-top:14px;text-align:center">${p.avatar_url?`<img src="${esc(p.avatar_url)}" style="width:110px;height:110px;object-fit:cover;border-radius:50%;border:4px solid var(--gold)">`:'<div class="avatar" style="width:110px;height:110px;margin:auto;font-size:35px">👤</div>'}<h2>${esc(p.display_name||"Player")}</h2><span class="pill">${esc(p.role||"player")}</span><div class="profile-details" style="text-align:left;color:var(--ink)"><div><small>eFootball ID</small><b style="color:var(--ink)">${esc(p.efootball_id||"Not Added")}</b></div><div><small>Device</small><b style="color:var(--ink)">${esc(p.device||"Not Added")}</b></div><div><small>Club</small><b style="color:var(--ink)">${esc(p.club_name||"Not Added")}</b></div></div><div class="grid dashboard-stats" style="margin-top:14px"><div class="card"><small>Matches Recorded</small><h3>${stats.length}</h3></div><div class="card"><small>Goals</small><h3>${goals}</h3></div><div class="card"><small>Assists</small><h3>${assists}</h3></div><div class="card"><small>Man of the Match</small><h3>${motm}</h3></div></div></div>`;
  document.querySelectorAll(".page").forEach(x=>x.classList.add("hidden"));page.classList.remove("hidden");window.scrollTo(0,0);
}

/* AWARDS CENTER — calculated from admin-entered match player statistics */
function setAwardTab(tab,button){awardTab=tab;document.querySelectorAll("#awardTabs .tab").forEach(x=>x.classList.remove("active"));button?.classList.add("active");renderAwards();}
function awardScore(rows){return rows.reduce((n,s)=>n+Number(s.goals||0)*3+Number(s.assists||0)*2+(s.is_motm?2:0),0);}
function renderAwards(){
 const box=$("awardList");if(!box)return;
 const now=new Date();let rows=playerMatchStats.filter(s=>s.player_id);
 if(awardTab==="motm") rows=rows.filter(s=>s.is_motm);
 else if(awardTab==="week") rows=rows.filter(s=>{const d=new Date(s.played_at||s.created_at);return (now-d)<=7*86400000;});
 else if(awardTab==="month") rows=rows.filter(s=>{const d=new Date(s.played_at||s.created_at);return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear();});
 else if(awardTab==="year") rows=rows.filter(s=>new Date(s.played_at||s.created_at).getFullYear()===now.getFullYear());
 else if(awardTab==="season") rows=rows.filter(s=>{const t=tournaments.find(x=>String(x.id)===String(s.tournament_id));return t&&t.season=== (tournaments.find(x=>x.season)?.season||t.season);});
 const groups=new Map();
 rows.forEach(s=>{const id=String(s.player_id);if(!groups.has(id))groups.set(id,[]);groups.get(id).push(s);});
 let leaders=[...groups.entries()].map(([id,list])=>({player:players.find(p=>String(p.id)===id),rows:list,score:awardScore(list)})).filter(x=>x.player);
 leaders.sort((a,b)=>awardTab==="motm"?b.rows.length-a.rows.length:b.score-a.score);
 if(awardTab==="tournament"){
   const tournamentGroups=new Map();rows.forEach(s=>{const key=String(s.tournament_id);if(!tournamentGroups.has(key))tournamentGroups.set(key,[]);tournamentGroups.get(key).push(s);});
   leaders=[...tournamentGroups.entries()].flatMap(([tid,list])=>{const byPlayer=new Map();list.forEach(s=>{const k=String(s.player_id);if(!byPlayer.has(k))byPlayer.set(k,[]);byPlayer.get(k).push(s);});return [...byPlayer.entries()].map(([id,r])=>({player:players.find(p=>String(p.id)===id),rows:r,score:awardScore(r),tournament:tournaments.find(t=>String(t.id)===tid)}));}).filter(x=>x.player).sort((a,b)=>b.score-a.score);
 }
 box.innerHTML=leaders.slice(0,20).map((x,i)=>`<div class="card" style="text-align:center">${x.player.avatar_url?`<img src="${esc(x.player.avatar_url)}" style="width:76px;height:76px;border-radius:50%;object-fit:cover">`:'<div class="avatar" style="width:76px;height:76px;margin:auto;font-size:26px">👤</div>'}<p class="pill gold">${i===0?"🏆 TOP PLAYER":"#"+(i+1)}</p><h3>${esc(x.player.display_name)}</h3><p class="muted">${esc(x.tournament?.name||"AOS Player Awards")}</p><div class="grid"><div><b>${x.rows.reduce((n,s)=>n+Number(s.goals||0),0)}</b><small style="display:block">Goals</small></div><div><b>${x.rows.reduce((n,s)=>n+Number(s.assists||0),0)}</b><small style="display:block">Assists</small></div><div><b>${x.rows.filter(s=>s.is_motm).length}</b><small style="display:block">MOTM</small></div></div><h3>${x.score} Points</h3><button class="btn" onclick="downloadAwardCard('${x.player.id}','${awardTab}',${x.score})">Download Award Card</button></div>`).join("")||'<div class="empty">এখনো এই Award-এর জন্য Match Player Stats জমা হয়নি। Admin Panel থেকে Match Stats update করুন।</div>';
}
function downloadAwardCard(playerId,category,score){
 const p=players.find(x=>String(x.id)===String(playerId));if(!p)return;
 const c=document.createElement("canvas");c.width=1200;c.height=700;const x=c.getContext("2d");
 const g=x.createLinearGradient(0,0,1200,700);g.addColorStop(0,"#101b35");g.addColorStop(1,"#24558f");x.fillStyle=g;x.fillRect(0,0,1200,700);
 x.strokeStyle="#f3c44f";x.lineWidth=12;x.strokeRect(28,28,1144,644);
 x.textAlign="center";x.fillStyle="#f3c44f";x.font="bold 42px Arial";x.fillText("ANCESTOR OF SYLHET",600,120);
 x.fillStyle="#fff";x.font="bold 62px Arial";x.fillText("PLAYER AWARD",600,245);
 x.font="bold 54px Arial";x.fillText(p.display_name||"AOS Player",600,365);
 x.fillStyle="#f3c44f";x.font="bold 42px Arial";x.fillText(category.toUpperCase().replace("MOTM","MAN OF THE MATCH"),600,455);
 x.fillStyle="#fff";x.font="bold 34px Arial";x.fillText("PERFORMANCE POINTS: "+score,600,540);
 x.font="24px Arial";x.fillText("OFFICIAL AOS TOURNAMENT CENTER",600,615);
 const a=document.createElement("a");a.download="AOS-Award-"+(p.display_name||"Player").replace(/[^a-z0-9]+/gi,"-")+".png";a.href=c.toDataURL("image/png");a.click();
}
function ensurePlayerStatsAdminUI(){
 const area=$("adminArea");if(!area||$("playerStatsAdminCard"))return;
 area.insertAdjacentHTML("beforeend",`<div class="card" id="playerStatsAdminCard" style="margin-top:14px"><h3>Update Match Player Stats</h3><p class="muted">প্রতিটি Match-এর পর Player-এর Goals, Assists ও Man of the Match নির্বাচন করুন।</p><div class="form"><div class="field"><label>Completed Match</label><select id="statMatch"></select></div><div class="field"><label>Player</label><select id="statPlayer"></select></div><div class="field"><label>Goals</label><input id="statGoals" type="number" min="0" value="0"></div><div class="field"><label>Assists</label><input id="statAssists" type="number" min="0" value="0"></div><div class="field full"><label><input id="statMotm" type="checkbox"> Man of the Match</label></div><div class="field full"><button class="btn green" onclick="savePlayerMatchStats()">Save Player Stats</button></div></div></div>`);
}
function setupPlayerStatsAdminUI(){
 ensurePlayerStatsAdminUI();if(!$("statMatch"))return;
 const completed=matches.filter(m=>m.status==="completed");
 fillSelect("statMatch",completed,"Select Completed Match",m=>m.id,m=>`${m.home?.name||"Team"} vs ${m.away?.name||"Team"} · ${m.played_at?new Date(m.played_at).toLocaleDateString():"Completed"}`);
 fillSelect("statPlayer",players.filter(p=>p.display_name),"Select Player",p=>p.id,p=>p.display_name);
}
async function savePlayerMatchStats(){
 if(!requireAdmin())return;
 const match=matches.find(m=>String(m.id)===$("statMatch").value),playerId=$("statPlayer").value;
 if(!match||!playerId)return msg("Match ও Player নির্বাচন করুন।","error");
 const payload={match_id:match.id,tournament_id:match.tournament_id,player_id:playerId,goals:Number($("statGoals").value||0),assists:Number($("statAssists").value||0),is_motm:$("statMotm").checked,played_at:match.played_at||new Date().toISOString(),created_by:me.id};
 const {error}=await db.from("player_match_stats").upsert(payload,{onConflict:"match_id,player_id"});
 if(error)return msg("Player Stats Save Error: "+error.message+" — Supabase SQL migration চালানো হয়েছে কি না দেখুন।","error");
 msg("Player Match Stats Save হয়েছে। Award Ranking আপডেট হচ্ছে।","success");await loadAll();
}
function renderManagement(){
 const box=$("managementList");if(!box)return;
 const panel=$("managementAdminPanel");
 if(panel)panel.classList.toggle("hidden",!me||String(role).toLowerCase()!=="admin");
 const records=managementTableReady
   ? managementMembers.filter(m=>m.is_active)
   : players.filter(p=>["admin","moderator"].includes(String(p.role||"").toLowerCase())).map(p=>({id:p.id,name:p.display_name,position:String(p.role).toLowerCase()==="admin"?"Administrator":"Moderator",department:"AOS Management",photo_url:p.avatar_url,responsibilities:p.club_name,is_active:true}));
 box.innerHTML=records.map(m=>`<div class="card" style="text-align:center">${m.photo_url?`<img src="${esc(m.photo_url)}" alt="${esc(m.name)}" style="width:96px;height:96px;border-radius:50%;object-fit:cover;border:3px solid var(--gold)">`:'<div class="avatar" style="width:96px;height:96px;margin:auto;font-size:30px">🛡</div>'}<h3>${esc(m.name||"AOS Management")}</h3><span class="pill">${esc(m.position||"Management Member")}</span><p class="muted">${esc(m.department||"Ancestor of Sylhet")}</p>${m.responsibilities?`<p>${esc(m.responsibilities)}</p>`:""}</div>`).join("")||'<div class="empty">এখনো কোনো Management Member যুক্ত করা হয়নি।</div>';
 const adminList=$("managementAdminList");
 if(adminList){
   adminList.innerHTML=managementMembers.map(m=>`<div class="item"><div class="grow"><b>${esc(m.name)}</b><small>${esc(m.position)} · ${m.is_active?"Public":"Hidden"}</small></div><button class="btn light" onclick="editManagementMember('${esc(m.id)}')">Edit</button><button class="btn danger" onclick="deleteManagementMember('${esc(m.id)}')">Delete</button></div>`).join("")||'<div class="empty">কোনো সদস্য নেই। উপরের ফর্ম থেকে প্রথম সদস্য যোগ করুন।</div>';
 }
}
function previewManagementPhoto(input){
 const preview=$("managementPhotoPreview");
 const file=input?.files?.[0];
 if(!preview)return;
 if(!file){preview.src="";preview.classList.add("hidden");return;}
 if(!file.type.startsWith("image/")){input.value="";return msg("শুধু Image file নির্বাচন করুন।","error");}
 if(file.size>5*1024*1024){input.value="";return msg("ছবির সাইজ 5MB-এর মধ্যে রাখুন।","error");}
 preview.src=URL.createObjectURL(file);preview.classList.remove("hidden");
}
function resetManagementForm(){
 editingManagementId="";
 ["managementName","managementPosition","managementDepartment","managementResponsibilities","managementOrder"].forEach(id=>{const el=$(id);if(el)el.value=id==="managementOrder"?"0":"";});
 if($("managementPhotoFile")){$("managementPhotoFile").value="";$("managementPhotoFile").dataset.existingUrl="";}
 const preview=$("managementPhotoPreview");if(preview){preview.src="";preview.classList.add("hidden");}
 if($("managementActive"))$("managementActive").checked=true;
 const heading=$("managementFormTitle");if(heading)heading.textContent="Add Management Member";
 const save=$("managementSaveButton");if(save)save.textContent="Save Member";
}
function editManagementMember(id){
 if(!requireMainAdmin())return;
 const m=managementMembers.find(x=>String(x.id)===String(id));if(!m)return;
 editingManagementId=String(m.id);
 $("managementName").value=m.name||"";
 $("managementPosition").value=m.position||"";
 $("managementDepartment").value=m.department||"";
 $("managementPhotoFile").value="";
 const preview=$("managementPhotoPreview");if(preview){if(m.photo_url){preview.src=m.photo_url;preview.classList.remove("hidden");}else{preview.src="";preview.classList.add("hidden");}}
 $("managementPhotoFile").dataset.existingUrl=m.photo_url||"";
 $("managementResponsibilities").value=m.responsibilities||"";
 $("managementOrder").value=Number(m.display_order||0);
 $("managementActive").checked=!!m.is_active;
 $("managementFormTitle").textContent="Edit Management Member";
 $("managementSaveButton").textContent="Update Member";
 $("managementName").focus();
}
async function saveManagementMember(){
 if(!requireMainAdmin())return;
 const name=$("managementName").value.trim();
 const position=$("managementPosition").value.trim();
 const photoInput=$("managementPhotoFile");
 const photoFile=photoInput?.files?.[0]||null;
 if(!name||!position)return msg("সদস্যের নাম ও পদবি লিখুন।","error");
 let photoUrl=photoInput?.dataset?.existingUrl||managementMembers.find(m=>String(m.id)===editingManagementId)?.photo_url||null;
 if(photoFile){
   if(!photoFile.type.startsWith("image/"))return msg("শুধু Image file নির্বাচন করুন।","error");
   if(photoFile.size>5*1024*1024)return msg("ছবির সাইজ 5MB-এর মধ্যে রাখুন।","error");
   const ext=(photoFile.name.split(".").pop()||"jpg").toLowerCase().replace(/[^a-z0-9]/g,"")||"jpg";
   const path=`management/${me.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
   const upload=await db.storage.from("management-photos").upload(path,photoFile,{upsert:false,contentType:photoFile.type});
   if(upload.error)return msg("ছবি Upload হয়নি: "+upload.error.message+"। Storage SQL চালানো হয়েছে কি না দেখুন।","error");
   photoUrl=db.storage.from("management-photos").getPublicUrl(path).data.publicUrl;
 }
 const payload={
   name,position,
   department:$("managementDepartment").value.trim(),
   photo_url:photoUrl,
   responsibilities:$("managementResponsibilities").value.trim(),
   display_order:Number($("managementOrder").value||0),
   is_active:$("managementActive").checked
 };
 const result=editingManagementId
   ? await db.from("management_members").update(payload).eq("id",editingManagementId)
   : await db.from("management_members").insert({...payload,created_by:me.id});
 if(result.error)return msg("Management Member Save Error: "+result.error.message+" — Supabase migration চালানো হয়েছে কি না দেখুন।","error");
 msg(editingManagementId?"Management Member update হয়েছে।":"নতুন Management Member যোগ হয়েছে।","success");
 resetManagementForm();
 await loadAll();
}
async function deleteManagementMember(id){
 if(!requireMainAdmin())return;
 const m=managementMembers.find(x=>String(x.id)===String(id));
 if(!m||!confirm("এই Management Member-কে delete করবেন?"))return;
 const {error}=await db.from("management_members").delete().eq("id",id);
 if(error)return msg("Delete করা যায়নি: "+error.message,"error");
 msg("Management Member delete হয়েছে।","success");
 await loadAll();
}

// Main Render Function

async function loadMyProfileRequests(){
 const box=$("myProfileRequests");if(!box||!me)return;
 const {data,error}=await db.from("profile_edit_requests").select("id,status,admin_note,created_at").eq("player_id",me.id).order("created_at",{ascending:false}).limit(5);
 if(error){box.innerHTML='<small class="muted">Request status load করা যায়নি।</small>';return;}
 box.innerHTML=(data||[]).map(r=>'<div class="item"><div class="grow"><b>Profile Edit Request</b><small>'+esc(r.status.toUpperCase())+' · '+new Date(r.created_at).toLocaleString()+(r.admin_note?' · '+esc(r.admin_note):'')+'</small></div><span class="pill '+(r.status==="approved"?"":"gold")+'">'+esc(r.status)+'</span></div>').join("")||'<small class="muted">এখনো কোনো Edit Request নেই।</small>';
}
function ensurePlayerApprovalPanel(){
 if(String(role).toLowerCase()!=="admin")return;
 const area=$("adminArea");if(!area)return;
 if(!$("playerApprovalPanel"))area.insertAdjacentHTML("afterbegin",'<div class="card" id="playerApprovalPanel" style="margin-bottom:15px"><div class="head"><h3>Player Registration & Profile Approval</h3><span class="pill gold">Main Admin Only</span></div><p class="muted">Player-এর Profile Edit Request অনুমোদন বা বাতিল করুন। প্রয়োজন হলে Player-কে Remove করুন।</p><div id="profileEditRequestList" class="list"></div><div class="head"><h3>Registered Players</h3></div><div id="adminRegisteredPlayers" class="list"></div></div>');
 loadProfileApprovalPanel();
}
async function loadProfileApprovalPanel(){
 if(String(role).toLowerCase()!=="admin")return;
 const reqBox=$("profileEditRequestList"),playerBox=$("adminRegisteredPlayers");if(!reqBox||!playerBox)return;
 const {data:requests,error}=await db.from("profile_edit_requests").select("*").eq("status","pending").order("created_at",{ascending:true});
 if(error)reqBox.innerHTML='<div class="notice error">'+esc(error.message)+'</div>';
 else reqBox.innerHTML=(requests||[]).map(r=>{const p=players.find(x=>String(x.id)===String(r.player_id))||{},d=r.requested_data||{};return '<div class="item"><div class="grow"><b>'+esc(p.display_name||d.display_name||"Player")+'</b><small>Name: '+esc(d.display_name||"—")+' · Device: '+esc(d.device||"—")+' · User ID: '+esc(d.efootball_id||"—")+' · Club: '+esc(d.club_name||"—")+'</small></div><button class="btn green" onclick="reviewProfileRequest(\''+r.id+'\',true)">Approve</button><button class="btn light" onclick="reviewProfileRequest(\''+r.id+'\',false)">Reject</button></div>';}).join("")||'<div class="empty">কোনো Pending Profile Request নেই।</div>';
 playerBox.innerHTML=players.map(p=>'<div class="item">'+(p.avatar_url?'<img src="'+esc(p.avatar_url)+'" style="width:42px;height:42px;object-fit:cover;border-radius:50%">':'<div class="avatar">👤</div>')+'<div class="grow"><b>'+esc(p.display_name||"Player")+'</b><small>'+esc(p.efootball_id||"")+' · '+esc(p.club_name||"")+'</small></div><button class="btn danger" onclick="removeRegisteredPlayer(\''+p.id+'\')">Remove</button></div>').join("")||'<div class="empty">কোনো Active Player নেই।</div>';
}
async function reviewProfileRequest(id,approve){
 if(!requireMainAdmin())return;
 const {data:r,error}=await db.from("profile_edit_requests").select("*").eq("id",id).eq("status","pending").maybeSingle();
 if(error||!r)return msg(error?.message||"Request পাওয়া যায়নি।","error");
 if(approve){
  const d=r.requested_data||{},allowed={display_name:d.display_name,efootball_id:d.efootball_id,device:d.device,club_name:d.club_name,avatar_url:d.avatar_url};
  Object.keys(allowed).forEach(k=>{if(allowed[k]===undefined)delete allowed[k];});
  const {error:updateError}=await db.from("profiles").update(allowed).eq("id",r.player_id);
  if(updateError)return msg("Profile approve হয়নি: "+updateError.message,"error");
 }
 const {error:reviewError}=await db.from("profile_edit_requests").update({status:approve?"approved":"rejected",reviewed_by:me.id,reviewed_at:new Date().toISOString()}).eq("id",id);
 if(reviewError)return msg(reviewError.message,"error");
 msg(approve?"Profile Edit অনুমোদন হয়েছে।":"Profile Edit Request বাতিল হয়েছে।","success");await loadAll();
}
async function removeRegisteredPlayer(id){
 if(!requireMainAdmin())return;
 if(!confirm("এই Player-কে Website থেকে Remove করতে চাও?"))return;
 const {error}=await db.from("profiles").update({is_active:false}).eq("id",id);
 if(error)return msg("Player Remove হয়নি: "+error.message,"error");
 msg("Player Website থেকে Remove করা হয়েছে।","success");await loadAll();
}

function renderHomePlayer(p){
 const initial=esc((p.display_name||'?')[0].toUpperCase());
 const photo=p.avatar_url?'<img src="'+esc(p.avatar_url)+'" alt="'+esc(p.display_name||'Player')+' photo" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'grid\'">':'';
 return '<div class="item home-player-item"><div class="home-player-avatar">'+photo+'<span '+(p.avatar_url?'style="display:none"':'')+'>'+initial+'</span></div><div class="grow"><b>'+esc(p.display_name||'Player')+'</b><small>'+esc(p.club_name||'Ancestor of Sylhet')+' · '+esc(p.efootball_id||'')+'</small></div><span class="pill">Player</span></div>';
}
function render() {
  renderTournamentCardMaker();
  renderPublicPlayers();
  renderTeamDirectory();
  ensurePlayerApprovalPanel();
  renderAwards();
  renderManagement();
  setupPlayerStatsAdminUI();
  setupAuctionTournamentSelect();
  setupAuctionArenaTournamentSelect();
  setupAuctionProfileSelect();
  renderAuctionControlPanel();

  populateTournamentSelects();
  setupTeamManagement();

 setupMemberAssignmentSelects();
renderTeamMemberList(); fillSelect(
    "resultMatch",
    matches,
    "-- Select Match --",
    m => m.id,
    m => `${m.home?.name || "Team"} vs ${m.away?.name || "Team"} | Round ${m.round_no} | ${m.stage || "League"}`
  );

$("nT").textContent=tournaments.length;
$("nP").textContent=players.length;
$("nM").textContent=matches.length;
const recentMatches=[...matches].sort((x,y)=>new Date(y.played_at||y.created_at||0)-new Date(x.played_at||x.created_at||0)).slice(0,5);
$("homeMatches").innerHTML=recentMatches.map(m=>`<div class="item"><div class="grow"><b>${esc(m.home?.name||"TBD")} vs ${esc(m.away?.name||"TBD")}</b><small>Round ${m.round_no||"—"} · ${esc(m.status||"scheduled")}</small></div><b>${m.home_score??"—"} : ${m.away_score??"—"}</b></div>`).join("")||'<div class="empty">এখনো কোনো Match/Fixture যোগ করা হয়নি।</div>';
const recentPlayers=[...players].filter(p=>p.display_name).slice(0,5);
$("homePlayers").innerHTML=recentPlayers.map(renderHomePlayer).join("")||'<div class="empty">এখনো কোনো Player Register করেনি।</div>';
const tc=tournaments.map(t=>`<div class="card"><span class="pill">${esc(t.type||"Tournament")}</span><h3>${esc(t.name)}</h3><p class="muted">${esc(t.season||"")} · ${esc(t.status||"")}</p><p class="muted">Entry: ${Number(t.entry_fee||0)} · Max: ${t.max_participants||"—"}</p><button class="btn" onclick="openTournament('${t.id}')">Open Tournament</button>${role==="admin"||role==="moderator"?` <button class="btn light" onclick="deleteTournament('${t.id}')">Delete</button>`:""}</div>`).join("")||'<div class="empty">এখনো Tournament নেই</div>';$('homeTours').innerHTML=tc;$('tourList').innerHTML=tc;

$("playerList").innerHTML=players.map((p,i)=>`<div class="item"><div class="avatar">${esc((p.display_name||"?")[0])}</div><div class="grow"><b>${esc(p.display_name||"Player")}</b><small>${esc(p.club_name||"")} · ${esc(p.efootball_id||"")}</small></div><span class="pill">${esc(p.role||"player")}</span></div>`).join("")||'<div class="empty">কোনো Player নেই</div>';

$("matchList").innerHTML=matches.map(m=>`<div class="item"><div class="grow"><b>${esc(m.home?.name||"TBD")} vs ${esc(m.away?.name||"TBD")}</b><small>Round ${m.round_no} · ${esc(m.status)}</small></div><b>${m.home_score??"—"} : ${m.away_score??"—"}</b><small>${m.stage||"League"}</small></div>`).join("")||'<div class="empty">Fixture তৈরি হয়নি</div>';

$("standingList").innerHTML=`<div class="tablewrap"><table><thead><tr><th>#</th><th>Team</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GF</th><th>GA</th><th>GD</th><th>Pts</th></tr></thead><tbody>${standings.map((s,i)=>`<tr><td>${i+1}</td><td>${esc(s.team?.name||"")}</td><td>${s.played}</td><td>${s.won}</td><td>${s.drawn}</td><td>${s.lost}</td><td>${s.goals_for}</td><td>${s.goals_against}</td><td>${s.goal_difference}</td><td><b>${s.points}</b></td></tr>`).join("")}</tbody></table></div>`;

// AUCTION ARENA
const arenaPlayers = auctionTournamentId
  ? auctionPlayers.filter(a =>
      String(a.tournament_id) === String(auctionTournamentId)
    ).sort((a,b)=>(Number(a.serial_no||999999)-Number(b.serial_no||999999))||new Date(a.created_at)-new Date(b.created_at))
  : [];
const activeLotId=auctionRoom?.current_player_id||"";
const roomLive=auctionRoom?.room_status==="live";
const auctionStaff=["admin","moderator"].includes(String(role).toLowerCase());

$("auctionList").innerHTML = !auctionTournamentId
  ? '<div class="empty">আগে Auction Tournament নির্বাচন করুন।</div>'
  : arenaPlayers.map(a=>{

  const bids=auctionBids
    .filter(b=>String(b.auction_player_id)===String(a.id))
    .sort((x,y)=>Number(y.amount)-Number(x.amount));

  const highestBid=bids[0]||null;
  const isActiveLot=roomLive&&String(activeLotId)===String(a.id);
  const canBidTeams=auctionTeams.filter(t=>{const cfg=auctionTeamSettings.find(x=>String(x.team_id)===String(t.id));return auctionStaff||!!cfg&&(String(cfg.captain_id||"")===String(me?.id||"")||String(cfg.manager_id||"")===String(me?.id||""));});

  const bidHistory=bids.slice(0,5).map((b,i)=>`
    <div class="muted" style="font-size:12px;margin-top:5px">
      ${i+1}. ${esc(b.team?.name||"Team")}
      — <b>${Number(b.amount).toLocaleString()}</b>
    </div>
  `).join("");

  const teamOptions = canBidTeams.map(t => { const cfg=auctionTeamSettings.find(x=>String(x.team_id)===String(t.id))||{}; return '<option value="'+esc(t.id)+'">'+esc(t.name)+' · Budget '+Number(cfg.budget_remaining??t.budget??0).toLocaleString()+'</option>'; }).join("");

  return `
    <div class="item" style="display:block;margin-bottom:12px">

      <div style="display:flex;align-items:center;gap:10px">
        ${a.profile?.avatar_url?`<img src="${esc(a.profile.avatar_url)}" alt="Player Photo" style="width:68px;height:68px;object-fit:cover;border-radius:14px">`:'<div class="avatar" style="width:68px;height:68px;border-radius:14px">👤</div>'}

        <div class="grow">
          <b>${a.serial_no?"#"+a.serial_no+" · ":""}${esc(a.profile?.display_name||"Auction Player")}</b>
          <small style="display:block">Device: ${esc(a.profile?.device||"Not Added")}</small>
          <small style="display:block">User ID: ${esc(a.profile?.efootball_id||"N/A")}</small>
        </div>

        <span class="pill">
          ${esc(a.status)}
        </span>
      </div>

      <div style="margin-top:12px">
        <div class="muted">
          Base Price:
          <b>${Number(a.base_price||0).toLocaleString()}</b>
        </div>

        <div style="margin-top:5px">
          Highest Bid:
          <b style="color:#16a34a">
            ${highestBid
              ? Number(highestBid.amount).toLocaleString()
              : "No Bid"}
          </b>
        </div>

        ${highestBid?`
          <small class="muted">
            Highest bidder: ${esc(highestBid.team?.name||"Team")}
          </small>
        `:""}
      </div>

      ${a.status==="available"?`

        <div style="display:flex;gap:7px;flex-wrap:wrap;margin-top:12px">

          <select
            id="team-${a.id}"
            style="flex:1;min-width:140px"
            ${canBidTeams.length === 0 ? "disabled" : ""}
          >
            <option value="">
              ${canBidTeams.length ? "Your Team" : "Captain/Manager Access নেই"}
            </option>
            ${teamOptions}
          </select>

          ${isActiveLot && canBidTeams.length ? `<button class="btn" onclick="placeBid('${a.id}',$('team-${a.id}').value)">Place Bid</button>` : `<small class="muted">Admin এই Player-কে Live করলে Bid শুরু হবে।</small>`}

          ${["admin","moderator"].includes(role)&&isActiveLot&&Number(auctionRoom?.call_stage||0)>=4?`<button class="btn green" onclick="buyPlayer('${a.id}',$('team-${a.id}').value)">SOLD</button>`:""}
          ${["admin","moderator"].includes(role)&&isActiveLot&&bids.length===0?`<button class="btn light" onclick="markAuctionUnsold('${a.id}')">Mark Unsold</button>`:""}

        </div>

      `:`
        <div style="margin-top:10px">
          <span class="pill">
            Sold To: ${esc(a.team?.name||"Unknown Team")}
          </span>
          <p class="muted">
            Sold Price: ${Number(a.sold_price||0).toLocaleString()} pts
          </p>
        </div>
      `}

      ${bids.length?`
        <details style="margin-top:12px">
          <summary style="cursor:pointer">
            Bid History (${bids.length})
          </summary>
          ${bidHistory}
        </details>
      `:`
        <small class="muted" style="display:block;margin-top:10px">
          এখনো কোনো Bid জমা হয়নি।
        </small>
      `}

    </div>
  `;
}).join("") || '<div class="empty">এই Tournament-এর Auction Pool খালি।</div>';


// ADMIN AUCTION PLAYER LIST
$("adminAuction").innerHTML=auctionPlayers.map(a=>`
  <div class="item">
    <div class="grow">
      <b>${esc(a.profile?.display_name||"Player")}</b>
      <small>
        Base: ${Number(a.base_price||0).toLocaleString()}
        · ${esc(a.status)}
      </small>
    </div>
  </div>
`).join("")||'<div class="empty">কোনো Auction Player নেই</div>';

$("champList").innerHTML = champions.map(c => `
  <div class="card">
    <span class="pill gold">🏆 CHAMPION</span>
    <h3>${esc(c.winner_name)}</h3>
    <p class="muted">Champion</p>
    <hr>
    <span class="pill">🥈 RUNNER-UP</span>
    <h3>${esc(c.runner_up || "Not Available")}</h3>
    <p class="muted">${esc(c.tournament_name)}</p>
  </div>
`).join("") || '<div class="empty">Champion record এখনো নেই</div>';

$("adminGate").classList.toggle("hidden",["admin","moderator"].includes(role));$("adminArea").classList.toggle("hidden",!["admin","moderator"].includes(role));$("roleBadge").textContent=role;
renderPlayerDashboard();
if(me)loadMyProfileRequests();

const selectedBracketId = $("bracketTournament")?.value;

const knockoutMatches = matches.filter(m =>
  m.stage === "knockout" &&
  (!selectedBracketId || String(m.tournament_id) === String(selectedBracketId))
);

if (!knockoutMatches.length) {
  $("bracketView").innerHTML =
    '<div class="empty">Knockout bracket তৈরি হয়নি</div>';
} else {
  const grouped = {};

  knockoutMatches.forEach(m => {
    const round = Number(m.round_no);
    if (!grouped[round]) grouped[round] = [];
    grouped[round].push(m);
  });

  const roundNumbers = Object.keys(grouped)
    .map(Number)
    .sort((a, b) => a - b);

  $("bracketView").innerHTML = roundNumbers.map((round, index) => {
    const roundMatches = grouped[round];
    const count = roundMatches.length;
    const remaining = roundNumbers.length - index - 1;

    let title = `Round ${index + 1}`;

    if (remaining === 0) title = "FINAL";
    else if (remaining === 1) title = "SEMI FINAL";
    else if (remaining === 2) title = "QUARTER FINAL";
    else if (remaining === 3) title = "ROUND OF 16";

    return `
      <div class="round">
        <b>${title}</b>

        ${roundMatches.map(m => `
          <div class="match">
            <div>
              ${String(m.winner_team_id) === String(m.home_team_id) ? "🏆 " : ""}
              ${esc(m.home?.name || "TBD")}
              <b>${m.home_score ?? "—"}</b>
            </div>

            <div>
              ${String(m.winner_team_id) === String(m.away_team_id) ? "🏆 " : ""}
              ${esc(m.away?.name || "TBD")}
              <b>${m.away_score ?? "—"}</b>
            </div>

            <small>${esc(m.status)}</small>
          </div>
        `).join("")}
      </div>
    `;
  }).join("");
}

} // render() Function শেষ

async function deleteTournament(id) {
  if (!requireAdmin() || !confirm("এই tournament delete করবেন?")) return;

  const r = await db.from("tournaments").delete().eq("id", id);

  if (r.error) return msg(r.error.message, "error");

  await loadAll();
}

// Website Initialize
window.placeBid = placeBid;
window.buyPlayer = buyPlayer;

init();

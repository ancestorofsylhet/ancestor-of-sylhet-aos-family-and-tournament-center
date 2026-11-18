
/* AOS Tournament Center — Supabase client application */
const cfg=window.AOS_CONFIG||{};
const ready=!!(cfg.SUPABASE_URL&&cfg.SUPABASE_ANON_KEY&&!cfg.SUPABASE_URL.includes("YOUR_")&&!cfg.SUPABASE_ANON_KEY.includes("YOUR_"));
const db=ready?window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY):null;
let session=null,me=null,role="player",tournaments=[],teams=[],players=[],matches=[],standings=[],auctionPlayers=[],auctionBids=[],champions=[],auctionTeams=[];
let myParticipation=[];
let teamMembers=[];
let selectedTournamentId="";
let tournamentDetailTab="overview";
let selectedTournamentTeams=[];
let memberTournamentId="";
let memberTeamId="";let auctionTournamentId = "";
const $=id=>document.getElementById(id), msg=(s,type="notice")=>{$("globalMsg").innerHTML=`<div class="notice ${type}">${esc(s)}</div>`;setTimeout(()=>{$("globalMsg").innerHTML=""},6500)};
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function go(id){document.querySelectorAll(".page").forEach(x=>x.classList.add("hidden"));$(id).classList.remove("hidden");document.querySelectorAll(".bottom button").forEach(x=>x.classList.toggle("active",x.dataset.id===id));render();window.scrollTo(0,0)}
function openAuth(){$("authModal").classList.remove("hidden")}
function closeAuth(){$("authModal").classList.add("hidden")}
async function doAuth(mode){if(!db)return msg("আগে config.js-এ Supabase URL ও anon key বসান।","error");const email=$("authEmail").value.trim(),password=$("authPass").value;if(!email||!password)return msg("Email ও Password দিন।","error");const r=mode==="login"?await db.auth.signInWithPassword({email,password}):await db.auth.signUp({email,password});if(r.error)return msg(r.error.message,"error");if(mode==="signup"&&!r.data.session){msg("Account তৈরি হয়েছে। Email verification সম্পন্ন করে Login করুন।","success");return}session=r.data.session;closeAuth();await loadAll();msg("সফলভাবে Login হয়েছে।","success")}
async function logout(){await db.auth.signOut();session=null;me=null;role="player";await loadAll()}
async function init(){if(!ready){msg("Supabase এখনো সংযুক্ত নয়। ZIP-এর SETUP_GUIDE.md অনুসরণ করে config.js তৈরি করুন।");return}const {data}=await db.auth.getSession();session=data.session;db.auth.onAuthStateChange((_e,s)=>{session=s;setTimeout(loadAll,0)});await loadAll()}
async function loadAll(){if(!db)return;const {data:{user}}=await db.auth.getUser();me=user;if(user){let p=await db.from("profiles").select("*").eq("id",user.id).maybeSingle();role=p.data?.role||"player"}else role="player";$("userLabel").textContent=user?(user.email+" · "+role):"Guest";$("authBtn").textContent=user?"Logout":"Login";$("authBtn").onclick=user?logout:openAuth;
const [t,p,tm,m,st,a,b,ch]=await Promise.all([
  db.from("tournaments").select("*").order("created_at",{ascending:false}),
  db.from("profiles").select("id,display_name,efootball_id,device,club_name,role,avatar_url"),
  db.from("teams").select("*"),
  db.from("matches").select("*,home:teams!matches_home_team_id_fkey(name),away:teams!matches_away_team_id_fkey(name)").order("round_no"),
  db.from("standings").select("*,team:teams(name)").order("points",{ascending:false}),
  db.from("auction_players").select("*,profile:profiles(display_name,efootball_id),team:teams(name)").order("created_at",{ascending:false}),
  db.from("auction_bids").select("*,team:teams(name)").order("created_at",{ascending:false}),
  db.from("champions").select("*").order("created_at",{ascending:false})
]);

tournaments=t.data||[];
players=p.data||[];
teams=tm.data||[];
matches=m.data||[];
standings=st.data||[];
auctionPlayers=a.data||[];
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
    player:profiles(display_name,efootball_id,avatar_url)
  `);

if(memberError){
  console.error("Team Members Load Error:",memberError);
  teamMembers=[];
}else{
  teamMembers=memberData||[];
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

if(b.error){
  console.error("Auction bids loading error:",b.error);
  auctionBids=[];
}

render();
}
function requireAdmin(){if(!me||!["admin","moderator"].includes(role)){msg("এই কাজের জন্য Admin/Moderator permission প্রয়োজন।","error");return false}return true}
async function registerPlayer(){if(!me)return openAuth();let payload={id:me.id,display_name:$("pName").value.trim(),efootball_id:$("pEid").value.trim(),device:$("pDevice").value.trim(),club_name:$("pClub").value.trim()||"Ancestor of Sylhet"};if(!payload.display_name||!payload.efootball_id)return msg("Player Name ও eFootball ID দিন।","error");let r=await db.from("profiles").upsert(payload);if(r.error)return msg(r.error.message,"error");msg("Player profile submit হয়েছে।","success");await loadAll()}
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

async function loadAuctionTeams(tournamentId) {
  auctionTeams = [];

  if (!tournamentId) {
    render();
    return;
  }

  const { data, error } = await db
    .from("tournament_teams")
    .select("team_id, team:teams(id,name,budget)")
    .eq("tournament_id", tournamentId);

  if (error) {
    console.error("Auction Team Load Error:", error);
    msg("Auction Team Load Error: " + error.message, "error");
    render();
    return;
  }

  auctionTeams = (data || [])
    .map(row => row.team)
    .filter(team => team && team.id);

  console.log("Loaded Auction Teams:", auctionTeams);
  render();
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

  const player = auctionPlayers.find(
    a => String(a.id) === String(auctionPlayerId)
  );

  if (!player || player.status !== "available") {
    return msg("এই Player আর Available নেই।", "error");
  }

  const highestBid = auctionBids
    .filter(b => String(b.auction_player_id) === String(auctionPlayerId))
    .sort((a, b) => Number(b.amount) - Number(a.amount))[0];

  const suggestedPrice = highestBid
    ? Number(highestBid.amount)
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

  msg("Player সফলভাবে Sold হয়েছে!", "success");

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
    <div class="item">
      <div class="avatar">👤</div>

      <div class="grow">
        <b>${esc(m.player?.display_name||"Unknown Player")}</b>
        <small>eFootball ID: ${esc(m.player?.efootball_id||"Not Added")}</small>
      </div>

      ${["admin","moderator"].includes(role)?`
        <button class="btn danger"
          onclick="removeTeamMember('${m.id}')">
          Remove
        </button>
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
  if(!me) return openAuth();

  const payload={
    id:me.id,
    display_name:$("editPlayerName").value.trim(),
    efootball_id:$("editPlayerEid").value.trim(),
    device:$("editPlayerDevice").value.trim(),
    club_name:$("editPlayerClub").value.trim()||"Ancestor of Sylhet"
  };

  if(!payload.display_name || !payload.efootball_id){
    return msg("Player Name ও eFootball ID দিতে হবে।","error");
  }

  const {data:existing}=await db.from("profiles")
  .select("id").eq("id",me.id).maybeSingle();

const {error}=existing
  ? await db.from("profiles").update(payload).eq("id",me.id)
  : await db.from("profiles").insert(payload);

  if(error) return msg(error.message,"error");

  msg("Profile Update হয়েছে।","success");
  await loadAll();
}



async function uploadProfilePhoto(){



if(!me) return openAuth();

  if(!db) return msg("Supabase Connected নয়।","error");

  const file=$("profilePhotoFile")?.files?.[0];

  if(!file) return msg("আগে Photo নির্বাচন করুন।","error");

  if(!file.type.startsWith("image/"))
    return msg("শুধু Image File Upload করা যাবে।","error");

  if(file.size > 5*1024*1024)
    return msg("Photo সর্বোচ্চ 5 MB হতে পারবে।","error");

  try {
    msg("Photo Upload হচ্ছে...","notice");

    const extension=(file.name.split(".").pop()||"jpg").toLowerCase();
    const filePath=me.id+"/"+Date.now()+"."+extension;

    // Step 1: Storage-এ Photo Upload
    const {data:uploadData,error:uploadError}=await db.storage
      .from("avatars")
      .upload(filePath,file,{
        cacheControl:"3600",
        upsert:true,
        contentType:file.type
      });

    console.log("Upload Data:",uploadData);
    if(uploadError) throw uploadError;

    // Step 2: Public URL তৈরি
    const {data:urlData}=db.storage
      .from("avatars")
      .getPublicUrl(filePath);

    const avatarUrl=urlData?.publicUrl;

    console.log("Generated Avatar URL:",avatarUrl);

    if(!avatarUrl)
      throw new Error("Photo URL তৈরি হয়নি।");

    // Step 3: Profile Table-এ Save
    const {data:saveData,error:saveError}=await db
      .from("profiles")
      .update({avatar_url:avatarUrl})
      .eq("id",me.id)
      .select("id,display_name,avatar_url");

    console.log("Logged in User:",me.id);
    console.log("Profile Save Result:",saveData);
    console.log("Profile Save Error:",saveError);

    if(saveError) throw saveError;

    if(!saveData || saveData.length===0){
      throw new Error(
        "Profile Update হয়নি। Login ID: "+me.id+
        " — Supabase RLS অথবা Profile ID পরীক্ষা করতে হবে।"
      );
    }

    // Step 4: Profile পুনরায় Load
    await loadAll();

    // Step 5: Dashboard Refresh
    renderPlayerDashboard();

    msg("Profile Photo সফলভাবে Update হয়েছে!","success");

  } catch(error) {
    console.error("PHOTO UPLOAD ERROR:",error);
    msg("Photo Upload Error: "+error.message,"error");
  }
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
            <div style="display:flex;align-items:center;gap:8px;margin-top:7px">
              ${member.player?.avatar_url
                ? `<img src="${esc(member.player.avatar_url)}" alt="" style="width:30px;height:30px;object-fit:cover;border-radius:50%">`
                : `<span class="avatar">👤</span>`}
              <span>${esc(member.player?.display_name||"Unknown Player")}</span>
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
  const tabs=[['overview','Overview'],['teams','Teams'],['auction','Auction'],['matches','Fixtures & Results'],['table','Points Table'],['knockout','Knockout']];
  const nav=tabs.map(([k,label])=>`<button class="btn ${tournamentDetailTab===k?'':'light'}" style="margin:4px" onclick="setTournamentTab('${k}')">${label}</button>`).join('');
  let content='';
  if(tournamentDetailTab==='overview') content=`<div class="card"><h3>${esc(t.name)}</h3><p>Type: ${esc(t.type||'—')} · Season: ${esc(t.season||'—')}</p><p>Status: ${esc(t.status||'—')}</p><p>Entry Fee: ${Number(t.entry_fee||0)} · Maximum Teams/Players: ${t.max_participants||'—'}</p><p>Registered Teams: ${selectedTournamentTeams.length}</p></div>`;
  if(tournamentDetailTab==='teams') content=selectedTournamentTeams.map(x=>`<div class="item"><b>${esc(x.name)}</b><small>${esc(x.description||'')}</small></div>`).join('')||'<div class="empty">এই Tournament-এ এখনো Team যুক্ত হয়নি।</div>';
  if(tournamentDetailTab==='auction') content=ap.map(x=>`<div class="item"><b>${esc(x.profile?.display_name||'Player')}</b><small>${esc(x.status||'')} · Base Price: ${Number(x.base_price||0)}</small></div>`).join('')||'<div class="empty">এই Tournament-এর Auction Player পাওয়া যায়নি।</div>';
  if(tournamentDetailTab==='matches') content=tm.map(x=>`<div class="item"><b>${esc(x.home?.name||'TBD')} vs ${esc(x.away?.name||'TBD')}</b><small>Round ${x.round_no||'—'} · ${esc(x.status||'')}</small><b>${x.home_score??'—'} : ${x.away_score??'—'}</b></div>`).join('')||'<div class="empty">এই Tournament-এর Fixture তৈরি হয়নি।</div>';
  if(tournamentDetailTab==='table') content=st.map((x,i)=>`<div class="item"><b>${i+1}. ${esc(x.team?.name||'Team')}</b><small>P ${x.played??0} · W ${x.won??0} · D ${x.drawn??0} · L ${x.lost??0} · GD ${x.goal_difference??0} · Points ${x.points??0}</small></div>`).join('')||'<div class="empty">এই Tournament-এর Points Table পাওয়া যায়নি।</div>';
  if(tournamentDetailTab==='knockout') content=tm.filter(x=>String(x.stage||'').toLowerCase().includes('knockout')||String(x.stage||'').toLowerCase().includes('final')||String(x.stage||'').toLowerCase().includes('semi')).map(x=>`<div class="item"><b>${esc(x.home?.name||'TBD')} vs ${esc(x.away?.name||'TBD')}</b><small>${esc(x.stage||'Knockout')}</small><b>${x.home_score??'—'} : ${x.away_score??'—'}</b></div>`).join('')||'<div class="empty">Knockout fixture এখনো তৈরি হয়নি।</div>';
  panel.innerHTML=`<button class="btn light" onclick="closeTournament()">← Back to Events</button><div class="head"><h2>${esc(t.name)}</h2><span class="pill">${esc(t.status||'')}</span></div><div style="display:flex;flex-wrap:wrap;gap:4px;margin:12px 0">${nav}</div><div>${content}</div>`;
}

// Main Render Function
function render() {
  setupAuctionTournamentSelect();
  setupAuctionProfileSelect();

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

const tc=tournaments.map(t=>`<div class="card"><span class="pill">${esc(t.type||"Tournament")}</span><h3>${esc(t.name)}</h3><p class="muted">${esc(t.season||"")} · ${esc(t.status||"")}</p><p class="muted">Entry: ${Number(t.entry_fee||0)} · Max: ${t.max_participants||"—"}</p><button class="btn" onclick="openTournament('${t.id}')">Open Tournament</button>${role==="admin"||role==="moderator"?` <button class="btn light" onclick="deleteTournament('${t.id}')">Delete</button>`:""}</div>`).join("")||'<div class="empty">এখনো Tournament নেই</div>';$('homeTours').innerHTML=tc;$('tourList').innerHTML=tc;

$("playerList").innerHTML=players.map((p,i)=>`<div class="item"><div class="avatar">${esc((p.display_name||"?")[0])}</div><div class="grow"><b>${esc(p.display_name||"Player")}</b><small>${esc(p.club_name||"")} · ${esc(p.efootball_id||"")}</small></div><span class="pill">${esc(p.role||"player")}</span></div>`).join("")||'<div class="empty">কোনো Player নেই</div>';

$("matchList").innerHTML=matches.map(m=>`<div class="item"><div class="grow"><b>${esc(m.home?.name||"TBD")} vs ${esc(m.away?.name||"TBD")}</b><small>Round ${m.round_no} · ${esc(m.status)}</small></div><b>${m.home_score??"—"} : ${m.away_score??"—"}</b><small>${m.stage||"League"}</small></div>`).join("")||'<div class="empty">Fixture তৈরি হয়নি</div>';

$("standingList").innerHTML=`<div class="tablewrap"><table><thead><tr><th>#</th><th>Team</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GF</th><th>GA</th><th>GD</th><th>Pts</th></tr></thead><tbody>${standings.map((s,i)=>`<tr><td>${i+1}</td><td>${esc(s.team?.name||"")}</td><td>${s.played}</td><td>${s.won}</td><td>${s.drawn}</td><td>${s.lost}</td><td>${s.goals_for}</td><td>${s.goals_against}</td><td>${s.goal_difference}</td><td><b>${s.points}</b></td></tr>`).join("")}</tbody></table></div>`;

// AUCTION ARENA
$("auctionList").innerHTML=auctionPlayers.map(a=>{

  const bids=auctionBids
    .filter(b=>String(b.auction_player_id)===String(a.id))
    .sort((x,y)=>Number(y.amount)-Number(x.amount));

  const highestBid=bids[0]||null;

  const bidHistory=bids.slice(0,5).map((b,i)=>`
    <div class="muted" style="font-size:12px;margin-top:5px">
      ${i+1}. ${esc(b.team?.name||"Team")}
      — <b>${Number(b.amount).toLocaleString()}</b>
    </div>
  `).join("");

  const teamOptions = auctionTeams.map(t => `
  <option value="${esc(t.id)}"
    ${highestBid && String(highestBid.team_id) === String(t.id) ? "selected" : ""}>
    ${esc(t.name)} · Budget ${Number(t.budget || 0).toLocaleString()}
  </option>
`).join("");

  return `
    <div class="item" style="display:block;margin-bottom:12px">

      <div style="display:flex;align-items:center;gap:10px">
        <div class="avatar">⚽</div>

        <div class="grow">
          <b>${esc(a.profile?.display_name||"Auction Player")}</b>
          <small>
            eFootball ID: ${esc(a.profile?.efootball_id||"N/A")}
          </small>
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
            ${auctionTeams.length === 0 ? "disabled" : ""}
          >
            <option value="">
              ${auctionTeams.length ? "Select Team" : "আগে Tournament নির্বাচন করুন"}
            </option>
            ${teamOptions}
          </select>

          <button class="btn"
            onclick="placeBid('${a.id}',$('team-${a.id}').value)">
            Bid
          </button>

          ${["admin","moderator"].includes(role)?`
            <button class="btn green"
              onclick="buyPlayer('${a.id}',$('team-${a.id}').value)">
              Sold
            </button>
          `:""}

        </div>

      `:`
        <div style="margin-top:10px">
          <span class="pill">
            Sold To: ${esc(a.team?.name||"Unknown Team")}
          </span>
          <p class="muted">
            Sold Price: ${Number(a.sold_price||0).toLocaleString()}
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
}).join("")||'<div class="empty">Auction pool খালি</div>';


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

$("adminAuction").innerHTML=auctionPlayers.map(a=>`<div class="item"><div class="grow"><b>${esc(a.profile?.display_name||"Player")}</b><small>${a.base_price} · ${esc(a.status)}</small></div></div>`).join("");

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
init();

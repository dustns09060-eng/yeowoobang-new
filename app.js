const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
let entryToken=sessionStorage.getItem("matchV21Entry")||"";
let token=localStorage.getItem("matchV21Token")||"";
let me=null, period=null, adminRows=[], installPrompt=null;

const api=async(action,data={})=>{
  const r=await fetch(window.APP_CONFIG.apiUrl,{
    method:"POST",
    headers:{"Content-Type":"text/plain;charset=utf-8"},
    body:JSON.stringify({action,...data})
  });
  const j=await r.json();
  if(!j.ok) throw Error(j.message||"오류가 발생했습니다.");
  return j;
};

const toast=t=>{
  const x=$("#toast");
  x.textContent=t;
  x.classList.remove("hidden");
  setTimeout(()=>x.classList.add("hidden"),2200);
};

async function entryLogin(){
  $("#entryMsg").textContent="";
  try{
    const j=await api("entryLogin",{password:$("#entryPassword").value});
    entryToken=j.entryToken;
    sessionStorage.setItem("matchV21Entry",entryToken);
    $("#entryScreen").classList.add("hidden");
    $("#identityScreen").classList.remove("hidden");
  }catch(e){
    $("#entryMsg").textContent=e.message;
  }
}

async function identify(){
  $("#identityMsg").textContent="";
  try{
    const j=await api("identify",{entryToken,instagramId:$("#identityInstagram").value});
    token=j.token;
    me=j.member;
    localStorage.setItem("matchV21Token",token);
    showApp();
    await boot();
  }catch(e){
    $("#identityMsg").textContent=e.message;
  }
}

function showApp(){
  $("#entryScreen").classList.add("hidden");
  $("#identityScreen").classList.add("hidden");
  $("#app").classList.remove("hidden");
  $("#adminBtn").classList.toggle("hidden",!me.isStaff);
  $("#myInfo").innerHTML=`
    <p><b>${me.nickname}</b></p>
    <p>@${me.instagramId}</p>
    ${me.no?`<p>맞팔리스트 번호 ${me.no}</p>`:""}
    <p>권한 ${me.role||"일반회원"}</p>`;
}

async function resume(){
  if(!token) return;
  try{
    const j=await api("session",{token});
    me=j.member;
    showApp();
    await boot();
  }catch(e){
    localStorage.removeItem("matchV21Token");
    token="";
  }
}

async function boot(){
  const j=await api("bootstrap",{token});
  period=j.period;
  $("#noticeContent").textContent=j.notice||"등록된 공지가 없습니다.";
  renderPeriod();
}

function renderPeriod(){
  const open=!!period?.open;
  $("#periodBadge").textContent=open?"진행중":"기간 아님";
  $("#periodText").textContent=period?.label||"현재 맞팔확인 기간이 아닙니다.";

  $("#doneVote").disabled=!open||me?.isStaff;
  $("#delayVote").disabled=!open||me?.isStaff;
  $("#zipInput").disabled=!open;
  $("#analyzeBtn").disabled=!open;

  $("#analysisGuide").textContent=open
    ?"맞팔확인 기간입니다. 인스타그램 ZIP 파일을 선택해주세요."
    :"맞팔확인 기간이 시작되면 분석 기능도 함께 열립니다.";

  $("#voteState").textContent=me?.isStaff
    ?"운영진 계정은 투표 대상이 아닙니다."
    :period?.myVote
      ?`제출 완료: ${period.myVote}`
      :open
        ?"완료 또는 지연을 선택해주세요."
        :"기간이 시작되면 투표할 수 있어요.";
}

async function vote(status){
  try{
    const j=await api("vote",{token,status});
    toast(j.message);
    await boot();
  }catch(e){toast(e.message)}
}

async function adminLogin(){
  $("#adminMsg").textContent="";
  try{
    const j=await api("adminLogin",{token,password:$("#adminPw").value});
    $("#adminAuth").classList.add("hidden");
    $("#adminPanel").classList.remove("hidden");
    $("#adminRole").textContent=`${j.role} · ${j.name}`;
    await adminLoad();
  }catch(e){
    $("#adminMsg").textContent=e.message;
  }
}

async function adminLoad(){
  const j=await api("adminDashboard",{token,adminKey:$("#adminPw").value});
  $("#periodStart").value=j.start||"";
  $("#periodEnd").value=j.end||"";
  $("#adminStats").textContent=`전체 ${j.stats.total}명 · 완료 ${j.stats.done} · 지연 ${j.stats.delay} · 미제출 ${j.stats.missing}`;
  adminRows=j.rows;
  $("#adminVotes").innerHTML=j.rows.map(x=>`
    <div class="list-row">
      <span><b>${x.no}. ${x.nickname}</b><small>@${x.instagramId}</small></span>
      <em>${x.status}</em>
    </div>`).join("");
}

async function changeEntryPassword(){
  try{
    const j=await api("adminChangeEntryPassword",{
      token,
      adminKey:$("#adminPw").value,
      currentPassword:$("#currentEntryPw").value,
      newPassword:$("#newEntryPw").value,
      confirmPassword:$("#confirmEntryPw").value
    });
    toast(j.message);
    $("#currentEntryPw").value="";
    $("#newEntryPw").value="";
    $("#confirmEntryPw").value="";
  }catch(e){toast(e.message)}
}

async function savePeriod(){
  try{
    const j=await api("savePeriod",{
      token,
      adminKey:$("#adminPw").value,
      start:$("#periodStart").value,
      end:$("#periodEnd").value
    });
    toast(j.message);
    await adminLoad();
    await boot();
  }catch(e){toast(e.message)}
}

function copyStatus(status){
  const text=adminRows
    .filter(x=>x.status===status)
    .map(x=>`${x.nickname}\t@${x.instagramId}`)
    .join("\n");
  navigator.clipboard.writeText(text);
  toast(text?`${status} 명단을 복사했습니다.`:`${status} 회원이 없습니다.`);
}

async function searchMembers(){
  try{
    const j=await api("adminMemberSearch",{
      token,
      adminKey:$("#adminPw").value,
      query:$("#memberQuery").value
    });
    $("#memberResults").innerHTML=j.rows.map(x=>`
      <div class="list-row">
        <span><b>${x.no}. ${x.nickname}</b><small>@${x.instagramId}</small></span>
        <em>${x.voteStatus}</em>
      </div>`).join("")||'<p class="muted">검색 결과가 없습니다.</p>';
  }catch(e){toast(e.message)}
}

async function saveNotice(){
  try{
    const j=await api("adminSaveNotice",{
      token,
      adminKey:$("#adminPw").value,
      title:$("#noticeTitle").value,
      content:$("#noticeBody").value
    });
    toast(j.message);
    await boot();
  }catch(e){toast(e.message)}
}

async function loadLogs(){
  try{
    const j=await api("adminLogs",{token,adminKey:$("#adminPw").value});
    $("#logList").innerHTML=j.rows.map(x=>`
      <div class="log-row">
        <small>${x.date}</small><b>${x.action}</b><span>${x.detail}</span>
      </div>`).join("")||'<p class="muted">로그가 없습니다.</p>';
  }catch(e){toast(e.message)}
}

$("#entryBtn").onclick=entryLogin;
$("#entryPassword").onkeydown=e=>{if(e.key==="Enter")entryLogin()};
$("#identityBtn").onclick=identify;
$("#identityInstagram").onkeydown=e=>{if(e.key==="Enter")identify()};
$("#entryBackBtn").onclick=()=>{
  sessionStorage.removeItem("matchV21Entry");
  entryToken="";
  $("#identityScreen").classList.add("hidden");
  $("#entryScreen").classList.remove("hidden");
};

$("#doneVote").onclick=()=>vote("완료");
$("#delayVote").onclick=()=>vote("지연");

$("#analyzeBtn").onclick=()=>{
  if(!period?.open) return toast("현재 맞팔확인 기간이 아닙니다.");
  toast("ZIP 맞팔분석 모듈 연결 위치입니다.");
};

$("#adminBtn").onclick=()=>$("#adminAuth").classList.remove("hidden");
$("#adminLoginBtn").onclick=adminLogin;
$("#changeEntryPwBtn").onclick=changeEntryPassword;
$("#savePeriodBtn").onclick=savePeriod;
$("#copyDelay").onclick=()=>copyStatus("지연");
$("#copyMissing").onclick=()=>copyStatus("미제출");
$("#memberSearchBtn").onclick=searchMembers;
$("#saveNoticeBtn").onclick=saveNotice;
$("#loadLogsBtn").onclick=loadLogs;

$("#moreBtn").onclick=()=>$("#moreMenu").classList.remove("hidden");
$("#myBtn").onclick=()=>$("#myModal").classList.remove("hidden");
$("#logoutBtn").onclick=()=>{
  localStorage.removeItem("matchV21Token");
  sessionStorage.removeItem("matchV21Entry");
  location.reload();
};

$$("[data-close]").forEach(b=>b.onclick=()=>$("#"+b.dataset.close).classList.add("hidden"));

window.addEventListener("beforeinstallprompt",e=>{
  e.preventDefault();
  installPrompt=e;
});

$("#installBtn").onclick=async()=>{
  if(installPrompt){
    installPrompt.prompt();
    await installPrompt.userChoice;
    installPrompt=null;
  }else{
    alert(/iphone|ipad|ipod/i.test(navigator.userAgent)
      ?"Safari 공유 → 홈 화면에 추가를 눌러주세요."
      :"브라우저 메뉴에서 앱 설치/홈 화면에 추가를 선택해주세요.");
  }
};

resume();

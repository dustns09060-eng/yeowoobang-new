const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const API=()=>window.YW_CONFIG.API_URL; let token=localStorage.getItem("yw:new:token")||"", me=null, members=[], progress=Number(localStorage.getItem("yw:new:progress")||0), period=null;
function toast(m){let t=$("#toast");t.textContent=m;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),1700)}
async function api(action,data={}){if(API().includes("PASTE_"))throw Error("config.js에 새 Apps Script /exec 주소를 입력해주세요.");let r=await fetch(API(),{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify({action,...data})});let j=await r.json();if(!j.ok)throw Error(j.message||"요청 실패");return j}
function norm(v){return String(v||"").trim().replace(/^@+/,"").toLowerCase()}
async function login(){try{$("#loginBtn").disabled=true;let j=await api("login",{instagramId:norm($("#loginId").value),password:$("#loginPw").value});token=j.token;me=j.member;localStorage.setItem("yw:new:token",token);await enter()}catch(e){$("#loginMsg").textContent=e.message}finally{$("#loginBtn").disabled=false}}
async function enter(){if(!me){let j=await api("session",{token});me=j.member}$("#loginScreen").classList.add("hidden");$("#app").classList.remove("hidden");$("#adminBtn").classList.toggle("hidden",!me.isStaff);$("#myInfo").innerHTML=`<p><b>${me.nickname}</b></p><p>@${me.instagramId}</p>${String(me.memberId||"").startsWith("STAFF:")?"":`<p>MemberID ${me.memberId}</p>`}<p>권한 ${me.role||"일반회원"}</p>`;let d=await api("bootstrap",{token});members=d.members;period=d.period;renderMembers();renderPeriod();$("#noticeContent").textContent=d.notice||"등록된 공지가 없습니다."}
async function restore(){if(!token)return;try{let j=await api("session",{token});me=j.member;await enter()}catch(e){localStorage.removeItem("yw:new:token");token=""}}
function renderMembers(){let q=norm($("#searchInput").value), list=members.filter(x=>!q||String(x.no).includes(q)||x.nickname.toLowerCase().includes(q)||x.instagramId.includes(q));$("#followList").innerHTML=list.map((x,i)=>`<div class="member ${x.no<=progress?"done":""}"><div><b>${x.no}. ${x.nickname}</b><br><small>@${x.instagramId}</small></div><a href="https://www.instagram.com/${x.instagramId}/" target="_blank" rel="noopener">인스타</a></div>`).join("");let pct=members.length?Math.min(100,Math.round(progress/members.length*100)):0;$("#progressText").textContent=`진행률 ${pct}% · ${progress}/${members.length}`}
function renderPeriod(){
  const open=!!period?.open;
  const label=period?.label||"현재 맞팔확인 기간이 아닙니다.";

  // 맞팔투표
  $("#matchBadge").textContent=open?"진행중":"기간 아님";
  $("#matchPeriodText").textContent=label;
  $("#doneVote").disabled=!open || !!me?.isStaff;
  $("#delayVote").disabled=!open || !!me?.isStaff;
  $("#voteState").textContent=me?.isStaff
    ? "운영진 계정은 맞팔투표 대상이 아닙니다."
    : (period?.myVote
      ? `제출 완료: ${period.myVote}`
      : (open?"완료 또는 지연을 선택해주세요.":"기간이 시작되면 투표할 수 있어요."));

  // 맞팔분석 - 맞팔투표와 동일한 기간을 사용
  $("#analysisBadge").textContent=open?"진행중":"기간 아님";
  $("#analysisPeriodText").textContent=open?label:"현재 맞팔확인 기간이 아닙니다.";
  $("#zipInput").disabled=!open;
  $("#analyzeBtn").disabled=!open;
  $("#analysisCard").classList.toggle("period-locked-card",!open);
  $("#analysisCard").classList.toggle("period-open-card",open);
  $("#analysisLockedGuide").textContent=open
    ?"✅ 맞팔확인 기간입니다. ZIP 파일을 선택해 분석할 수 있어요."
    :"🔒 맞팔확인 기간이 시작되면 맞팔분석도 함께 열립니다.";
}
async function vote(status){try{let j=await api("vote",{token,status});period.myVote=j.status;renderPeriod();toast(j.message)}catch(e){toast(e.message)}}
function view(id){$$(".view").forEach(v=>v.classList.add("hidden"));$("#"+id).classList.remove("hidden");$$("nav button").forEach(b=>b.classList.toggle("active",b.dataset.view===id))}
async function adminLogin(){try{let j=await api("adminLogin",{token,password:$("#adminPw").value});$("#adminModal").classList.add("hidden");$("#adminPanel").classList.remove("hidden");await adminLoad()}catch(e){$("#adminMsg").textContent=e.message}}
async function adminLoad(){let j=await api("adminDashboard",{token,adminKey:$("#adminPw").value});$("#periodStart").value=j.start||"";$("#periodEnd").value=j.end||"";$("#adminStats").innerHTML=`전체 ${j.stats.total}명 · 완료 ${j.stats.done} · 지연 ${j.stats.delay} · 미제출 ${j.stats.missing}`;$("#adminVotes").innerHTML=j.rows.map(x=>`<div class="member"><span>${x.nickname} @${x.instagramId}</span><b>${x.status}</b></div>`).join("");window._adminRows=j.rows}
async function savePeriod(){try{await api("savePeriod",{token,adminKey:$("#adminPw").value,start:$("#periodStart").value,end:$("#periodEnd").value});toast("맞팔확인 기간 저장 완료");let d=await api("bootstrap",{token});period=d.period;renderPeriod();await adminLoad()}catch(e){toast(e.message)}}
function copyStatus(st){let t=(window._adminRows||[]).filter(x=>x.status===st).map(x=>`${x.nickname}\t@${x.instagramId}`).join("\n");navigator.clipboard.writeText(t);toast(t?"명단 복사 완료":"해당 회원이 없어요")}
$("#loginBtn").onclick=login;$("#loginPw").onkeydown=e=>{if(e.key==="Enter")login()};$("#findPwBtn").onclick=()=>alert("통합프로그램의 비밀번호 찾기 기능을 이용해주세요.");$("#searchInput").oninput=renderMembers;
$("#copy40").onclick=()=>{let s=members.filter(x=>x.no>progress).slice(0,40);navigator.clipboard.writeText(s.map(x=>`@${x.instagramId}`).join("\n"));if(s.length){progress=s[s.length-1].no;localStorage.setItem("yw:new:progress",progress);renderMembers()}toast(`${s.length}명 복사 완료`)};
$("#next40").onclick=()=>{progress=Math.min(members.length,progress+40);localStorage.setItem("yw:new:progress",progress);renderMembers()};$("#resetProgress").onclick=()=>{progress=0;localStorage.setItem("yw:new:progress","0");renderMembers()};
$("#doneVote").onclick=()=>vote("완료");$("#delayVote").onclick=()=>vote("지연");$("#analyzeBtn").onclick=()=>{
  if(!period?.open) return toast("현재 맞팔확인 기간이 아닙니다.");
  toast("ZIP 분석 모듈은 기존 분석 로직을 연결하는 자리입니다.");
};
$$("nav button").forEach(b=>b.onclick=()=>view(b.dataset.view));$("#themeBtn").onclick=()=>document.body.classList.toggle("dark");$("#menuBtn").onclick=()=>$("#drawer").classList.remove("hidden");$("#noticeBtn").onclick=()=>$("#noticeModal").classList.remove("hidden");$("#drawerNotice").onclick=()=>{$("#drawer").classList.add("hidden");$("#noticeModal").classList.remove("hidden")};$("#drawerMy").onclick=()=>{$("#drawer").classList.add("hidden");view("myView")};$("#logoutBtn").onclick=()=>{localStorage.removeItem("yw:new:token");location.reload()};$("#changePw").onclick=()=>toast("비밀번호 변경은 통합프로그램 계정과 연동합니다.");
$("#adminBtn").onclick=()=>$("#adminModal").classList.remove("hidden");$("#adminLogin").onclick=adminLogin;$("#savePeriod").onclick=savePeriod;$("#copyDelay").onclick=()=>copyStatus("지연");$("#copyMissing").onclick=()=>copyStatus("미제출");$$("[data-close]").forEach(b=>b.onclick=()=>$("#"+b.dataset.close).classList.add("hidden"));
restore();

let deferredInstallPrompt=null;
window.addEventListener("beforeinstallprompt",(e)=>{
  e.preventDefault();
  deferredInstallPrompt=e;
});
$("#installAppBtn").onclick=async()=>{
  if(deferredInstallPrompt){
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt=null;
    $("#drawer").classList.add("hidden");
    return;
  }
  const isIOS=/iphone|ipad|ipod/i.test(navigator.userAgent);
  if(isIOS) alert("Safari 하단 공유 버튼 → '홈 화면에 추가'를 눌러주세요.");
  else alert("브라우저 메뉴에서 '홈 화면에 추가' 또는 '앱 설치'를 선택해주세요.");
};

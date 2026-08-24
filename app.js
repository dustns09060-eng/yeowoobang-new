const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
let token=localStorage.getItem("matchV24Token")||"", period=null, adminToken="", installPrompt=null;
let result={all:[],mutual:[],onlyMe:[],fansOnly:[],neither:[]}, currentTab="all";

const JSZIP_CDN="https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js";
let zipPromise=null;
const norm=v=>String(v||"").trim().replace(/^@+/,"").toLowerCase();
const validUsername=id=>/^[a-z0-9._]+$/i.test(id)&&id.length<=30;
const unique=a=>[...new Set(a.map(norm).filter(validUsername))];

async function api(action,data={}){
 const r=await fetch(window.APP_CONFIG.apiUrl,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify({action,...data})});
 const j=await r.json();if(!j.ok)throw Error(j.message||"요청 실패");return j;
}
function toast(t){const x=$("#toast");x.textContent=t;x.classList.remove("hidden");setTimeout(()=>x.classList.add("hidden"),2200)}
async function entry(){try{const j=await api("entryLogin",{password:$("#entryPw").value});token=j.token;localStorage.setItem("matchV24Token",token);$("#loginScreen").classList.add("hidden");$("#app").classList.remove("hidden");await boot()}catch(e){$("#entryMsg").textContent=e.message}}
async function resume(){if(!token)return;try{await api("session",{token});$("#loginScreen").classList.add("hidden");$("#app").classList.remove("hidden");await boot()}catch(e){localStorage.removeItem("matchV24Token");token=""}}
async function boot(){const j=await api("bootstrap",{token});period=j.period;$("#noticeContent").textContent=j.notice||"등록된 공지가 없습니다.";renderPeriod()}
function renderPeriod(){const open=!!period?.open;$("#periodBadge").textContent=open?"진행중":"기간 아님";$("#periodText").textContent=period?.label||"현재 맞팔확인 기간이 아닙니다.";$("#zipInput").disabled=!open;$("#analyzeBtn").disabled=!open;$("#analysisGuide").textContent=open?"인스타그램 정보 다운로드 ZIP 파일을 선택해 분석해주세요.":"맞팔확인 기간이 시작되면 맞팔분석을 사용할 수 있어요.";if(!open)$("#analysisStatus").textContent=""}

function loadJsZip(){
 if(window.JSZip)return Promise.resolve(window.JSZip);
 if(zipPromise)return zipPromise;
 zipPromise=new Promise((resolve,reject)=>{const s=document.createElement("script");s.src=JSZIP_CDN;s.async=true;s.onload=()=>window.JSZip?resolve(window.JSZip):reject(Error("ZIP 분석 라이브러리를 불러오지 못했습니다."));s.onerror=()=>reject(Error("ZIP 분석 라이브러리를 불러오지 못했습니다."));document.head.appendChild(s)});
 return zipPromise;
}
function findFiles(zip){const f=Object.keys(zip.files).filter(p=>!zip.files[p].dir);return{followers:f.filter(p=>/followers_\d+\.(html|json)$/i.test(p.replace(/\\/g,"/").split("/").pop())),following:f.find(p=>/^following\.(html|json)$/i.test(p.replace(/\\/g,"/").split("/").pop()))}}
function extractHtml(text){const ids=[];let m;let re=/href=["']https?:\/\/(?:www\.)?instagram\.com\/(?:_u\/)?([A-Za-z0-9._]+)\/?[^"']*["']/gi;while((m=re.exec(text)))ids.push(m[1]);if(!ids.length){re=/https?:\/\/(?:www\.)?instagram\.com\/(?:_u\/)?([A-Za-z0-9._]+)/gi;while((m=re.exec(text)))ids.push(m[1])}return unique(ids)}
function walkJson(v,out){if(v==null)return;if(typeof v==="string"){const id=norm(v);if(validUsername(id))out.push(id);return}if(Array.isArray(v)){v.forEach(x=>walkJson(x,out));return}if(typeof v==="object")Object.values(v).forEach(x=>walkJson(x,out))}
function extractJson(text){const o=[];try{walkJson(JSON.parse(text),o)}catch(e){}return unique(o)}
async function parseZip(file){if(!file)throw Error("ZIP 파일을 선택해주세요.");const J=await loadJsZip();const zip=await J.loadAsync(file);const p=findFiles(zip);if(!p.followers.length)throw Error("followers_1 파일을 찾지 못했습니다.");if(!p.following)throw Error("following 파일을 찾지 못했습니다.");let followers=[];for(const path of p.followers){const text=await zip.files[path].async("string");followers.push(...(path.endsWith(".json")?extractJson(text):extractHtml(text)))}const ft=await zip.files[p.following].async("string");const following=p.following.endsWith(".json")?extractJson(ft):extractHtml(ft);return{followers:unique(followers),following:unique(following)}}
function classify(followers,following,members){const fs=new Set(followers),gs=new Set(following);const all=members.map(p=>({...p,status:fs.has(p.id)&&gs.has(p.id)?"mutual":!fs.has(p.id)&&gs.has(p.id)?"onlyMe":fs.has(p.id)&&!gs.has(p.id)?"fansOnly":"neither"}));result={all,mutual:all.filter(x=>x.status==="mutual"),onlyMe:all.filter(x=>x.status==="onlyMe"),fansOnly:all.filter(x=>x.status==="fansOnly"),neither:all.filter(x=>x.status==="neither")}}
const label=s=>({mutual:"맞팔 완료",onlyMe:"나만 팔로우",fansOnly:"상대만 팔로우",neither:"서로 미팔로우"})[s]||s;
async function analyze(){if(!period?.open)return toast("현재 맞팔확인 기간이 아닙니다.");const b=$("#analyzeBtn");try{b.disabled=true;b.textContent="분석 중...";$("#analysisStatus").textContent="맞팔리스트와 ZIP 파일을 비교하고 있어요.";const [parsed,base]=await Promise.all([parseZip($("#zipInput").files[0]),api("analysisMembers",{token})]);classify(parsed.followers,parsed.following,base.members);$("#summarySection").classList.remove("hidden");$("#analysisStatus").textContent=`분석 완료 · 맞팔리스트 ${base.members.length}명 기준`;renderSummary();showTab("all");toast("맞팔분석 완료")}catch(e){$("#analysisStatus").textContent="오류: "+e.message;toast("분석 실패")}finally{b.disabled=!period?.open;b.textContent="맞팔 분석 시작"}}
function renderSummary(){$("#allCount").textContent=result.all.length;$("#mutualCount").textContent=result.mutual.length;$("#onlyMeCount").textContent=result.onlyMe.length;$("#fansOnlyCount").textContent=result.fansOnly.length;$("#neitherCount").textContent=result.neither.length}
function filtered(){const q=norm($("#resultSearch").value);return(result[currentTab]||[]).filter(x=>!q||x.id.includes(q)||x.nickname.toLowerCase().includes(q))}
function showTab(tab){currentTab=tab;$$("[data-result-tab]").forEach(b=>b.classList.toggle("active",b.dataset.resultTab===tab));renderList()}
function renderList(){const rows=filtered();$("#resultList").innerHTML=rows.length?rows.map(x=>`<div class="result-row"><div><b>${x.no}. ${x.nickname}</b><a href="https://instagram.com/${x.id}/" target="_blank">@${x.id}</a></div><span class="status ${x.status}">${label(x.status)}</span></div>`).join(""):'<p class="muted">결과가 없습니다.</p>'}
async function copyResult(){const rows=filtered();if(!rows.length)return toast("복사할 결과가 없습니다.");const t=rows.map(x=>`${x.no}. ${x.nickname}\t@${x.id}\t${label(x.status)}`).join("\n");await navigator.clipboard.writeText(t);toast(`${rows.length}명 복사 완료`)}

async function adminLogin(){try{const j=await api("adminLogin",{token,password:$("#adminPw").value});adminToken=j.adminToken;$("#adminAuth").classList.add("hidden");$("#adminPanel").classList.remove("hidden");$("#adminRole").textContent="운영진 인증 완료";$("#periodStart").value=j.period.start||"";$("#periodEnd").value=j.period.end||""}catch(e){$("#adminMsg").textContent=e.message}}
async function savePeriod(){try{const j=await api("savePeriod",{token,adminToken,start:$("#periodStart").value,end:$("#periodEnd").value});toast(j.message);await boot()}catch(e){toast(e.message)}}
async function saveNotice(){try{const j=await api("saveNotice",{token,adminToken,title:$("#noticeTitle").value,content:$("#noticeBody").value});$("#noticeContent").textContent=j.notice||"등록된 공지가 없습니다.";toast(j.message)}catch(e){toast(e.message)}}
async function changePw(){try{const j=await api("changeEntryPassword",{token,adminToken,currentPassword:$("#currentEntryPw").value,newPassword:$("#newEntryPw").value,confirmPassword:$("#confirmEntryPw").value});toast(j.message);$("#currentEntryPw").value=$("#newEntryPw").value=$("#confirmEntryPw").value=""}catch(e){toast(e.message)}}

$("#entryBtn").onclick=entry;$("#entryPw").onkeydown=e=>{if(e.key==="Enter")entry()};$("#analyzeBtn").onclick=analyze;$("#resultSearch").oninput=renderList;$("#copyResultBtn").onclick=copyResult;$$("[data-result-tab]").forEach(b=>b.onclick=()=>showTab(b.dataset.resultTab));
$("#adminBtn").onclick=()=>$("#adminAuth").classList.remove("hidden");$("#adminLoginBtn").onclick=adminLogin;$("#savePeriodBtn").onclick=savePeriod;$("#saveNoticeBtn").onclick=saveNotice;$("#changeEntryPwBtn").onclick=changePw;
$("#moreBtn").onclick=()=>$("#moreMenu").classList.remove("hidden");$("#logoutBtn").onclick=()=>{localStorage.removeItem("matchV24Token");location.reload()};$$("[data-close]").forEach(b=>b.onclick=()=>$("#"+b.dataset.close).classList.add("hidden"));
window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();installPrompt=e});$("#installBtn").onclick=async()=>{if(installPrompt){installPrompt.prompt();await installPrompt.userChoice;installPrompt=null}else alert(/iphone|ipad|ipod/i.test(navigator.userAgent)?"Safari 공유 → 홈 화면에 추가를 눌러주세요.":"브라우저 메뉴에서 앱 설치/홈 화면에 추가를 선택해주세요.")};
resume();
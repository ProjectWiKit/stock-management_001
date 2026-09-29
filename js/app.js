const $ = id => document.getElementById(id);
let state = { token: localStorage.getItem('stock_token') || '', user: JSON.parse(localStorage.getItem('stock_user') || 'null') };

async function api(action, data={}) {
  const res = await fetch(API_URL, {
    method:'POST',
    headers:{'Content-Type':'text/plain;charset=utf-8'},
    body:JSON.stringify({action, token, ...data})
  });

  const text = await res.text();

  console.log('API response:', text);

  let json;

  try {
    json = JSON.parse(text);
  } catch (e) {
    throw new Error(
      'API ส่งข้อมูลที่ไม่ใช่ JSON กลับมา:\n\n' +
      text.substring(0, 500)
    );
  }

  if (!json.ok && json.error) throw new Error(json.error);
  return json;
}

function showApp() {
  $('loginView').hidden = true;
  $('appView').hidden = false;
  $('userInfo').textContent = `${state.user.name} (${state.user.role})`;
  loadDashboard();
}
function showLogin() {
  $('loginView').hidden = false;
  $('appView').hidden = true;
}

async function login(e) {
  e.preventDefault();
  $('loginMsg').textContent = 'กำลังเข้าสู่ระบบ...';
  try {
    const r = await apiLogin($('username').value, $('password').value);
    state.token = r.token; state.user = r.user;
    localStorage.setItem('stock_token', state.token);
    localStorage.setItem('stock_user', JSON.stringify(state.user));
    showApp();
  } catch (err) { $('loginMsg').textContent = '❌ ' + err.message; }
}
async function apiLogin(username,password) {
  const res = await fetch(API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'login',username,password})});
  const json = await res.json(); if(!json.ok) throw new Error(json.error); return json;
}
async function logout() {
  try { if(state.token) await api('logout'); } catch(e) {}
  localStorage.removeItem('stock_token'); localStorage.removeItem('stock_user');
  state={token:'',user:null}; showLogin();
}

function esc(v){return String(v ?? '').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
function badge(status){return status==='OUT'?'<span class="badge out">หมด</span>':status==='LOW'?'<span class="badge low">ใกล้หมด</span>':'<span class="badge ok">ปกติ</span>';}
function typeLabel(t){return t==='IN'?'รับเข้า':t==='OUT'?'เบิกออก':'ปรับยอด';}

async function loadDashboard(){
  try{
    const r=await api('dashboard'); const d=r.data;
    $('productCount').textContent=d.productCount; $('totalQty').textContent=d.totalQty;
    $('lowStock').textContent=d.lowStock; $('outStock').textContent=d.outOfStock;
    $('recentTable').innerHTML=table(['เวลา','สินค้า','ประเภท','จำนวน','คงเหลือ','ผู้ทำรายการ'],
      d.recent.map(x=>[x.dateTime,x.productId+' '+x.productName,typeLabel(x.type),x.qty,x.balance,x.user]));
  }catch(e){alert(e.message)}
}
async function loadProducts(){
  try{
    const r=await api('products',{q:$('productSearch').value}); const data=r.data;
    $('productsTable').innerHTML=table(['รหัส','Barcode','สินค้า','หมวดหมู่','หน่วย','คงเหลือ','สถานะ'],
      data.map(x=>[x.productId,x.barcode,x.productName,x.category,x.unit,x.stock,badge(x.status)]),true);
  }catch(e){alert(e.message)}
}
async function loadHistory(){
  try{
    const r=await api('transactions',{q:$('historySearch').value,limit:200}); const data=r.data;
    $('historyTable').innerHTML=table(['เวลา','เลขที่','สินค้า','ประเภท','จำนวน','ก่อนหน้า','คงเหลือ','ผู้ทำรายการ','หมายเหตุ'],
      data.map(x=>[x.dateTime,x.txId,x.productId+' '+x.productName,typeLabel(x.type),x.qty,x.oldStock,x.balance,x.user,x.note]));
  }catch(e){alert(e.message)}
}
function table(headers, rows, raw=false){
  if(!rows.length)return '<p class="muted">ไม่พบข้อมูล</p>';
  return '<div class="table-wrap"><table><thead><tr>'+headers.map(h=>`<th>${h}</th>`).join('')+'</tr></thead><tbody>'+
    rows.map(r=>'<tr>'+r.map(c=>`<td>${raw?c:esc(c)}</td>`).join('')+'</tr>').join('')+'</tbody></table></div>';
}

async function submitTx(){
  const type=$('txType').value, productId=$('txProduct').value.trim(), qty=Number($('txQty').value), note=$('txNote').value.trim();
  $('txMsg').textContent='กำลังบันทึก...';
  try{
    const r=await api('transaction',{type,productId,qty,note});
    $('txMsg').textContent=`✅ สำเร็จ: ${r.data.oldStock} → ${r.data.newStock}`;
    $('txQty').value=''; $('txNote').value=''; loadDashboard();
  }catch(e){$('txMsg').textContent='❌ '+e.message}
}

document.addEventListener('DOMContentLoaded',()=>{
  $('loginForm').addEventListener('submit',login);
  $('logoutBtn').onclick=logout;
  document.querySelectorAll('.tabs button').forEach(btn=>btn.onclick=()=>{
    document.querySelectorAll('.tabs button').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.tab').forEach(s=>s.hidden=true);
    $(btn.dataset.tab).hidden=false;
    if(btn.dataset.tab==='dashboard')loadDashboard();
    if(btn.dataset.tab==='products')loadProducts();
    if(btn.dataset.tab==='history')loadHistory();
  });
  $('refreshDash').onclick=loadDashboard; $('refreshProducts').onclick=loadProducts; $('refreshHistory').onclick=loadHistory;
  $('productSearch').oninput=()=>loadProducts(); $('historySearch').oninput=()=>loadHistory();
  $('submitTx').onclick=submitTx;
  if(API_URL.includes('PASTE_')) $('loginMsg').textContent='⚠️ กรุณาตั้งค่า API_URL ใน js/config.js ก่อนใช้งาน';
  else if(state.token && state.user) showApp(); else showLogin();
});

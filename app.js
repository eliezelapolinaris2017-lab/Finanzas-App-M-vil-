// ============ CONFIGURA TU FIREBASE AQUÍ ============
const firebaseConfig = {
  apiKey: "AIzaSyC66vv3-yaap1mV2n1GXRUopLqccobWqRE",
  authDomain: "finanzas-web-f4e05.firebaseapp.com",
  projectId: "finanzas-web-f4e05",
  storageBucket: "finanzas-web-f4e05.firebasestorage.app",
  messagingSenderId: "1047152523619",
  appId: "1:1047152523619:web:7d8f7d1f7a5ccc6090bb56"
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
// Persistencia offline (opcional)
db.enablePersistence({ synchronizeTabs: true }).catch(()=>{});

// ============ UI BASICS ============
const $ = (s, p=document) => p.querySelector(s);
const $$ = (s, p=document) => [...p.querySelectorAll(s)];

const loginScreen = $("#login");
const appScreen   = $("#app");
const drawer      = $("#drawer");
const btnMenu     = $("#btnMenu");
const btnLogout   = $("#btnLogout");
const navBtns     = $$(".nav");
const views       = $$(".view");
const toasts      = $("#toasts");

btnMenu?.addEventListener("click", ()=> drawer.classList.toggle("open"));
btnLogout?.addEventListener("click", ()=> auth.signOut());

navBtns.forEach(b=>{
  b.addEventListener("click", ()=>{
    navBtns.forEach(x=>x.classList.remove("active"));
    b.classList.add("active");
    const id = b.dataset.target;
    views.forEach(v=>{
      v.classList.toggle("visible", v.id===id);
    });
    drawer.classList.remove("open");
  });
});

function toast(msg){ 
  const el = document.createElement("div");
  el.className = "toast"; el.textContent = msg;
  toasts.appendChild(el);
  setTimeout(()=>{ el.style.opacity=.9; }, 50);
  setTimeout(()=>{ el.remove(); }, 3500);
}

// ============ AUTH ============
const btnGoogle = $("#btnGoogle");
btnGoogle.addEventListener("click", async ()=>{
  const provider = new firebase.auth.GoogleAuthProvider();
  await auth.signInWithPopup(provider);
});

auth.onAuthStateChanged(user=>{
  if(user){
    loginScreen.classList.remove("visible");
    appScreen.style.display = "grid";
    // Cargar listas en tiempo real
    listenIncomes();
    listenExpenses();
    listenInvoices();
  }else{
    appScreen.style.display = "none";
    loginScreen.classList.add("visible");
  }
});

// ============ HELPERS ============
const todayStr = () => new Date().toISOString().slice(0,10);
const money = (n, c="USD") => new Intl.NumberFormat("es-PR",{style:"currency",currency:c}).format(Number(n||0));

// ============ 1) ENTRADA DE DINERO ============
const formIncome = $("#formIncome");
const incDate = $("#incDate");
const incMethod = $("#incMethod");
const incClient = $("#incClient");
const incAmount = $("#incAmount");
const incRef = $("#incRef");
const incToday = $("#incToday");
const listIncomes = $("#listIncomes");

incDate.value = todayStr();
incToday.addEventListener("click", ()=> incDate.value = todayStr());

formIncome.addEventListener("submit", async (e)=>{
  e.preventDefault();
  const user = auth.currentUser;
  if(!user) return toast("Inicia sesión");

  const payload = {
    uid: user.uid,
    date: incDate.value,
    method: incMethod.value,
    client: incClient.value.trim(),
    amount: Number(incAmount.value||0),
    ref: incRef.value.trim(),
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  };
  await db.collection("incomes").add(payload);
  toast("Ingreso guardado");
  formIncome.reset();
  incDate.value = todayStr();
});

function listenIncomes(){
  const user = auth.currentUser;
  if(!user) return;
  return db.collection("incomes")
    .where("uid","==",user.uid)
    .orderBy("date","desc").limit(20)
    .onSnapshot(snap=>{
      listIncomes.innerHTML = "";
      snap.forEach(doc=>{
        const d = doc.data();
        const li = document.createElement("li");
        li.innerHTML = `
          <div>
            <strong>${d.client||"—"}</strong><br>
            <small>${d.date} · ${d.method}${d.ref?(" · "+d.ref):""}</small>
          </div>
          <div><strong>${money(d.amount)}</strong></div>
        `;
        listIncomes.appendChild(li);
      });
    });
}

// ============ 2) GASTOS DIARIOS ============
const formExpense = $("#formExpense");
const expDate = $("#expDate");
const expCategory = $("#expCategory");
const expDesc = $("#expDesc");
const expMethod = $("#expMethod");
const expAmount = $("#expAmount");
const expToday = $("#expToday");
const listExpenses = $("#listExpenses");

expDate.value = todayStr();
expToday.addEventListener("click", ()=> expDate.value = todayStr());

formExpense.addEventListener("submit", async (e)=>{
  e.preventDefault();
  const user = auth.currentUser;
  if(!user) return toast("Inicia sesión");
  const payload = {
    uid: user.uid,
    date: expDate.value,
    category: expCategory.value,
    description: expDesc.value.trim(),
    method: expMethod.value,
    amount: Number(expAmount.value||0),
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  };
  await db.collection("expenses").add(payload);
  toast("Gasto guardado");
  formExpense.reset();
  expDate.value = todayStr();
});

function listenExpenses(){
  const user = auth.currentUser;
  if(!user) return;
  return db.collection("expenses")
    .where("uid","==",user.uid)
    .orderBy("date","desc").limit(20)
    .onSnapshot(snap=>{
      listExpenses.innerHTML = "";
      snap.forEach(doc=>{
        const d = doc.data();
        const li = document.createElement("li");
        li.innerHTML = `
          <div>
            <strong>${d.category||"—"}</strong><br>
            <small>${d.date} · ${d.method} · ${d.description||""}</small>
          </div>
          <div><strong>${money(d.amount)}</strong></div>
        `;
        listExpenses.appendChild(li);
      });
    });
}

// ============ 3) CREAR FACTURA ============
const formInvoice = $("#formInvoice");
const invDate = $("#invDate");
const invDue = $("#invDue");
const invNumber = $("#invNumber");
const invMethod = $("#invMethod");
const invClient = $("#invClient");
const invEmail = $("#invEmail");
const invPhone = $("#invPhone");
const invNote = $("#invNote");
const invToday = $("#invToday");
const btnAddItem = $("#btnAddItem");
const itemsTable = $("#itemsTable tbody");
const tSub = $("#tSub"); const tTax = $("#tTax"); const tGrand = $("#tGrand");

invDate.value = todayStr(); invDue.value = todayStr();
invToday.addEventListener("click", ()=>{ invDate.value=todayStr(); invDue.value=todayStr(); });

btnAddItem.addEventListener("click", addItemRow);
itemsTable.addEventListener("input", recalcInvoice);
itemsTable.addEventListener("click", (e)=>{
  if(e.target.matches(".rm")){ e.target.closest("tr").remove(); recalcInvoice(); }
});

function addItemRow(desc="", qty=1, price=0, tax=0){
  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td><input class="d" placeholder="Descripción" value="${desc}"></td>
    <td><input class="q" type="number" step="1" value="${qty}"></td>
    <td><input class="p" type="number" step="0.01" value="${price}"></td>
    <td><input class="t" type="number" step="0.01" value="${tax}"></td>
    <td class="tot">—</td>
    <td><button type="button" class="rm btn-outline">✕</button></td>
  `;
  itemsTable.appendChild(tr);
  recalcInvoice();
}
function recalcInvoice(){
  let sub=0, tax=0;
  [...itemsTable.querySelectorAll("tr")].forEach(tr=>{
    const q = Number(tr.querySelector(".q").value||0);
    const p = Number(tr.querySelector(".p").value||0);
    const t = Number(tr.querySelector(".t").value||0);
    const line = q*p; const taxLine = line*(t/100);
    tr.querySelector(".tot").textContent = money(line+taxLine);
    sub += line; tax += taxLine;
  });
  tSub.textContent = money(sub);
  tTax.textContent = money(tax);
  tGrand.textContent = money(sub+tax);
}

formInvoice.addEventListener("submit", async (e)=>{
  e.preventDefault();
  const user = auth.currentUser;
  if(!user) return toast("Inicia sesión");

  // recopilar items
  const items = [...itemsTable.querySelectorAll("tr")].map(tr=>({
    description: tr.querySelector(".d").value.trim(),
    qty: Number(tr.querySelector(".q").value||0),
    price: Number(tr.querySelector(".p").value||0),
    tax: Number(tr.querySelector(".t").value||0),
  }));
  const totals = {
    subtotal: text2num(tSub.textContent),
    tax: text2num(tTax.textContent),
    total: text2num(tGrand.textContent)
  };

  const payload = {
    uid: user.uid,
    date: invDate.value,
    due: invDue.value,
    number: invNumber.value.trim(),
    method: invMethod.value,
    client: invClient.value.trim(),
    email: invEmail.value.trim(),
    phone: invPhone.value.trim(),
    note: invNote.value.trim(),
    items, totals,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  };
  await db.collection("invoices").doc(payload.number || undefined).set(payload); // si pones # como id, sobrescribe ese id
  toast("Factura guardada");
  formInvoice.reset();
  itemsTable.innerHTML = "";
  invDate.value = todayStr(); invDue.value = todayStr();
  recalcInvoice();
});

function text2num(s){ return Number(String(s).replace(/[^\d.-]/g,""))||0; }

// ============ 4) HISTORIAL DE FACTURAS + PDF ============
const listInvoices = $("#listInvoices");
const invSearch = $("#invSearch");

let unsubscribeInvoices = null;
function listenInvoices(){
  const user = auth.currentUser;
  if(!user) return;
  // por defecto últimas 30
  if (unsubscribeInvoices) unsubscribeInvoices();
  unsubscribeInvoices = db.collection("invoices")
    .where("uid","==",user.uid)
    .orderBy("date","desc").limit(30)
    .onSnapshot(renderInvoices);
}

function renderInvoices(snap){
  listInvoices.innerHTML = "";
  const q = (invSearch.value||"").toLowerCase();
  snap.forEach(doc=>{
    const d = doc.data();
    const hay = [d.number, d.client].join(" ").toLowerCase();
    if(q && !hay.includes(q)) return;
    const li = document.createElement("li");
    li.innerHTML = `
      <div>
        <strong>${d.number}</strong> · ${d.client}<br>
        <small>${d.date} → ${d.due} · ${d.method}</small>
      </div>
      <div class="row g">
        <strong>${money(d?.totals?.total||0)}</strong>
        <button class="btn-outline" data-pdf="${doc.id}">PDF</button>
      </div>
    `;
    listInvoices.appendChild(li);
  });
}
invSearch.addEventListener("input", ()=>listenInvoices());

listInvoices.addEventListener("click", async (e)=>{
  const id = e.target?.dataset?.pdf;
  if(!id) return;
  const ref = db.collection("invoices").doc(id);
  const snap = await ref.get();
  if(!snap.exists){ toast("No existe la factura"); return; }
  const d = snap.data();
  exportInvoicePDF(d);
});

async function exportInvoicePDF(inv){
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit:"pt", format:"letter" });
  const L = 56, R = 560;
  // Encabezado
  doc.setFont("helvetica","bold"); doc.setFontSize(16);
  doc.text("Nexus Finance — Factura", L, 64);
  doc.setFontSize(10); doc.setFont("helvetica","normal");
  doc.text(`Factura: ${inv.number}`, L, 82);
  doc.text(`Fecha: ${inv.date}   Vence: ${inv.due}`, L, 98);
  doc.text(`Cliente: ${inv.client}`, L, 114);
  if(inv.email) doc.text(`Email: ${inv.email}`, L, 130);
  if(inv.phone) doc.text(`Tel: ${inv.phone}`, L, 146);

  // Tabla
  let y = 176;
  doc.setFont("helvetica","bold"); doc.text("Descripción", L, y);
  doc.text("Cant.", 340, y); doc.text("Precio", 400, y); doc.text("Imp%", 470, y); doc.text("Total", 520, y);
  doc.setLineWidth(.7); doc.line(L, y+6, R, y+6);
  y += 22; doc.setFont("helvetica","normal");

  inv.items.forEach(it=>{
    const line = it.qty*it.price; const tax = line*(it.tax/100); const tot = line+tax;
    doc.text(String(it.description||""), L, y);
    doc.text(String(it.qty||0), 340, y, {align:"right"});
    doc.text(money(it.price), 460, y, {align:"right"});
    doc.text(String(it.tax||0), 500, y, {align:"right"});
    doc.text(money(tot), 560, y, {align:"right"});
    y += 18;
    if (y > 680){ doc.addPage(); y = 64; }
  });

  // Totales
  y += 10; doc.setLineWidth(.7); doc.line(360, y, R, y); y += 18;
  doc.text("Subtotal:", 440, y); doc.text(money(inv.totals?.subtotal||0), 560, y, {align:"right"}); y+=16;
  doc.text("Impuestos:", 440, y); doc.text(money(inv.totals?.tax||0), 560, y, {align:"right"}); y+=16;
  doc.setFont("helvetica","bold");
  doc.text("Total:", 440, y); doc.text(money(inv.totals?.total||0), 560, y, {align:"right"});

  // Notas
  if(inv.note){ y+=28; doc.setFont("helvetica","normal"); doc.text(`Notas: ${inv.note}`, L, y); }

  doc.save(`${inv.number||"factura"}.pdf`);
}

// ============ FECHAS RÁPIDAS ============
$("#incToday").addEventListener("click", ()=> incDate.value=todayStr());
$("#expToday").addEventListener("click", ()=> expDate.value=todayStr());
$("#invToday").addEventListener("click", ()=>{ invDate.value=todayStr(); invDue.value=todayStr(); });
addItemRow(); // primera fila por defecto
recalcInvoice();

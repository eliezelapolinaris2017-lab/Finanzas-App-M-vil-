/* app.js – Nexus Finance Móvil (Firebase + Firestore) */
import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import {
  getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import {
  getFirestore, initializeFirestore, enableIndexedDbPersistence,
  collection, addDoc, serverTimestamp, query, orderBy, limit, onSnapshot, getDocs, where
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

/*** =========================
 * 1) Firebase CONFIG
 * ========================== */
const firebaseConfig = {
  apiKey: "TU_API_KEY",
  authDomain: "TU_PROYECTO.firebaseapp.com",
  projectId: "TU_PROJECT_ID",
  storageBucket: "TU_PROJECT_ID.appspot.com",
  messagingSenderId: "XXXX",
  appId: "1:XXXX:web:YYYY"
};
// Si tu web usa base de datos nombrada, coloca el ID aquí:
const FIRESTORE_DB_ID = undefined; // p.ej. "nexus-db" si usas getFirestore(app, "nexus-db")

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// Firestore + persistencia offline
const db = FIRESTORE_DB_ID
  ? getFirestore(app, FIRESTORE_DB_ID)
  : (() => {
      // Inicializa con cache LRU por rendimiento en móvil
      const dbi = initializeFirestore(app, {localCache: undefined});
      enableIndexedDbPersistence(dbi).catch(() => {});
      return dbi;
    })();

/*** =========================
 * 2) Helpers UI
 * ========================== */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);
const fmt = (n) => (isNaN(n) || n === "" || n === null) ? "—" :
  new Intl.NumberFormat("es-PR",{style:"currency",currency:"USD"}).format(Number(n));

function toast(msg){
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(()=>t.classList.remove("show"), 2000);
}

// Tab switching
$$(".tab").forEach(btn=>{
  btn.addEventListener("click", ()=>{
    $$(".tab").forEach(b=>b.classList.remove("active"));
    btn.classList.add("active");
    const id = btn.dataset.view;
    $$(".screen").forEach(s=>s.classList.remove("visible"));
    $("#"+id).classList.add("visible");
  });
});

/*** =========================
 * 3) Auth flow
 * ========================== */
$("#btnGoogle").addEventListener("click", async ()=>{
  try{
    await signInWithPopup(auth, provider);
  }catch(e){ console.error(e); toast("No se pudo iniciar sesión"); }
});
$("#btnLogout").addEventListener("click", ()=>signOut(auth));

onAuthStateChanged(auth, (user)=>{
  if(user){
    $("#loginView").classList.remove("visible");
    $("#appView").classList.add("visible");
    $("#userEmail").textContent = user.email || user.uid;
    bindRealtime(user.uid);
  }else{
    $("#appView").classList.remove("visible");
    $("#loginView").classList.add("visible");
  }
});

/*** =========================
 * 4) Firestore paths en users/{uid}/...
 * ========================== */
const incomesCol   = (uid)=> collection(db, "users", uid, "incomes");
const expensesCol  = (uid)=> collection(db, "users", uid, "expenses");
const invoicesCol  = (uid)=> collection(db, "users", uid, "invoices");

/*** =========================
 * 5) Entradas de dinero
 * ========================== */
$("#btnSaveIncome").addEventListener("click", async (e)=>{
  e.preventDefault();
  const user = auth.currentUser; if(!user) return;
  const docData = {
    date: $("#incDate").value || new Date().toISOString().slice(0,10),
    method: $("#incMethod").value,
    client: $("#incClient").value.trim(),
    amount: Number($("#incAmount").value || 0),
    note: $("#incNote").value.trim(),
    createdAt: serverTimestamp()
  };
  if(!docData.client || !docData.amount){ toast("Completa cliente y monto"); return; }
  try{
    await addDoc(incomesCol(user.uid), docData);
    $("#incomeForm").reset();
    toast("Entrada guardada");
  }catch(err){ console.error(err); toast("Error guardando"); }
});

function mountIncomes(uid){
  const q = query(incomesCol(uid), orderBy("date","desc"), limit(20));
  onSnapshot(q, (snap)=>{
    const tbody = $("#incomesTable tbody");
    tbody.innerHTML = "";
    snap.forEach(d=>{
      const v = d.data();
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${v.date||""}</td>
        <td>${v.client||""}</td>
        <td>${v.method||""}</td>
        <td class="right">${fmt(v.amount)}</td>`;
      tbody.appendChild(tr);
    });
  });
}

/*** =========================
 * 6) Gastos diarios
 * ========================== */
$("#btnSaveExpense").addEventListener("click", async (e)=>{
  e.preventDefault();
  const user = auth.currentUser; if(!user) return;
  const docData = {
    date: $("#expDate").value || new Date().toISOString().slice(0,10),
    category: $("#expCategory").value,
    description: $("#expDesc").value.trim(),
    method: $("#expMethod").value,
    amount: Number($("#expAmount").value || 0),
    createdAt: serverTimestamp()
  };
  if(!docData.description || !docData.amount){ toast("Completa descripción y monto"); return; }
  try{
    await addDoc(expensesCol(user.uid), docData);
    $("#expenseForm").reset();
    toast("Gasto guardado");
  }catch(err){ console.error(err); toast("Error guardando"); }
});

function mountExpenses(uid){
  const q = query(expensesCol(uid), orderBy("date","desc"), limit(20));
  onSnapshot(q, (snap)=>{
    const tbody = $("#expensesTable tbody");
    tbody.innerHTML = "";
    snap.forEach(d=>{
      const v = d.data();
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${v.date||""}</td>
        <td>${v.category||""}</td>
        <td>${v.description||""}</td>
        <td class="right">${fmt(v.amount)}</td>`;
      tbody.appendChild(tr);
    });
  });
}

/*** =========================
 * 7) Facturas (crear) users/{uid}/invoices
 * ========================== */
function addItemRow(desc="", qty=1, price=0, tax=0){
  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td><input class="it-desc" placeholder="Descripción" value="${desc}"></td>
    <td><input class="it-qty" type="number" step="0.01" value="${qty}"></td>
    <td><input class="it-price" type="number" step="0.01" value="${price}"></td>
    <td><input class="it-tax" type="number" step="0.01" value="${tax}"></td>
    <td class="right it-total">—</td>
    <td><button type="button" class="btn-outline it-del">✕</button></td>
  `;
  tr.querySelector(".it-del").addEventListener("click", ()=> tr.remove());
  $("#itemsTable tbody").appendChild(tr);
}
$("#btnAddItem").addEventListener("click", ()=> addItemRow());

function computeTotals(){
  let subtotal=0, tax=0;
  $$("#itemsTable tbody tr").forEach(tr=>{
    const qty = Number(tr.querySelector(".it-qty").value||0);
    const price = Number(tr.querySelector(".it-price").value||0);
    const t = Number(tr.querySelector(".it-tax").value||0);
    const line = qty * price;
    const lineTax = line * (t/100);
    subtotal += line;
    tax += lineTax;
    tr.querySelector(".it-total").textContent = fmt(line + lineTax);
  });
  $("#tSubtotal").textContent = fmt(subtotal);
  $("#tTax").textContent = fmt(tax);
  $("#tTotal").textContent = fmt(subtotal + tax);
  return {subtotal, tax, total: subtotal + tax};
}
$("#btnCalc").addEventListener("click", computeTotals);

$("#btnSaveInvoice").addEventListener("click", async(e)=>{
  e.preventDefault();
  const user = auth.currentUser; if(!user) return;

  const items = [];
  $$("#itemsTable tbody tr").forEach(tr=>{
    items.push({
      description: tr.querySelector(".it-desc").value.trim(),
      qty: Number(tr.querySelector(".it-qty").value||0),
      price: Number(tr.querySelector(".it-price").value||0),
      taxPct: Number(tr.querySelector(".it-tax").value||0)
    });
  });
  const totals = computeTotals();

  const inv = {
    date: $("#invDate").value || new Date().toISOString().slice(0,10),
    due: $("#invDue").value || $("#invDate").value || new Date().toISOString().slice(0,10),
    number: $("#invNumber").value.trim(),
    client: $("#invClient").value.trim(),
    address: $("#invAddress").value.trim(),
    method: $("#invMethod").value,
    email: $("#invEmail").value.trim(),
    note: $("#invNote").value.trim(),
    items, subtotal: totals.subtotal, tax: totals.tax, total: totals.total,
    createdAt: serverTimestamp()
  };
  if(!inv.number || !inv.client || !items.length){ toast("Completa #, cliente e ítems"); return; }

  try{
    await addDoc(invoicesCol(user.uid), inv);
    $("#invoiceForm").reset();
    $("#itemsTable tbody").innerHTML = "";
    $("#tSubtotal").textContent = $("#tTax").textContent = $("#tTotal").textContent = "—";
    toast("Factura guardada");
  }catch(err){ console.error(err); toast("Error guardando"); }
});

/*** =========================
 * 8) Historial de facturas + Export PDF
 * ========================== */
let invoicesCache = []; // cache para exportar/buscar

function mountInvoices(uid){
  const qy = query(invoicesCol(uid), orderBy("date","desc"), limit(100));
  onSnapshot(qy, (snap)=>{
    invoicesCache = [];
    const tbody = $("#invoicesTable tbody");
    tbody.innerHTML = "";
    snap.forEach(d=>{
      const v = d.data();
      invoicesCache.push(v);
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${v.date||""}</td>
        <td>${v.number||""}</td>
        <td>${v.client||""}</td>
        <td>${v.method||""}</td>
        <td class="right">${fmt(v.total||0)}</td>`;
      tbody.appendChild(tr);
    });
  });
}

$("#searchInvoice").addEventListener("input", (e)=>{
  const q = (e.target.value||"").toLowerCase();
  const tbody = $("#invoicesTable tbody");
  tbody.innerHTML = "";
  invoicesCache
    .filter(v => (v.number||"").toLowerCase().includes(q) || (v.client||"").toLowerCase().includes(q))
    .forEach(v=>{
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${v.date||""}</td>
        <td>${v.number||""}</td>
        <td>${v.client||""}</td>
        <td>${v.method||""}</td>
        <td class="right">${fmt(v.total||0)}</td>`;
      tbody.appendChild(tr);
    });
});

$("#btnExportPDF").addEventListener("click", ()=>{
  if(!invoicesCache.length){ toast("No hay facturas"); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({unit:"pt", format:"a4"});

  doc.setFontSize(14); doc.text("Historial de Facturas", 40, 40);
  const body = invoicesCache.map(v => [
    v.date||"", v.number||"", v.client||"", v.method||"", (v.total!=null? Number(v.total).toFixed(2) : "")
  ]);
  doc.autoTable({
    head: [["Fecha","#","Cliente","Método","Total"]],
    body,
    startY: 60,
    styles: { fontSize: 10 },
    headStyles: { fillColor:[0,0,0] }
  });
  doc.save(`facturas_${new Date().toISOString().slice(0,10)}.pdf`);
});

/*** =========================
 * 9) Realtime bind after login
 * ========================== */
function bindRealtime(uid){
  mountIncomes(uid);
  mountExpenses(uid);
  mountInvoices(uid);
  // deja vacía la vista de creación hasta que el usuario agregue ítems
}

/*** =========================
 * 10) Defaults de fecha
 * ========================== */
function setTodayInputs(){
  const today = new Date().toISOString().slice(0,10);
  ["#incDate","#expDate","#invDate","#invDue"].forEach(sel=>{
    const el = $(sel); if(el && !el.value) el.value = today;
  });
}
setTodayInputs();

import React, { useContext, useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList } from 'react-native';
import dayjs from 'dayjs';
import { AppContext } from '../App';
import { atomicAppend } from '../firebase';

function calc(items){
  let subtotal=0,tax=0;
  items.forEach(it=>{ const base=(it.qty||0)*(it.price||0); subtotal+=base; tax+=base*((it.tax||0)/100); });
  return { subtotal, tax, total: subtotal+tax };
}

export default function InvoiceCreateScreen(){
  const { user, cloudState } = useContext(AppContext);
  const [date, setDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [number, setNumber] = useState('');
  const [client, setClient] = useState('');
  const [method, setMethod] = useState('Efectivo');
  const [items, setItems] = useState([]);

  const addItem = ()=> setItems([...items, { id:Math.random().toString(36).slice(2), desc:'', qty:1, price:0, tax:0 }]);
  const update = (id, patch)=> setItems(items.map(i=> i.id===id ? {...i, ...patch} : i));
  const totals = useMemo(()=> calc(items), [items]);

  const save = async ()=>{
    if(!date || !number) return;
    const inv = {
      id: Math.random().toString(36).slice(2),
      date, number, method,
      client: { name: client },
      items, subtotal: totals.subtotal, taxTotal: totals.tax, total: totals.total
    };
    await atomicAppend(user.uid, 'invoices', inv);
    // también sumamos a incomesDaily igual que la web cuando guardas factura
    await atomicAppend(user.uid, 'incomesDaily', {
      id: Math.random().toString(36).slice(2),
      date, client, method, amount: totals.total, invoiceNumber: number
    });
    setItems([]); setNumber(''); setClient('');
  };

  const fmt = (n)=> new Intl.NumberFormat('es-PR',{style:'currency',currency:cloudState?.settings?.currency||'USD'}).format(Number(n||0));

  return (
    <View style={{ flex:1, padding:14 }}>
      <Text style={{ color:'#F2F3F5', fontWeight:'700', marginBottom:6 }}>Factura</Text>
      <View style={{ backgroundColor:'#111317', borderColor:'#262c34', borderWidth:1, borderRadius:12, padding:10, marginBottom:12 }}>
        <TextInput placeholder="Fecha (YYYY-MM-DD)" placeholderTextColor="#8a8f99" value={date} onChangeText={setDate}
          style={{ color:'#F2F3F5', borderBottomWidth:1, borderBottomColor:'#262c34', paddingVertical:6, marginBottom:8 }}/>
        <TextInput placeholder="# Factura" placeholderTextColor="#8a8f99" value={number} onChangeText={setNumber}
          style={{ color:'#F2F3F5', borderBottomWidth:1, borderBottomColor:'#262c34', paddingVertical:6, marginBottom:8 }}/>
        <TextInput placeholder="Cliente" placeholderTextColor="#8a8f99" value={client} onChangeText={setClient}
          style={{ color:'#F2F3F5', borderBottomWidth:1, borderBottomColor:'#262c34', paddingVertical:6, marginBottom:8 }}/>
        <TextInput placeholder="Método" placeholderTextColor="#8a8f99" value={method} onChangeText={setMethod}
          style={{ color:'#F2F3F5', paddingVertical:6, marginBottom:8 }}/>
      </View>

      <TouchableOpacity onPress={addItem} style={{ backgroundColor:'#1f2329', borderColor:'#2b3038', borderWidth:1, padding:10, borderRadius:10, marginBottom:10 }}>
        <Text style={{ color:'#F2F3F5' }}>Añadir ítem</Text>
      </TouchableOpacity>

      <FlatList
        data={items}
        keyExtractor={(i)=>i.id}
        renderItem={({item})=>(

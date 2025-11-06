import React, { useContext, useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList } from 'react-native';
import dayjs from 'dayjs';
import { AppContext } from '../App';
import { atomicAppend } from '../firebase';

export default function ExpensesScreen(){
  const { user, cloudState } = useContext(AppContext);
  const [date, setDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [category, setCategory] = useState('Otros');
  const [method, setMethod] = useState('Efectivo');
  const [desc, setDesc] = useState('');
  const [ref, setRef] = useState('');
  const [amount, setAmount] = useState('');

  const fmt = (n)=> new Intl.NumberFormat('es-PR',{style:'currency',currency:cloudState?.settings?.currency||'USD'}).format(Number(n||0));

  const save = async ()=>{
    if(!date) return;
    const rec = { id: Math.random().toString(36).slice(2), date, category, method, desc, ref, amount: Number(amount||0) };
    await atomicAppend(user.uid, 'expensesDaily', rec);
    setDesc(''); setAmount(''); setRef('');
  };

  const list = useMemo(()=> (cloudState?.expensesDaily||[]).slice().sort((a,b)=> (a.date<b.date?1:-1)), [cloudState]);

  return (
    <View style={{ flex:1, padding:14 }}>
      <Text style={{ color:'#F2F3F5', fontWeight:'700', marginBottom:6 }}>Nuevo gasto</Text>
      <View style={{ backgroundColor:'#111317', borderColor:'#262c34', borderWidth:1, borderRadius:12, padding:10, marginBottom:12 }}>
        <TextInput placeholder="Fecha (YYYY-MM-DD)" placeholderTextColor="#8a8f99" value={date} onChangeText={setDate}
          style={{ color:'#F2F3F5', borderBottomWidth:1, borderBottomColor:'#262c34', paddingVertical:6, marginBottom:8 }}/>
        <TextInput placeholder="Categoría" placeholderTextColor="#8a8f99" value={category} onChangeText={setCategory}
          style={{ color:'#F2F3F5', borderBottomWidth:1, borderBottomColor:'#262c34', paddingVertical:6, marginBottom:8 }}/>
        <TextInput placeholder="Método" placeholderTextColor="#8a8f99" value={method} onChangeText={setMethod}
          style={{ color:'#F2F3F5', borderBottomWidth:1, borderBottomColor:'#262c34', paddingVertical:6, marginBottom:8 }}/>
        <TextInput placeholder="Descripción" placeholderTextColor="#8a8f99" value={desc} onChangeText={setDesc}
          style={{ color:'#F2F3F5', borderBottomWidth:1, borderBottomColor:'#262c34', paddingVertical:6, marginBottom:8 }}/>
        <TextInput placeholder="Referencia" placeholderTextColor="#8a8f99" value={ref} onChangeText={setRef}
          style={{ color:'#F2F3F5', borderBottomWidth:1, borderBottomColor:'#262c34', paddingVertical:6, marginBottom:8 }}/>
        <TextInput placeholder="Monto" keyboardType="decimal-pad" placeholderTextColor="#8a8f99" value={amount} onChangeText={setAmount}
          style={{ color:'#F2F3F5', paddingVertical:6, marginBottom:8 }}/>
        <TouchableOpacity onPress={save} style={{ backgroundColor:'#C7A24B', padding:12, borderRadius:10, alignSelf:'flex-start' }}>
          <Text style={{ color:'#000', fontWeight:'700' }}>Guardar</Text>
        </TouchableOpacity>
      </View>

      <Text style={{ color:'#F2F3F5', fontWeight:'700', marginBottom:6 }}>Listado</Text>
      <FlatList
        data={list}
        keyExtractor={(i)=>i.id}
        renderItem={({item})=>(
          <View style={{ borderBottomColor:'#262c34', borderBottomWidth:1, paddingVertical:10 }}>
            <Text style={{ color:'#F2F3F5' }}>{item.date} · {item.category} · {item.method} · {item.ref||'—'}</Text>
            <Text style={{ color:'#C7A24B', fontWeight:'700' }}>{fmt(item.amount)}</Text>
            {item.desc ? <Text style={{ color:'#8a8f99' }}>{item.desc}</Text> : null}
          </View>
        )}
      />
    </View>
  );
}

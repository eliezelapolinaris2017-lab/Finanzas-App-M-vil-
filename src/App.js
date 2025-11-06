import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { auth, providers, subscribeState, pullState, pushState } from './firebase';
import dayjs from 'dayjs';

import IncomesScreen from './screens/IncomesScreen';
import ExpensesScreen from './screens/ExpensesScreen';
import InvoiceCreateScreen from './screens/InvoiceCreateScreen';
import HistoryScreen from './screens/HistoryScreen';

WebBrowser.maybeCompleteAuthSession();

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const theme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: '#0B0D10', card: '#111317', text: '#F2F3F5', border: '#262c34' },
};

function SignInScreen() {
  const [loading, setLoading] = useState(false);
  const signIn = async () => {
    try {
      setLoading(true);
      const redirectUri = AuthSession.makeRedirectUri({ scheme: 'nexusfinance' });
      const result = await AuthSession.startAsync({
        authUrl:
          `https://accounts.google.com/o/oauth2/v2/auth?` +
          `client_id=${auth.config.clientId || ''}&` + // opcional si usas cliente nativo
          `response_type=token&redirect_uri=${encodeURIComponent(redirectUri)}&` +
          `scope=${encodeURIComponent('profile email')}`
      });

      if (result.type === 'success' && result.params?.access_token) {
        const cred = providers.GoogleAuthProvider.credential(null, result.params.access_token);
        await providers.signInWithCredential(auth, cred);
      }
    } catch (e) {
      console.warn(e);
    } finally { setLoading(false); }
  };

  return (
    <View style={{ flex:1, justifyContent:'center', alignItems:'center' }}>
      <Text style={{ color:'#F2F3F5', fontSize:22, marginBottom:10 }}>Nexus Finance</Text>
      <TouchableOpacity onPress={signIn} style={{ backgroundColor:'#C7A24B', padding:12, borderRadius:12 }}>
        <Text style={{ color:'#000', fontWeight:'700' }}>{loading?'Entrando…':'Entrar con Google'}</Text>
      </TouchableOpacity>
    </View>
  );
}

function Tabs({ user, cloudState, setCloudState }) {
  // Proveer estado a pantallas y setState que empuje a Firestore
  const ctx = useMemo(() => ({
    user,
    cloudState,
    setState: async (updater) => {
      const next = typeof updater === 'function' ? updater(cloudState) : updater;
      setCloudState(next);
      await pushState(user.uid, next);
    }
  }), [user, cloudState]);

  return (
    <AppContext.Provider value={ctx}>
      <Tab.Navigator
        screenOptions={{ headerShown:false, tabBarStyle:{ backgroundColor:'#111317', borderTopColor:'#262c34' }, tabBarActiveTintColor:'#C7A24B' }}>
        <Tab.Screen name="Ingresos" component={IncomesScreen} options={{ tabBarIcon: () => <Text>💰</Text> }}/>
        <Tab.Screen name="Gastos" component={ExpensesScreen} options={{ tabBarIcon: () => <Text>💸</Text> }}/>
        <Tab.Screen name="Factura" component={InvoiceCreateScreen} options={{ tabBarIcon: () => <Text>🧾</Text> }}/>
        <Tab.Screen name="Historial" component={HistoryScreen} options={{ tabBarIcon: () => <Text>📜</Text> }}/>
      </Tab.Navigator>
    </AppContext.Provider>
  );
}

export const AppContext = React.createContext(null);

export default function App() {
  const [user, setUser] = useState(null);
  const [cloudState, setCloudState] = useState(null);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    const unsubAuth = auth.onAuthStateChanged(async (u) => {
      setUser(u);
      if (u) {
        const initial = await pullState(u.uid);
        setCloudState(initial || {
          settings:{ currency:'USD', businessName:'Mi Negocio' },
          expensesDaily:[], incomesDaily:[], invoices:[], _cloud:{ updatedAt: Date.now() }
        });
        subscribeState(u.uid, (remote) => setCloudState(remote)); // live sync
      } else {
        setCloudState(null);
      }
      setBooting(false);
    });
    return () => unsubAuth();
  }, []);

  if (booting) {
    return <View style={{ flex:1, justifyContent:'center', alignItems:'center' }}>
      <ActivityIndicator color="#C7A24B" /><Text style={{ color:'#F2F3F5', marginTop:8 }}>Cargando…</Text>
    </View>;
  }

  return (
    <NavigationContainer theme={theme}>
      <Stack.Navigator screenOptions={{ headerShown:false }}>
        {!user ? (
          <Stack.Screen name="SignIn" component={SignInScreen} />
        ) : !cloudState ? (
          <Stack.Screen name="Loading" component={() => (
            <View style={{ flex:1, justifyContent:'center', alignItems:'center' }}>
              <ActivityIndicator color="#C7A24B" /><Text style={{ color:'#F2F3F5', marginTop:8 }}>Sincronizando…</Text>
            </View>
          )} />
        ) : (
          <Stack.Screen name="Tabs">
            {() => <Tabs user={user} cloudState={cloudState} setCloudState={setCloudState} />}
          </Stack.Screen>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}


import React, { useState, useEffect, createContext, useContext, useMemo, useCallback } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';

import { Layout } from './components/Layout.tsx';
import { LoginPage } from './components/Login.tsx';
import { DashboardPage } from './components/Dashboard.tsx';
import { SchedulePage } from './components/Schedule.tsx';
import { ServiceRegistryPage } from './components/ServiceRegistry.tsx';
import { ReportsPage } from './components/Reports.tsx';
import { SettingsPage } from './components/Settings.tsx';
import { Service, Appointment, AppointmentStatus, Transaction } from './types.ts';
import { supabase } from './services/supabaseClient.ts';

// --- THEME CONTEXT ---
type Theme = 'light' | 'dark';
interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}
const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within a ThemeProvider');
  return context;
};

const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<Theme>(() => {
    const storedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    return (storedTheme as Theme) || (prefersDark ? 'dark' : 'light');
  });

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove(theme === 'dark' ? 'light' : 'dark');
    root.classList.add(theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prevTheme => (prevTheme === 'light' ? 'dark' : 'light'));
  };

  const value = useMemo(() => ({ theme, toggleTheme, setTheme }), [theme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

// --- SERVICES CONTEXT ---
interface ServicesContextType {
    services: Service[];
    addService: (service: Omit<Service, 'id' | 'created_at'>) => Promise<void>;
    updateService: (updatedService: Service) => Promise<void>;
    deleteService: (serviceId: number) => Promise<void>;
}
const ServicesContext = createContext<ServicesContextType | undefined>(undefined);

export const useServices = () => {
    const context = useContext(ServicesContext);
    if(!context) throw new Error('useServices must be used within a ServicesProvider');
    return context;
}

const ServicesProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
    const [services, setServices] = useState<Service[]>([]);

    const fetchServices = useCallback(async () => {
        const { data, error } = await supabase.from('services').select('*').order('name');
        if (error) console.error('Error fetching services:', error);
        else setServices(data || []);
    }, []);

    useEffect(() => {
        fetchServices();
    }, [fetchServices]);

    const addService = useCallback(async (service: Omit<Service, 'id' | 'created_at'>) => {
        const { data, error } = await supabase.from('services').insert([service]).select();
        if (error) {
            console.error('Error adding service:', error);
            throw error;
        }
        if (data) {
            setServices(prev => [...prev, data[0]].sort((a, b) => a.name.localeCompare(b.name)));
        }
    }, []);

    const updateService = useCallback(async (updatedService: Service) => {
        const { id, ...serviceData } = updatedService;
        const { data, error } = await supabase.from('services').update(serviceData).eq('id', id).select();
        if (error) {
            console.error('Error updating service:', error);
            throw error;
        }
        if(data) {
            setServices(prev => prev.map(s => s.id === id ? data[0] : s));
        }
    }, []);

    const deleteService = useCallback(async (serviceId: number) => {
        const { error } = await supabase.from('services').delete().eq('id', serviceId);
        if (error) {
            console.error('Error deleting service:', error);
            throw error;
        }
        else {
            setServices(prev => prev.filter(s => s.id !== serviceId));
        }
    }, []);

    const value = useMemo(() => ({ services, addService, updateService, deleteService }), [services, addService, updateService, deleteService]);
    
    return <ServicesContext.Provider value={value}>{children}</ServicesContext.Provider>;
}

// --- TRANSACTIONS CONTEXT ---
interface TransactionsContextType {
    transactions: Transaction[];
    addTransaction: (transaction: Omit<Transaction, 'id' | 'created_at'>) => Promise<void>;
}
const TransactionsContext = createContext<TransactionsContextType | undefined>(undefined);

export const useTransactions = () => {
    const context = useContext(TransactionsContext);
    if (!context) throw new Error('useTransactions must be used within a TransactionsProvider');
    return context;
};

const TransactionsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    
    const fetchTransactions = useCallback(async () => {
        const { data, error } = await supabase.from('transactions').select('*').order('created_at', { ascending: false });
        if (error) console.error('Error fetching transactions:', error);
        else {
            const mappedData = data?.map(({ clientname, paymentmethod, ...rest }) => ({
                ...rest,
                clientName: clientname,
                paymentMethod: paymentmethod,
            })) || [];
            setTransactions(mappedData);
        }
    }, []);

    useEffect(() => {
        fetchTransactions();
    }, [fetchTransactions]);


    const addTransaction = useCallback(async (transactionData: Omit<Transaction, 'id' | 'created_at'>) => {
        const newTransactionData = {
            clientname: transactionData.clientName,
            service: transactionData.service,
            date: transactionData.date,
            paymentmethod: transactionData.paymentMethod,
            subtotal: transactionData.subtotal,
            discount: transactionData.discount,
            value: transactionData.value,
        };
        const { data, error } = await supabase.from('transactions').insert([newTransactionData]).select();
        if (error) {
            console.error('Error adding transaction:', error);
            throw error;
        }
        if(data) {
            const { clientname, paymentmethod, ...rest } = data[0];
            const mappedTransaction = { ...rest, clientName: clientname, paymentMethod: paymentmethod };
            setTransactions(prev => [mappedTransaction, ...prev]);
        }
    }, []);

    const value = useMemo(() => ({ transactions, addTransaction }), [transactions, addTransaction]);

    return <TransactionsContext.Provider value={value}>{children}</TransactionsContext.Provider>;
}

// --- APPOINTMENTS CONTEXT ---
interface AppointmentsContextType {
    appointments: Appointment[];
    addAppointment: (appointment: Omit<Appointment, 'id' | 'status' | 'created_at'>) => Promise<void>;
    updateAppointmentStatus: (appointmentId: number, status: AppointmentStatus) => Promise<void>;
}
const AppointmentsContext = createContext<AppointmentsContextType | undefined>(undefined);

export const useAppointments = () => {
    const context = useContext(AppointmentsContext);
    if (!context) throw new Error('useAppointments must be used within a AppointmentsProvider');
    return context;
};

const AppointmentsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [appointments, setAppointments] = useState<Appointment[]>([]);

    const fetchAppointments = useCallback(async () => {
        const { data, error } = await supabase.from('appointments').select('*').order('date').order('time');
        if (error) console.error('Error fetching appointments:', error);
        else {
            const mappedData = data?.map(({ clientname, ...rest }) => ({
                ...rest,
                clientName: clientname,
            })) || [];
            setAppointments(mappedData);
        }
    }, []);
    
    useEffect(() => {
        fetchAppointments();
    }, [fetchAppointments]);


    const addAppointment = useCallback(async (appointmentData: Omit<Appointment, 'id' | 'status' | 'created_at'>) => {
        const newAppointmentData = {
            clientname: appointmentData.clientName,
            service: appointmentData.service,
            date: appointmentData.date,
            time: appointmentData.time,
            status: AppointmentStatus.Confirmed,
        };
        const { data, error } = await supabase.from('appointments').insert([newAppointmentData]).select();
        
        if (error) {
            console.error('Error adding appointment:', error);
            throw error;
        }
        if (data) {
            const { clientname, ...rest } = data[0];
            const mappedAppointment = { ...rest, clientName: clientname };
            setAppointments(prev => [...prev, mappedAppointment]);
        }
    }, []);

    const updateAppointmentStatus = useCallback(async (appointmentId: number, status: AppointmentStatus) => {
        const { data, error } = await supabase.from('appointments').update({ status }).eq('id', appointmentId).select();

        if (error) {
            console.error('Error updating appointment status:', error);
            throw error;
        }
        if (data) {
            const { clientname, ...rest } = data[0];
            const mappedAppointment = { ...rest, clientName: clientname };
            setAppointments(prev => prev.map(app => 
                app.id === appointmentId ? mappedAppointment : app
            ));
        }
    }, []);

    const value = useMemo(() => ({ appointments, addAppointment, updateAppointmentStatus }), [appointments, addAppointment, updateAppointmentStatus]);

    return <AppointmentsContext.Provider value={value}>{children}</AppointmentsContext.Provider>;
};


// --- MAIN APP COMPONENT ---
const App: React.FC = () => {
  return (
    <ThemeProvider>
      <ServicesProvider>
        <AppointmentsProvider>
          <TransactionsProvider>
            <HashRouter>
            <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/" element={<Layout />}>
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="dashboard" element={<DashboardPage />} />
                <Route path="schedule" element={<SchedulePage />} />
                <Route path="register-service" element={<ServiceRegistryPage />} />
                <Route path="reports" element={<ReportsPage />} />
                <Route path="settings" element={<SettingsPage />} />
                {/* Placeholder routes for other nav items */}
                <Route path="clients" element={<PlaceholderPage title="Clientes" />} />
                <Route path="financial" element={<PlaceholderPage title="Financeiro" />} />
                </Route>
                <Route path="*" element={<Navigate to="/" />} />
            </Routes>
            </HashRouter>
          </TransactionsProvider>
        </AppointmentsProvider>
      </ServicesProvider>
    </ThemeProvider>
  );
};

// Placeholder component for routes that are not fully implemented
const PlaceholderPage: React.FC<{ title: string }> = ({ title }) => (
  <div className="flex flex-col items-center justify-center h-full text-center">
    <h1 className="text-4xl font-bold text-zinc-800 dark:text-white">{title}</h1>
    <p className="mt-2 text-lg text-zinc-600 dark:text-zinc-400">Esta página está em construção.</p>
    <span className="material-symbols-outlined text-9xl mt-8 text-primary/50">construction</span>
  </div>
);

export default App;
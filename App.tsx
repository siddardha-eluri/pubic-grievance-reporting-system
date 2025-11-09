import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line } from 'recharts';
import { Grievance, GrievanceStatus, User, UserRole, ChatMessage } from './types';
import { DEPARTMENTS, INITIAL_GRIEVANCES, MOCK_USER_ADMIN, MOCK_USER_CITIZEN } from './constants';
import { getChatbotResponse, generateSolutionForGrievance, answerFromDocuments, checkSpam, parseGrievanceFromText } from './services/geminiService';
import { 
    IconUser, IconClipboardList, IconPencilAlt, IconChat, IconLogout, IconPaperclip,
    IconCheckCircle, IconXCircle, IconClock, IconDocumentText, IconSparkles, IconSend,
    IconFilter, IconUsers, IconBuildingOffice, IconArrowLeft, IconMicrophone, IconLocationMarker,
    IconShieldCheck, IconExclamation, IconMegaphone, IconChevronDown, IconHome, IconChartBar, IconTrendingUp
} from './components/icons';
import { translations } from './translations';

type Language = 'en' | 'hi' | 'te';

// --- UTILITY & HELPER COMPONENTS ---

const Spinner = () => (
    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
);

const StatusBadge: React.FC<{ status: GrievanceStatus }> = ({ status }) => {
    const statusStyles: { [key in GrievanceStatus]: string } = {
        [GrievanceStatus.FILED]: 'bg-blue-100 text-blue-800',
        [GrievanceStatus.UNDER_REVIEW]: 'bg-yellow-100 text-yellow-800',
        [GrievanceStatus.APPROVED]: 'bg-green-100 text-green-800',
        [GrievanceStatus.REJECTED]: 'bg-red-100 text-red-800',
    };
    return (
        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusStyles[status]}`}>
            {status}
        </span>
    );
};

const LanguageSwitcher: React.FC<{ language: Language; setLanguage: (lang: Language) => void; }> = ({ language, setLanguage }) => (
    <select 
        value={language} 
        onChange={e => setLanguage(e.target.value as Language)}
        className="bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 rounded-md py-1 px-2 text-sm focus:ring-indigo-500 focus:border-indigo-500"
    >
        <option value="en">English</option>
        <option value="hi">हिन्दी</option>
        <option value="te">తెలుగు</option>
    </select>
);

// A simple string similarity function (Sørensen-Dice coefficient)
const stringSimilarity = (a: string, b: string) => {
    a = a.replace(/\s+/g, '').toLowerCase();
    b = b.replace(/\s+/g, '').toLowerCase();
    if (!a.length && !b.length) return 1;
    if (!a.length || !b.length) return 0;
    if (a === b) return 1;

    const aBigrams = new Map();
    for (let i = 0; i < a.length - 1; i++) {
        const bigram = a.substring(i, i + 2);
        aBigrams.set(bigram, (aBigrams.get(bigram) || 0) + 1);
    }

    let intersectionSize = 0;
    for (let i = 0; i < b.length - 1; i++) {
        const bigram = b.substring(i, i + 2);
        if (aBigrams.has(bigram) && aBigrams.get(bigram) > 0) {
            intersectionSize++;
            aBigrams.set(bigram, aBigrams.get(bigram) - 1);
        }
    }
    return (2.0 * intersectionSize) / (a.length + b.length - 2);
};


// --- NEW HOMEPAGE ---

const HomePage: React.FC<{ onLoginClick: () => void; t: (key: string) => string; language: Language; setLanguage: (lang: Language) => void; }> = ({ onLoginClick, t, language, setLanguage }) => (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200">
        <nav className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md sticky top-0 z-20 border-b border-slate-200 dark:border-slate-800">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    <div className="flex items-center">
                        <IconShieldCheck className="h-8 w-8 text-indigo-500" />
                        <span className="font-bold text-xl ml-2">{t('mainHeading')}<span className="text-indigo-500">{t('mainHeadingAccent')}</span></span>
                    </div>
                    <div className="hidden md:flex items-center space-x-8">
                        <a href="#" className="font-medium hover:text-indigo-500 transition-colors">{t('home')}</a>
                        <a href="#" className="font-medium hover:text-indigo-500 transition-colors">{t('howItWorks')}</a>
                        <a href="#" className="font-medium hover:text-indigo-500 transition-colors">{t('contact')}</a>
                    </div>
                    <div className="flex items-center space-x-4">
                         <LanguageSwitcher language={language} setLanguage={setLanguage} />
                         <button onClick={onLoginClick} className="bg-indigo-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-indigo-700 transition-colors">
                            {t('login')}
                        </button>
                    </div>
                </div>
            </div>
        </nav>

        <main>
            {/* Hero Section */}
            <section className="py-20 md:py-32 text-center bg-white dark:bg-slate-800/50">
                <div className="max-w-4xl mx-auto px-4">
                    <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-slate-900 dark:text-white">{t('heroTitle')}</h1>
                    <p className="mt-6 text-lg text-slate-600 dark:text-slate-300">{t('heroSubtitle')}</p>
                    <button onClick={onLoginClick} className="mt-8 bg-indigo-600 text-white font-bold py-3 px-8 rounded-lg hover:bg-indigo-700 transition-transform transform hover:scale-105">
                        {t('getStarted')}
                    </button>
                </div>
            </section>
            
            {/* How It Works Section */}
            <section className="py-20">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center">
                        <h2 className="text-3xl font-bold">{t('howItWorksTitle')}</h2>
                    </div>
                    <div className="mt-12 grid gap-10 md:grid-cols-3">
                        <div className="text-center p-6 bg-white dark:bg-slate-800 rounded-lg shadow-md">
                            <div className="flex items-center justify-center h-12 w-12 rounded-md bg-indigo-500 text-white mx-auto">
                                <IconPencilAlt className="h-6 w-6" />
                            </div>
                            <h3 className="mt-5 text-lg font-medium">{t('step1Title')}</h3>
                            <p className="mt-2 text-base text-slate-500 dark:text-slate-400">{t('step1Desc')}</p>
                        </div>
                        <div className="text-center p-6 bg-white dark:bg-slate-800 rounded-lg shadow-md">
                            <div className="flex items-center justify-center h-12 w-12 rounded-md bg-indigo-500 text-white mx-auto">
                                <IconClipboardList className="h-6 w-6" />
                            </div>
                            <h3 className="mt-5 text-lg font-medium">{t('step2Title')}</h3>
                            <p className="mt-2 text-base text-slate-500 dark:text-slate-400">{t('step2Desc')}</p>
                        </div>
                        <div className="text-center p-6 bg-white dark:bg-slate-800 rounded-lg shadow-md">
                             <div className="flex items-center justify-center h-12 w-12 rounded-md bg-indigo-500 text-white mx-auto">
                                <IconSparkles className="h-6 w-6" />
                            </div>
                            <h3 className="mt-5 text-lg font-medium">{t('step3Title')}</h3>
                            <p className="mt-2 text-base text-slate-500 dark:text-slate-400">{t('step3Desc')}</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Contact Section */}
            <section className="py-20 bg-white dark:bg-slate-800/50">
                 <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                     <h2 className="text-3xl font-bold">{t('contactTitle')}</h2>
                     <p className="mt-4 text-lg text-slate-600 dark:text-slate-300">{t('contactDesc')}</p>
                     <a href={`mailto:${t('contactEmail')}`} className="mt-6 inline-block text-lg font-medium text-indigo-600 dark:text-indigo-400 hover:underline">{t('contactEmail')}</a>
                 </div>
            </section>
        </main>
        <footer className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
            <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 text-center text-sm text-slate-500 dark:text-slate-400">
                &copy; {new Date().getFullYear()} Public Grievance .AI. All rights reserved.
            </div>
        </footer>
    </div>
);


// --- LOGIN HUB ---

const LoginHub: React.FC<{ onPortalSelect: (role: UserRole) => void; onBack: () => void; t: (key: string) => string; }> = ({ onPortalSelect, onBack, t }) => (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900 flex flex-col items-center justify-center p-4">
         <button onClick={onBack} className="absolute top-6 left-6 flex items-center text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
            <IconHome className="h-5 w-5 mr-2" />
            {t('home')}
        </button>
        <header className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-extrabold text-slate-800 dark:text-white">
                {t('mainHeading')}<span className="text-indigo-600 dark:text-indigo-400">{t('mainHeadingAccent')}</span>
            </h1>
            <p className="mt-4 text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto">
                {t('subHeading')}
            </p>
        </header>
        <main className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-8 flex flex-col items-center text-center transform hover:scale-105 transition-transform duration-300">
                <IconUsers className="h-16 w-16 text-indigo-500 mb-4" />
                <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">{t('forCitizens')}</h2>
                <p className="text-slate-500 dark:text-slate-400 mb-6">
                    {t('citizensDesc')}
                </p>
                <button onClick={() => onPortalSelect(UserRole.CITIZEN)} className="w-full bg-indigo-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-indigo-700 transition-colors flex items-center justify-center">
                    {t('enterCitizenPortal')}
                </button>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-8 flex flex-col items-center text-center transform hover:scale-105 transition-transform duration-300">
                <IconBuildingOffice className="h-16 w-16 text-teal-500 mb-4" />
                <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">{t('forAdmins')}</h2>
                <p className="text-slate-500 dark:text-slate-400 mb-6">
                    {t('adminsDesc')}
                </p>
                <button onClick={() => onPortalSelect(UserRole.ADMIN)} className="w-full bg-teal-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-teal-700 transition-colors flex items-center justify-center">
                    {t('enterAdminPortal')}
                </button>
            </div>
        </main>
    </div>
);

// --- LOGIN PAGE ---

const LoginPage: React.FC<{ role: UserRole; onAuth: (type: 'login' | 'register', user: Partial<User>) => boolean; onBack: () => void; t: (key: string) => string; }> = ({ role, onAuth, onBack, t }) => {
    const [isRegister, setIsRegister] = useState(false);
    
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [department, setDepartment] = useState(DEPARTMENTS[0]);
    const [attestation, setAttestation] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (isRegister && role === UserRole.CITIZEN && !attestation) {
            setError(t('attestationRequired'));
            return;
        }

        const authType = isRegister ? 'register' : 'login';
        let success = false;
        
        if (role === UserRole.CITIZEN) {
            success = onAuth(authType, { name, email, phone, role });
        } else {
            success = onAuth(authType, { name, email, password, department, role });
        }

        if (!success) {
            if (isRegister) {
                setError(t('emailExists'));
            } else {
                setError(t('invalidCredentials'));
            }
        }
    };

    const toggleMode = () => {
        setIsRegister(!isRegister);
        setError('');
    };

    const isCitizen = role === UserRole.CITIZEN;
    
    return (
        <div className="min-h-screen bg-slate-100 dark:bg-slate-900 flex flex-col items-center justify-center p-4 relative">
             <button onClick={onBack} className="absolute top-6 left-6 flex items-center text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                <IconArrowLeft className="h-5 w-5 mr-2" />
                {t('back')}
            </button>
            <div className="w-full max-w-md">
                <div className="text-center mb-8">
                    {isCitizen ? <IconUsers className="mx-auto h-12 w-12 text-indigo-500" /> : <IconBuildingOffice className="mx-auto h-12 w-12 text-teal-500" />}
                    <h2 className="mt-4 text-3xl font-bold text-slate-800 dark:text-white">{isCitizen ? t('citizenLogin') : t('adminLogin')}</h2>
                    <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{isCitizen ? t('citizenLoginSub') : t('adminLoginSub')}</p>
                </div>
                <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-800 shadow-xl rounded-lg p-8 space-y-6">
                    {isRegister && (
                        <div>
                            <label htmlFor="name" className="block text-sm font-medium text-slate-700 dark:text-slate-300">{t('fullName')}</label>
                            <input type="text" id="name" value={name} onChange={e => setName(e.target.value)} required className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-slate-700 dark:border-slate-600 dark:text-white" placeholder={t('placeholderFullName')} />
                        </div>
                    )}
                    <div>
                        <label htmlFor="email" className="block text-sm font-medium text-slate-700 dark:text-slate-300">{isCitizen ? t('emailAddress') : t('officialEmail')}</label>
                        <input type="email" id="email" value={email} onChange={e => setEmail(e.target.value)} required className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-slate-700 dark:border-slate-600 dark:text-white" placeholder={isCitizen ? t('placeholderEmail') : t('placeholderAdminEmail')} />
                    </div>
                    {isCitizen ? (
                        <div>
                            <label htmlFor="phone" className="block text-sm font-medium text-slate-700 dark:text-slate-300">{t('phoneAsPassword')}</label>
                            <input type="tel" id="phone" value={phone} onChange={e => setPhone(e.target.value)} required className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-slate-700 dark:border-slate-600 dark:text-white" placeholder={t('placeholderPhone')} />
                        </div>
                    ) : (
                        <div>
                             <label htmlFor="admin-password" className="block text-sm font-medium text-slate-700 dark:text-slate-300">{t('password')}</label>
                            <input type="password" id="admin-password" value={password} onChange={e => setPassword(e.target.value)} required className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-teal-500 focus:border-teal-500 sm:text-sm dark:bg-slate-700 dark:border-slate-600 dark:text-white" placeholder={t('placeholderPassword')} />
                        </div>
                    )}
                    {!isCitizen && isRegister && (
                         <div>
                            <label htmlFor="admin-department" className="block text-sm font-medium text-slate-700 dark:text-slate-300">{t('department')}</label>
                            <select id="admin-department" value={department} onChange={e => setDepartment(e.target.value)} className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:outline-none focus:ring-teal-500 focus:border-teal-500 sm:text-sm rounded-md">
                                {DEPARTMENTS.map(dep => <option key={dep}>{dep}</option>)}
                            </select>
                        </div>
                    )}
                     {isCitizen && isRegister && (
                        <div className="flex items-start">
                            <div className="flex items-center h-5">
                                <input id="attestation" name="attestation" type="checkbox" checked={attestation} onChange={e => setAttestation(e.target.checked)} required className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-slate-300 rounded" />
                            </div>
                            <div className="ml-3 text-sm">
                                <label htmlFor="attestation" className="font-medium text-slate-700 dark:text-slate-300">{t('attestation')}</label>
                            </div>
                        </div>
                    )}
                    {error && <p className="text-sm text-red-500 text-center">{error}</p>}
                    <button type="submit" className={`w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${isCitizen ? 'bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500' : 'bg-teal-600 hover:bg-teal-700 focus:ring-teal-500'}`}>
                        {isRegister ? t('registerAction') : t('loginAction')}
                    </button>
                    <p className="text-center text-sm">
                        <button type="button" onClick={toggleMode} className="font-medium text-indigo-600 dark:text-indigo-400 hover:underline">
                            {isRegister ? t('toggleToLogin') : t('toggleToRegister')}
                        </button>
                    </p>
                </form>
            </div>
        </div>
    );
};

// --- CITIZEN PORTAL COMPONENTS ---

const HeaderDropdown: React.FC<{ user: User; onLogout: () => void; onProfile: () => void; t: (key: string) => string; }> = ({ user, onLogout, onProfile, t }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
        <div className="relative" ref={dropdownRef}>
            <button onClick={() => setIsOpen(!isOpen)} className="flex items-center space-x-2">
                 <div className="text-right">
                    <p className="font-semibold text-slate-700 dark:text-slate-200">{user.name}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{user.role === UserRole.CITIZEN ? user.email : user.department}</p>
                </div>
                <IconChevronDown className={`h-4 w-4 text-slate-500 transition-transform ${isOpen ? 'transform rotate-180' : ''}`} />
            </button>
            {isOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-700 rounded-md shadow-lg py-1 ring-1 ring-black ring-opacity-5 z-20">
                    <a href="#" onClick={(e) => { e.preventDefault(); onProfile(); setIsOpen(false); }} className="block px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-600">{t('myProfile')}</a>
                    <a href="#" onClick={(e) => { e.preventDefault(); onLogout(); }} className="block px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-600">{t('logout')}</a>
                </div>
            )}
        </div>
    );
};

const CitizenHeader: React.FC<{ user: User; onLogout: () => void; onProfile: () => void; t: (key: string) => string; language: Language; setLanguage: (lang: Language) => void; }> = ({ user, onLogout, onProfile, t, language, setLanguage }) => (
    <header className="bg-white dark:bg-slate-800 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
            <h1 className="text-2xl font-bold text-slate-800 dark:text-white">
                {t('citizenPortalTitle')}
            </h1>
            <div className="flex items-center space-x-4">
                <LanguageSwitcher language={language} setLanguage={setLanguage} />
                <HeaderDropdown user={user} onLogout={onLogout} onProfile={onProfile} t={t} />
            </div>
        </div>
    </header>
);

const CitizenStats: React.FC<{ grievances: Grievance[]; t: (key: string) => string; }> = ({ grievances, t }) => {
    const stats = useMemo(() => {
        const total = grievances.length;
        const resolved = grievances.filter(g => g.status === GrievanceStatus.APPROVED).length;
        const rejected = grievances.filter(g => g.status === GrievanceStatus.REJECTED).length;
        const pending = total - resolved - rejected;
        return { total, resolved, pending, rejected };
    }, [grievances]);

    const statItems = [
        { title: t('totalGrievances'), value: stats.total, icon: IconClipboardList, color: 'text-blue-500' },
        { title: t('resolved'), value: stats.resolved, icon: IconCheckCircle, color: 'text-green-500' },
        { title: t('pending'), value: stats.pending, icon: IconClock, color: 'text-yellow-500' },
        { title: t('rejected'), value: stats.rejected, icon: IconXCircle, color: 'text-red-500' },
    ];

    return (
        <div className="mb-8">
            <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-4">{t('myStats')}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {statItems.map(item => (
                    <div key={item.title} className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-md flex items-center space-x-4">
                        <div className={`p-3 rounded-full bg-slate-100 dark:bg-slate-700 ${item.color}`}>
                           <item.icon className="h-8 w-8" />
                        </div>
                        <div>
                            <p className="text-3xl font-bold text-slate-800 dark:text-white">{item.value}</p>
                            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{item.title}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const SubmitGrievance: React.FC<{ onGrievanceSubmit: (grievance: Omit<Grievance, 'id' | 'status' | 'dateFiled' | 'history' | 'aiSolution'>) => Promise<boolean>, user: User, t: (key: string) => string }> = ({ onGrievanceSubmit, user, t }) => {
    const [organization, setOrganization] = useState(DEPARTMENTS[0]);
    const [description, setDescription] = useState('');
    const [documents, setDocuments] = useState<File[]>([]);
    const [location, setLocation] = useState<{ latitude: number, longitude: number } | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [isDraggingOver, setIsDraggingOver] = useState(false);

    const handleGetLocation = () => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setLocation({
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                    });
                    setError('');
                },
                () => {
                    setError(t('locationError'));
                }
            );
        } else {
            setError("Geolocation is not supported by this browser.");
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!description.trim()) {
            setError(t('errorDescriptionEmpty'));
            return;
        }
        setError('');
        setIsSubmitting(true);
        
        const isSpam = await checkSpam(description);
        if (isSpam) {
            setError(t('errorSpam'));
            setIsSubmitting(false);
            return;
        }

        const docContents = await Promise.all(documents.map(async (file) => {
            const content = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = (error) => reject(error);
                reader.readAsDataURL(file);
            });
            return { name: file.name, content };
        }));

        const success = await onGrievanceSubmit({
            complainantName: user.name,
            complainantEmail: user.email,
            organization,
            description,
            documents: docContents,
            location: location || undefined,
        });

        if (success) {
            // Reset form
            setOrganization(DEPARTMENTS[0]);
            setDescription('');
            setDocuments([]);
            setLocation(null);
        } else {
            setError(t('errorDuplicate'));
        }
        setIsSubmitting(false);
    };

    const handleFileChange = (files: FileList | null) => {
        if (files) {
            const newFiles = Array.from(files);
            setDocuments(prev => {
                const existingFileNames = prev.map(f => f.name);
                const uniqueNewFiles = newFiles.filter(f => !existingFileNames.includes(f.name));
                return [...prev, ...uniqueNewFiles];
            });
        }
    };
    
    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDraggingOver(true);
    };

    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDraggingOver(false);
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDraggingOver(false);
        handleFileChange(e.dataTransfer.files);
    };
    
    return (
        <div className="bg-white dark:bg-slate-800 p-8 rounded-lg shadow-md">
            <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-6">{t('fileNewGrievance')}</h2>
            <form onSubmit={handleSubmit} className="space-y-6">
                 <div>
                    <label htmlFor="organization" className="block text-sm font-medium text-slate-700 dark:text-slate-300">{t('department')}</label>
                    <select id="organization" value={organization} onChange={e => setOrganization(e.target.value)} className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md">
                        {DEPARTMENTS.map(dep => <option key={dep}>{dep}</option>)}
                    </select>
                </div>
                <div>
                    <label htmlFor="description" className="block text-sm font-medium text-slate-700 dark:text-slate-300">{t('describeGrievance')}</label>
                    <textarea id="description" rows={5} value={description} onChange={e => setDescription(e.target.value)} className="mt-1 block w-full shadow-sm sm:text-sm border-slate-300 rounded-md dark:bg-slate-700 dark:border-slate-600 dark:text-white focus:ring-indigo-500 focus:border-indigo-500" placeholder={t('describeGrievance') + '...'}></textarea>
                </div>
                 <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">{t('location')}</label>
                    <div className="mt-1 flex items-center gap-4">
                        <button type="button" onClick={handleGetLocation} className="inline-flex items-center px-4 py-2 border border-slate-300 dark:border-slate-600 text-sm font-medium rounded-md shadow-sm text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600">
                           <IconLocationMarker className="h-5 w-5 mr-2"/> {t('getLocation')}
                        </button>
                        {location && <p className="text-sm text-green-600 dark:text-green-400">{t('locationCaptured')}</p>}
                    </div>
                 </div>
                 <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">{t('uploadDocuments')} <span className="text-xs text-slate-500">({t('mandatory')})</span></label>
                    <div 
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        className={`mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-slate-300 dark:border-slate-600 border-dashed rounded-md transition-colors ${isDraggingOver ? 'border-indigo-500 bg-indigo-50 dark:bg-slate-700/50' : ''}`}
                    >
                        <div className="space-y-1 text-center">
                            <IconPaperclip className="mx-auto h-12 w-12 text-slate-400" />
                            <div className="flex text-sm text-slate-600 dark:text-slate-400">
                                <label htmlFor="file-upload" className="relative cursor-pointer bg-transparent rounded-md font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 dark:focus-within:ring-offset-slate-800 focus-within:ring-indigo-500">
                                    <span>{t('uploadFile')}</span>
                                    <input id="file-upload" name="file-upload" type="file" multiple className="sr-only" onChange={e => handleFileChange(e.target.files)} required />
                                </label>
                                <p className="pl-1">{t('dragAndDrop')}</p>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-500">{t('fileTypes')}</p>
                        </div>
                    </div>
                     {documents.length > 0 && (
                        <div className="mt-4">
                            <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{t('selectedFiles')}</h4>
                            <ul className="border border-slate-200 dark:border-slate-700 rounded-md divide-y divide-slate-200 dark:divide-slate-700">
                                {documents.map((file, index) => (
                                    <li key={`${file.name}-${index}`} className="pl-3 pr-4 py-3 flex items-center justify-between text-sm">
                                        <div className="w-0 flex-1 flex items-center">
                                            <IconDocumentText className="flex-shrink-0 h-5 w-5 text-slate-400" aria-hidden="true" />
                                            <span className="ml-2 flex-1 w-0 truncate text-slate-700 dark:text-slate-300">{file.name}</span>
                                        </div>
                                        <div className="ml-4 flex-shrink-0">
                                            <button 
                                                type="button"
                                                onClick={() => setDocuments(docs => docs.filter((_, i) => i !== index))}
                                                className="font-medium text-red-600 dark:text-red-500 hover:text-red-700 dark:hover:text-red-400"
                                                aria-label={`Remove ${file.name}`}
                                            >
                                                {t('remove')}
                                            </button>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
                {error && <p className="text-sm text-red-600">{error}</p>}
                <button type="submit" disabled={isSubmitting} className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-300">
                    {isSubmitting ? <Spinner/> : t('submitGrievance')}
                </button>
            </form>
        </div>
    );
};

const GrievanceTracker: React.FC<{ grievances: Grievance[], t: (key: string) => string }> = ({ grievances, t }) => (
    <div className="bg-white dark:bg-slate-800 p-8 rounded-lg shadow-md">
        <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-6">{t('myGrievances')}</h2>
        <div className="space-y-4">
            {grievances.length === 0 ? <p className="text-slate-500 dark:text-slate-400">{t('noGrievances')}</p> :
                grievances.map(g => (
                <div key={g.id} className="border border-slate-200 dark:border-slate-700 p-4 rounded-lg">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="font-semibold text-slate-800 dark:text-white">{g.organization}</p>
                            <p className="text-sm text-slate-500 dark:text-slate-400">ID: {g.id} &bull; {t('dateFiled')}: {g.dateFiled}</p>
                        </div>
                        <StatusBadge status={g.status} />
                    </div>
                    <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{g.description}</p>
                </div>
            ))}
        </div>
    </div>
);

const UserProfile: React.FC<{ user: User, onUpdateUser: (user: User) => void, t: (key: string) => string }> = ({ user, onUpdateUser, t }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState({
        name: user.name,
        email: user.email,
        phone: user.phone || ''
    });

    const handleEditToggle = () => {
        if (!isEditing) {
            setFormData({ name: user.name, email: user.email, phone: user.phone || '' });
        }
        setIsEditing(!isEditing);
    };
    
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSave = () => {
        onUpdateUser({ ...user, ...formData });
        setIsEditing(false);
    };

    return (
        <div className="bg-white dark:bg-slate-800 p-8 rounded-lg shadow-md">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-slate-800 dark:text-white">{t('myProfile')}</h2>
                 <button onClick={handleEditToggle} className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white ${isEditing ? 'bg-slate-500 hover:bg-slate-600' : 'bg-indigo-600 hover:bg-indigo-700'}`}>
                    {isEditing ? t('cancel') : t('editProfile')}
                </button>
            </div>
            <div className="space-y-4">
                <div>
                    <label className="text-sm font-medium text-slate-500 dark:text-slate-400">{t('nameLabel')}</label>
                    {isEditing ? (
                        <input type="text" name="name" value={formData.name} onChange={handleInputChange} className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600 dark:text-white"/>
                    ) : (
                        <p className="text-slate-800 dark:text-white">{user.name}</p>
                    )}
                </div>
                <div>
                    <label className="text-sm font-medium text-slate-500 dark:text-slate-400">{t('emailLabel')}</label>
                     {isEditing ? (
                        <input type="email" name="email" value={formData.email} onChange={handleInputChange} className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600 dark:text-white"/>
                    ) : (
                        <p className="text-slate-800 dark:text-white">{user.email}</p>
                    )}
                </div>
                 <div>
                    <label className="text-sm font-medium text-slate-500 dark:text-slate-400">{t('phoneLabel')}</label>
                     {isEditing ? (
                        <input type="tel" name="phone" value={formData.phone} onChange={handleInputChange} className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600 dark:text-white"/>
                    ) : (
                        <p className="text-slate-800 dark:text-white">{user.phone || t('notSet')}</p>
                    )}
                </div>
                 {user.misuseStrikes && user.misuseStrikes > 0 && (
                    <div className="flex items-center p-3 rounded-md bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800/50">
                        <IconExclamation className="h-5 w-5 text-yellow-500 mr-3"/>
                        <p className="text-sm text-yellow-700 dark:text-yellow-300">
                            You have {user.misuseStrikes} warning(s) for filing false/duplicate complaints. Repeated misuse may lead to account suspension.
                        </p>
                    </div>
                 )}
                {isEditing && (
                    <button onClick={handleSave} className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700">
                        {t('saveChanges')}
                    </button>
                )}
            </div>
        </div>
    );
};

const Feedback: React.FC<{ t: (key: string) => string; onSubmit: () => void; }> = ({ t, onSubmit }) => {
    const [feedbackText, setFeedbackText] = useState('');
    
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // In a real app, this would send the feedback to a server.
        console.log("Feedback submitted:", feedbackText);
        setFeedbackText('');
        onSubmit();
    };

    return (
        <div className="bg-white dark:bg-slate-800 p-8 rounded-lg shadow-md">
            <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-4">{t('feedbackTitle')}</h2>
            <p className="text-slate-600 dark:text-slate-300 mb-6">{t('feedbackPrompt')}</p>
            <form onSubmit={handleSubmit}>
                <textarea
                    rows={6}
                    value={feedbackText}
                    onChange={(e) => setFeedbackText(e.target.value)}
                    className="w-full shadow-sm sm:text-sm border-slate-300 rounded-md dark:bg-slate-700 dark:border-slate-600 dark:text-white focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder={t('feedbackPlaceholder')}
                    required
                />
                <button type="submit" className="mt-4 w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                    {t('submitFeedback')}
                </button>
            </form>
        </div>
    );
};


const ChatbotModal: React.FC<{ onClose: () => void; t: (key: string) => string; }> = ({ onClose, t }) => {
    const [messages, setMessages] = useState<ChatMessage[]>([{ role: 'model', text: t('chatbotGreeting') }]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }

    useEffect(scrollToBottom, [messages]);

    const handleSend = async () => {
        if (!input.trim()) return;
        const userMessage: ChatMessage = { role: 'user', text: input };
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);
        
        const responseText = await getChatbotResponse([...messages, userMessage], input);
        
        setMessages(prev => [...prev, { role: 'model', text: responseText }]);
        setIsLoading(false);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end justify-end">
            <div className="bg-white dark:bg-slate-800 w-full max-w-md h-[70vh] m-4 rounded-t-lg shadow-2xl flex flex-col">
                <header className="p-4 border-b dark:border-slate-700 flex justify-between items-center">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center"><IconSparkles className="h-5 w-5 mr-2 text-indigo-500"/> {t('aiAssistant')}</h3>
                    <button onClick={onClose} className="text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white">&times;</button>
                </header>
                <div className="flex-1 p-4 overflow-y-auto space-y-4">
                    {messages.map((msg, index) => (
                        <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${msg.role === 'user' ? 'bg-indigo-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-white'}`}>
                                <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                            </div>
                        </div>
                    ))}
                    {isLoading && (
                        <div className="flex justify-start">
                             <div className="max-w-xs lg:max-w-md px-4 py-2 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-white">
                                <div className="flex items-center space-x-2">
                                    <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                                    <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                                    <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce"></div>
                                </div>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>
                <div className="p-4 border-t dark:border-slate-700 flex items-center">
                    <input type="text" value={input} onChange={e => setInput(e.target.value)} onKeyPress={e => e.key === 'Enter' && handleSend()} placeholder={t('typeMessage')} className="flex-1 p-2 border border-slate-300 dark:border-slate-600 rounded-l-md focus:ring-indigo-500 focus:border-indigo-500 dark:bg-slate-700 dark:text-white" />
                    <button onClick={handleSend} disabled={isLoading} className="bg-indigo-600 text-white p-2 rounded-r-md hover:bg-indigo-700 disabled:bg-indigo-300">
                       <IconSend className="h-5 w-5" />
                    </button>
                </div>
            </div>
        </div>
    );
};

const VoiceAssistantModal: React.FC<{
    onClose: () => void;
    onSubmit: (grievanceData: { organization: string, description: string, documents: {name: string, content: string}[], location?: {latitude: number, longitude: number} }) => Promise<boolean>;
    t: (key: string) => string;
    initialLanguage: Language;
}> = ({ onClose, onSubmit, t, initialLanguage }) => {
    // @ts-ignore
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const isSupported = !!SpeechRecognition;

    const [step, setStep] = useState<'idle' | 'listening' | 'processing' | 'confirming' | 'uploading' | 'submitting'>('idle');
    const [transcript, setTranscript] = useState('');
    const [error, setError] = useState('');
    const [parsedData, setParsedData] = useState<{ organization: string; description: string }>({ organization: '', description: '' });
    const [documents, setDocuments] = useState<File[]>([]);
    const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
    const [lang, setLang] = useState<Language>(initialLanguage);

    const recognitionRef = useRef<any | null>(null);
    const stepRef = useRef(step);
    stepRef.current = step;
    const transcriptRef = useRef(transcript);
    transcriptRef.current = transcript;

    const langCodeMap = { en: 'en-US', hi: 'hi-IN', te: 'te-IN' };

    const processTranscript = useCallback(async (text: string) => {
        setStep('processing');
        const result = await parseGrievanceFromText(text, DEPARTMENTS);
        if (result.error) {
            setError(result.error);
            setStep('idle');
        } else {
            setParsedData({
                organization: result.department || DEPARTMENTS[0],
                description: result.description,
            });
            setStep('confirming');
        }
    }, [t]);
    
     const handleGetLocation = useCallback(() => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => setLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
                () => setError(t('locationError'))
            );
        }
    }, [t]);

    useEffect(() => {
        if (!isSupported) return;

        const recognition = new SpeechRecognition();
        recognitionRef.current = recognition;
        
        recognition.continuous = true;
        recognition.interimResults = true;

        recognition.onresult = (event: any) => {
            let fullTranscript = "";
            for (let i = 0; i < event.results.length; i++) {
                fullTranscript += event.results[i][0].transcript;
            }
            setTranscript(fullTranscript);
        };

        recognition.onerror = (event: any) => {
            console.error('Speech recognition error', event.error);
            if (event.error === 'not-allowed') {
                setError(t('voicePermissionDenied'));
            } else if (event.error === 'no-speech') {
                setError(t('voiceNoInput'));
            } else {
                setError(`${t('voiceError')} (${event.error})`);
            }
        };

        recognition.onend = () => {
            if (stepRef.current === 'listening') {
                const finalTranscript = transcriptRef.current;
                if (finalTranscript.trim()) {
                    processTranscript(finalTranscript);
                } else {
                    setStep('idle');
                }
            }
        };
        
        return () => {
            if (recognitionRef.current) {
                recognitionRef.current.stop();
            }
        };
    }, [isSupported, processTranscript, t]);

    useEffect(() => {
        if (recognitionRef.current) {
            recognitionRef.current.lang = langCodeMap[lang];
        }
    }, [lang]);


    const handleStart = () => {
        if (recognitionRef.current && stepRef.current === 'idle') {
            setTranscript('');
            setError('');
            setStep('listening');
            try {
                recognitionRef.current.start();
            } catch (e) {
                console.error("Could not start speech recognition:", e);
                setStep('idle');
            }
        }
    };

    const handleStop = () => {
        if (recognitionRef.current && stepRef.current === 'listening') {
            recognitionRef.current.stop();
        }
    };
    
    const handleConfirm = () => {
        handleGetLocation(); // Start fetching location
        setStep('uploading');
    };

    const handleSubmit = async () => {
        setStep('submitting');
         const docContents = await Promise.all(documents.map(async (file) => {
            const content = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = (error) => reject(error);
                reader.readAsDataURL(file);
            });
            return { name: file.name, content };
        }));

        const success = await onSubmit({ ...parsedData, documents: docContents, location: location || undefined });
        if(success) {
            onClose();
        } else {
            setError(t('errorDuplicate'));
            setStep('confirming'); // Go back to confirmation step
        }
    };
    
    const handleRetry = () => {
        setTranscript('');
        setError('');
        setStep('idle');
    };
    
     const handleFileChange = (files: FileList | null) => {
        if (files) setDocuments(prev => [...prev, ...Array.from(files)]);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-xl shadow-2xl flex flex-col relative max-h-[90vh]">
                <header className="p-4 border-b dark:border-slate-700 flex justify-between items-center">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center">
                        <IconMicrophone className="h-5 w-5 mr-2 text-indigo-500"/> {t('voiceAssistantTitle')}
                    </h3>
                    <button onClick={onClose} className="text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white text-2xl leading-none">&times;</button>
                </header>
                
                <div className="flex-1 p-6 overflow-y-auto">
                    {!isSupported && <p className="text-center text-red-500">{t('voiceNotSupported')}</p>}
                    {isSupported && (
                        <>
                           {step === 'idle' && (
                                <div className="text-center flex flex-col items-center justify-center h-full">
                                    <p className="text-slate-600 dark:text-slate-300 mb-4">{t('voiceInstructions')}</p>
                                    <select value={lang} onChange={e => setLang(e.target.value as Language)} className="bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 rounded-md py-1 px-2 mb-6 text-sm">
                                        <option value="en">English</option>
                                        <option value="hi">हिन्दी</option>
                                        <option value="te">తెలుగు</option>
                                    </select>
                                    <button onClick={handleStart} className="bg-indigo-600 text-white rounded-full p-6 shadow-lg hover:bg-indigo-700 transition transform hover:scale-110">
                                        <IconMicrophone className="h-10 w-10" />
                                    </button>
                                    {error && <p className="text-red-500 mt-4 text-sm">{error}</p>}
                                </div>
                            )}

                            {step === 'listening' && (
                                <div className="text-center flex flex-col items-center justify-center h-full">
                                    <h4 className="text-lg font-semibold text-indigo-500 mb-4 animate-pulse">{t('listening')}</h4>
                                    <p className="text-slate-600 dark:text-slate-300 min-h-[72px]">{transcript || '...'}</p>
                                    <button onClick={handleStop} className="mt-6 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700">
                                        {t('stopRecording')}
                                    </button>
                                </div>
                            )}
                            
                             {(step === 'processing' || step === 'submitting') && (
                                 <div className="text-center flex flex-col items-center justify-center h-full">
                                     <Spinner/>
                                     <p className="text-slate-600 dark:text-slate-300 mt-4">{step === 'processing' ? t('processing') : t('submitGrievance')}</p>
                                </div>
                            )}
                            
                            {step === 'confirming' && (
                                <div>
                                    <h4 className="text-lg font-bold text-slate-800 dark:text-white mb-4">{t('confirmGrievance')}</h4>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">{t('department')}</label>
                                            <select value={parsedData.organization} onChange={e => setParsedData(d => ({...d, organization: e.target.value}))} className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md">
                                                {DEPARTMENTS.map(dep => <option key={dep} value={dep}>{dep}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">{t('description')}</label>
                                            <textarea rows={6} value={parsedData.description} onChange={e => setParsedData(d => ({...d, description: e.target.value}))} className="mt-1 block w-full shadow-sm sm:text-sm border-slate-300 rounded-md dark:bg-slate-700 dark:border-slate-600 dark:text-white"></textarea>
                                        </div>
                                    </div>
                                     {error && <p className="text-red-500 mt-4 text-sm">{error}</p>}
                                    <div className="mt-6 flex justify-end gap-3">
                                        <button onClick={handleRetry} className="px-4 py-2 text-sm font-medium rounded-md bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-slate-600 dark:text-slate-200 dark:hover:bg-slate-500">{t('recordAgain')}</button>
                                        <button onClick={handleConfirm} className="px-4 py-2 text-sm font-medium rounded-md bg-indigo-600 text-white hover:bg-indigo-700">{t('next')}</button>
                                    </div>
                                </div>
                            )}
                            
                             {step === 'uploading' && (
                                <div>
                                    <h4 className="text-lg font-bold text-slate-800 dark:text-white mb-4">{t('uploadEvidenceAndLocation')}</h4>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">{t('location')}</label>
                                            {location ? 
                                                <p className="text-sm text-green-600 dark:text-green-400 mt-1">{t('locationCaptured')}</p>
                                                : <p className="text-sm text-slate-500 mt-1">Capturing location...</p>
                                            }
                                        </div>
                                         <div>
                                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">{t('uploadDocuments')}</label>
                                             <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-slate-300 dark:border-slate-600 border-dashed rounded-md">
                                                 <div className="space-y-1 text-center">
                                                     <IconPaperclip className="mx-auto h-12 w-12 text-slate-400" />
                                                     <div className="flex text-sm text-slate-600 dark:text-slate-400">
                                                        <label htmlFor="voice-file-upload" className="relative cursor-pointer bg-transparent rounded-md font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500">
                                                            <span>{t('uploadFile')}</span>
                                                            <input id="voice-file-upload" type="file" multiple className="sr-only" onChange={e => handleFileChange(e.target.files)} />
                                                         </label>
                                                     </div>
                                                 </div>
                                             </div>
                                             {documents.length > 0 && (
                                                <ul className="mt-2 border border-slate-200 dark:border-slate-700 rounded-md divide-y divide-slate-200 dark:divide-slate-700">
                                                    {documents.map((file, i) => <li key={i} className="px-3 py-2 text-sm text-slate-700 dark:text-slate-300">{file.name}</li>)}
                                                </ul>
                                            )}
                                         </div>
                                    </div>
                                    <div className="mt-6 flex justify-end gap-3">
                                        <button onClick={() => setStep('confirming')} className="px-4 py-2 text-sm font-medium rounded-md bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-slate-600 dark:text-slate-200 dark:hover:bg-slate-500">{t('back')}</button>
                                        <button onClick={handleSubmit} className="px-4 py-2 text-sm font-medium rounded-md bg-indigo-600 text-white hover:bg-indigo-700">{t('submitGrievance')}</button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

const CitizenPortal: React.FC<{ user: User; onLogout: () => void; grievances: Grievance[]; onGrievanceSubmit: (grievance: Omit<Grievance, 'id' | 'status' | 'dateFiled' | 'history' | 'aiSolution'>) => Promise<boolean>; onUpdateUser: (user: User) => void; t: (key: string) => string; language: Language; setLanguage: (lang: Language) => void; }> = ({ user, onLogout, grievances, onGrievanceSubmit, onUpdateUser, t, language, setLanguage }) => {
    const [activeTab, setActiveTab] = useState('track');
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [isVoiceAssistantOpen, setIsVoiceAssistantOpen] = useState(false);

    const tabs = [
        { id: 'track', label: t('trackGrievances'), icon: IconClipboardList },
        { id: 'submit', label: t('newGrievance'), icon: IconPencilAlt },
        { id: 'feedback', label: t('feedback'), icon: IconMegaphone },
        { id: 'profile', label: t('myProfile'), icon: IconUser },
    ];
    
    const handleVoiceSubmit = async (data: { organization: string, description: string, documents: {name: string, content: string}[], location?: {latitude: number, longitude: number} }) => {
        return await onGrievanceSubmit({
            ...data,
            complainantName: user.name,
            complainantEmail: user.email,
        });
    };

    const handleFeedbackSubmit = () => {
        // This is a placeholder for a more complex notification system if needed
        // For now, the main App component handles notifications.
        setActiveTab('track'); // Switch tab after feedback
    };
    
    return (
        <div className="min-h-screen bg-slate-100 dark:bg-slate-900">
            <CitizenHeader user={user} onLogout={onLogout} onProfile={() => setActiveTab('profile')} t={t} language={language} setLanguage={setLanguage} />
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {activeTab === 'track' && <CitizenStats grievances={grievances} t={t} />}
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 mt-8">
                    <aside className="lg:col-span-1">
                        <nav className="space-y-1">
                            {tabs.map(tab => (
                                <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`group flex items-center px-3 py-2 text-sm font-medium rounded-md w-full ${activeTab === tab.id ? 'bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}`}>
                                    <tab.icon className={`mr-3 h-6 w-6 ${activeTab === tab.id ? 'text-indigo-500' : 'text-slate-400 group-hover:text-slate-500'}`} />
                                    {tab.label}
                                </button>
                            ))}
                        </nav>
                    </aside>
                    <div className="lg:col-span-3">
                        {activeTab === 'submit' && <SubmitGrievance onGrievanceSubmit={onGrievanceSubmit} user={user} t={t} />}
                        {activeTab === 'track' && <GrievanceTracker grievances={grievances} t={t} />}
                        {activeTab === 'profile' && <UserProfile user={user} onUpdateUser={onUpdateUser} t={t} />}
                        {activeTab === 'feedback' && <Feedback t={t} onSubmit={handleFeedbackSubmit} />}
                    </div>
                </div>
            </main>
            <div className="fixed bottom-6 right-6 flex flex-col items-center gap-4">
                <button onClick={() => setIsVoiceAssistantOpen(true)} className="bg-rose-600 text-white rounded-full p-4 shadow-lg hover:bg-rose-700 transition transform hover:scale-110" aria-label={t('voiceAssistantTitle')}>
                    <IconMicrophone className="h-8 w-8" />
                </button>
                 <button onClick={() => setIsChatOpen(true)} className="bg-indigo-600 text-white rounded-full p-4 shadow-lg hover:bg-indigo-700 transition transform hover:scale-110" aria-label={t('aiAssistant')}>
                    <IconChat className="h-8 w-8" />
                </button>
            </div>
            {isChatOpen && <ChatbotModal onClose={() => setIsChatOpen(false)} t={t} />}
            {isVoiceAssistantOpen && <VoiceAssistantModal onClose={() => setIsVoiceAssistantOpen(false)} onSubmit={handleVoiceSubmit} t={t} initialLanguage={language} />}
        </div>
    );
};


// --- ADMIN PORTAL COMPONENTS ---

const AdminHeader: React.FC<{ user: User; onLogout: () => void; onProfile: () => void; t: (key: string) => string; language: Language; setLanguage: (lang: Language) => void; }> = ({ user, onLogout, onProfile, t, language, setLanguage }) => (
    <header className="bg-white dark:bg-slate-800 shadow-md sticky top-0 z-10">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
            <h1 className="text-2xl font-bold text-slate-800 dark:text-white">
                {t('adminDashboardTitle')}
            </h1>
            <div className="flex items-center space-x-4">
                 <LanguageSwitcher language={language} setLanguage={setLanguage} />
                 <HeaderDropdown user={user} onLogout={onLogout} onProfile={onProfile} t={t} />
            </div>
        </div>
    </header>
);

const GrievanceDetail: React.FC<{ grievance: Grievance; onClose: () => void; onStatusChange: (id: string, status: GrievanceStatus, reason?: string) => void; onAddSolution: (id: string, solution: string) => void; onReject: (id: string) => void; t: (key: string) => string; }> = ({ grievance, onClose, onStatusChange, onAddSolution, onReject, t }) => {
    const [isSolutionLoading, setIsSolutionLoading] = useState(false);
    const [docQuestion, setDocQuestion] = useState('');
    const [docAnswer, setDocAnswer] = useState('');
    const [isDocAnswerLoading, setIsDocAnswerLoading] = useState(false);
    
    const getAiSolution = async () => {
        setIsSolutionLoading(true);
        const solution = await generateSolutionForGrievance(grievance);
        onAddSolution(grievance.id, solution);
        setIsSolutionLoading(false);
    };

    const handleDocQuestion = async () => {
        if (!docQuestion.trim()) return;
        setIsDocAnswerLoading(true);
        const answer = await answerFromDocuments(grievance, docQuestion);
        setDocAnswer(answer);
        setIsDocAnswerLoading(false);
    };

    const timelineIcons: { [key in GrievanceStatus]: React.ReactElement } = {
        [GrievanceStatus.FILED]: <IconDocumentText className="h-5 w-5 text-blue-500"/>,
        [GrievanceStatus.UNDER_REVIEW]: <IconClock className="h-5 w-5 text-yellow-500"/>,
        [GrievanceStatus.APPROVED]: <IconCheckCircle className="h-5 w-5 text-green-500"/>,
        [GrievanceStatus.REJECTED]: <IconXCircle className="h-5 w-5 text-red-500"/>,
    };
    
    return (
        <div className="bg-white dark:bg-slate-800 p-6 sm:p-8 rounded-lg shadow-xl relative">
            <button onClick={onClose} className="absolute top-4 right-4 text-slate-500 hover:text-slate-800 dark:hover:text-white">&times;</button>
            <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">{t('grievanceDetails')}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">ID: {grievance.id}</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div>
                    <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">{t('complainant')}</h3>
                    <p className="text-slate-800 dark:text-white">{grievance.complainantName} ({grievance.complainantEmail})</p>
                </div>
                <div>
                    <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">{t('dateFiled')}</h3>
                    <p className="text-slate-800 dark:text-white">{grievance.dateFiled}</p>
                </div>
                <div>
                    <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">{t('department')}</h3>
                    <p className="text-slate-800 dark:text-white">{grievance.organization}</p>
                </div>
                <div>
                    <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">{t('currentStatus')}</h3>
                    <StatusBadge status={grievance.status} />
                </div>
                 {grievance.location && (
                    <div className="md:col-span-2">
                        <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">{t('locationData')}</h3>
                        <a 
                            href={`https://www.google.com/maps?q=${grievance.location.latitude},${grievance.location.longitude}`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-indigo-600 dark:text-indigo-400 hover:underline"
                        >
                            {grievance.location.latitude.toFixed(5)}, {grievance.location.longitude.toFixed(5)} ({t('viewOnMap')})
                        </a>
                    </div>
                )}
            </div>

            <div className="mb-8">
                <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-2">{t('description')}</h3>
                <p className="text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-700/50 p-4 rounded-md">{grievance.description}</p>
            </div>
            
             <div className="mb-8">
                <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-2">{t('resolutionTimeline')}</h3>
                <ol className="relative border-l border-slate-200 dark:border-slate-700">                  
                    {grievance.history.map((item, index) => (
                         <li key={index} className="mb-6 ml-6">            
                            <span className="absolute flex items-center justify-center w-8 h-8 bg-slate-100 rounded-full -left-4 ring-8 ring-white dark:ring-slate-800 dark:bg-slate-900">
                                {timelineIcons[item.status]}
                            </span>
                            <h4 className="flex items-center mb-1 text-md font-semibold text-slate-900 dark:text-white">{item.status}
                                {item.rejectionReason && <span className="bg-red-100 text-red-800 text-xs font-medium mr-2 px-2.5 py-0.5 rounded dark:bg-red-900 dark:text-red-300 ml-3">{item.rejectionReason}</span>}
                            </h4>
                            <time className="block mb-2 text-sm font-normal leading-none text-slate-400 dark:text-slate-500">{item.date}</time>
                            <p className="text-sm text-slate-500 dark:text-slate-400">{item.notes}</p>
                        </li>
                    ))}
                </ol>
            </div>
            
            <div className="bg-indigo-50 dark:bg-slate-700/50 p-6 rounded-lg mb-8">
                <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-3 flex items-center"><IconSparkles className="h-5 w-5 mr-2 text-indigo-500"/> {t('aiTools')}</h3>
                <div className="space-y-4">
                    <div>
                        <h4 className="font-semibold text-slate-700 dark:text-slate-200">{t('aiProposedSolution')}</h4>
                        {grievance.aiSolution ? (
                            <p className="text-sm text-slate-600 dark:text-slate-300 mt-1 p-3 bg-white dark:bg-slate-700 rounded-md">{grievance.aiSolution}</p>
                        ) : (
                            <button onClick={getAiSolution} disabled={isSolutionLoading} className="mt-2 inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300">
                                {isSolutionLoading ? <Spinner/> : t('generateSolution')}
                            </button>
                        )}
                    </div>
                     <div>
                        <h4 className="font-semibold text-slate-700 dark:text-slate-200">{t('askAboutDocs')}</h4>
                         <div className="flex mt-2">
                             <input type="text" value={docQuestion} onChange={e => setDocQuestion(e.target.value)} placeholder={t('askPlaceholder')} className="flex-1 p-2 border border-slate-300 dark:border-slate-600 rounded-l-md text-sm dark:bg-slate-700 dark:text-white" />
                             <button onClick={handleDocQuestion} disabled={isDocAnswerLoading} className="bg-indigo-600 text-white px-3 rounded-r-md hover:bg-indigo-700 disabled:bg-indigo-300 flex items-center justify-center">
                                 {isDocAnswerLoading ? <Spinner/> : t('ask')}
                             </button>
                         </div>
                         {docAnswer && <p className="text-sm text-slate-600 dark:text-slate-300 mt-2 p-3 bg-white dark:bg-slate-700 rounded-md">{docAnswer}</p>}
                    </div>
                </div>
            </div>

            <div>
                <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-3">{t('actions')}</h3>
                <div className="flex flex-wrap gap-2">
                    <button onClick={() => onStatusChange(grievance.id, GrievanceStatus.UNDER_REVIEW)} className="px-4 py-2 text-sm font-medium rounded-md bg-yellow-500 text-white hover:bg-yellow-600">{t('markUnderReview')}</button>
                    <button onClick={() => onStatusChange(grievance.id, GrievanceStatus.APPROVED)} className="px-4 py-2 text-sm font-medium rounded-md bg-green-500 text-white hover:bg-green-600">{t('approve')}</button>
                    <button onClick={() => onReject(grievance.id)} className="px-4 py-2 text-sm font-medium rounded-md bg-red-500 text-white hover:bg-red-600">{t('reject')}</button>
                </div>
            </div>
        </div>
    );
};

const GrievanceStatusPieChart: React.FC<{ grievances: Grievance[]; t: (key: string) => string; }> = ({ grievances, t }) => {
    const data = Object.values(GrievanceStatus).map(status => ({
        name: status,
        value: grievances.filter(g => g.status === status).length,
    }));

    const COLORS = {
        [GrievanceStatus.FILED]: '#3B82F6',
        [GrievanceStatus.UNDER_REVIEW]: '#F59E0B',
        [GrievanceStatus.APPROVED]: '#10B981',
        [GrievanceStatus.REJECTED]: '#EF4444',
    };

    return (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-md h-full">
            <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4">{t('grievanceStatusOverview')}</h3>
            <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                    <Pie data={data} cx="50%" cy="50%" labelLine={false} outerRadius={80} fill="#8884d8" dataKey="value" nameKey="name" label={({ name, percent }) => `${(Number(percent ?? 0) * 100).toFixed(0)}%`}>
                        {data.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[entry.name as GrievanceStatus]} />
                        ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                </PieChart>
            </ResponsiveContainer>
        </div>
    );
};

const GrievanceCategoryChart: React.FC<{ grievances: Grievance[]; t: (key: string) => string; }> = ({ grievances, t }) => {
    const data = DEPARTMENTS.map(dept => ({
        name: dept.split(" ")[0],
        count: grievances.filter(g => g.organization === dept).length
    })).filter(d => d.count > 0);

    return (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-md h-full">
            <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4">{t('grievanceCategories')}</h3>
            <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#4f46e5" />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
};

const MonthlyTrendChart: React.FC<{ grievances: Grievance[]; t: (key: string) => string; }> = ({ grievances, t }) => {
    const data = useMemo(() => {
        const countsByMonth: {[key: string]: number} = {};
        grievances.forEach(g => {
            const month = new Date(g.dateFiled).toLocaleString('default', { month: 'short', year: '2-digit' });
            countsByMonth[g.dateFiled.substring(0, 7)] = (countsByMonth[g.dateFiled.substring(0, 7)] || 0) + 1;
        });
        
        return Object.keys(countsByMonth).sort().map(monthKey => ({
             name: new Date(monthKey + "-02").toLocaleString('default', { month: 'short', year: '2-digit' }),
             count: countsByMonth[monthKey]
        }));
    }, [grievances]);
    
     return (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-md">
            <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4">{t('monthlyGrievanceTrend')}</h3>
            <ResponsiveContainer width="100%" height={300}>
                <LineChart data={data} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="count" stroke="#4f46e5" strokeWidth={2} />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}

const AdminProfile: React.FC<{ user: User, onUpdateUser: (user: User, password?: {current: string, new: string}) => Promise<boolean>, t: (key: string) => string }> = ({ user, onUpdateUser, t }) => {
    const [formData, setFormData] = useState({ name: user.name, email: user.email });
    const [passwordData, setPasswordData] = useState({ current: '', new: '', confirm: '' });
    const [error, setError] = useState('');

    const handleInfoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setPasswordData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleInfoSave = async () => {
        setError('');
        const success = await onUpdateUser({ ...user, ...formData });
        if (success) {
            // notification is handled by parent
        }
    };

    const handlePasswordSave = async () => {
        setError('');
        if (passwordData.new !== passwordData.confirm) {
            setError(t('passwordMismatch'));
            return;
        }
        if (!passwordData.current || !passwordData.new) {
            setError("Passwords cannot be empty.");
            return;
        }
        const success = await onUpdateUser(user, { current: passwordData.current, new: passwordData.new });
        if (success) {
            setPasswordData({ current: '', new: '', confirm: '' });
        } else {
            setError(t('incorrectPassword'));
        }
    };

    return (
        <div className="space-y-8">
            <div className="bg-white dark:bg-slate-800 p-8 rounded-lg shadow-md">
                <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-6">{t('myProfile')}</h2>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">{t('nameLabel')}</label>
                        <input type="text" name="name" value={formData.name} onChange={handleInfoChange} className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600 dark:text-white"/>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">{t('emailLabel')}</label>
                        <input type="email" name="email" value={formData.email} onChange={handleInfoChange} className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600 dark:text-white"/>
                    </div>
                    <button onClick={handleInfoSave} className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700">{t('saveChanges')}</button>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-800 p-8 rounded-lg shadow-md">
                <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-6">{t('changePassword')}</h2>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">{t('currentPassword')}</label>
                        <input type="password" name="current" value={passwordData.current} onChange={handlePasswordChange} className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600 dark:text-white"/>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">{t('newPassword')}</label>
                        <input type="password" name="new" value={passwordData.new} onChange={handlePasswordChange} className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600 dark:text-white"/>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">{t('confirmNewPassword')}</label>
                        <input type="password" name="confirm" value={passwordData.confirm} onChange={handlePasswordChange} className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600 dark:text-white"/>
                    </div>
                    {error && <p className="text-sm text-red-500">{error}</p>}
                    <button onClick={handlePasswordSave} className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700">{t('updatePassword')}</button>
                </div>
            </div>
        </div>
    );
};


const RejectionModal: React.FC<{
    grievanceId: string;
    onClose: () => void;
    onSubmit: (id: string, reason: string, notes: string) => void;
    t: (key: string) => string;
}> = ({ grievanceId, onClose, onSubmit, t }) => {
    const [reason, setReason] = useState(t('rejectionReasonFalse'));
    const [notes, setNotes] = useState('');

    const handleSubmit = () => {
        onSubmit(grievanceId, reason, notes);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-xl shadow-2xl">
                <header className="p-4 border-b dark:border-slate-700">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white">{t('rejectionReasonTitle')}</h3>
                </header>
                <div className="p-6 space-y-4">
                    <p className="text-sm text-slate-600 dark:text-slate-300">{t('rejectionReasonPrompt')}</p>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">{t('reason')}</label>
                        <select value={reason} onChange={e => setReason(e.target.value)} className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md">
                            <option>{t('rejectionReasonFalse')}</option>
                            <option>{t('rejectionReasonDuplicate')}</option>
                            <option>{t('rejectionReasonInsufficient')}</option>
                            <option>{t('rejectionReasonOther')}</option>
                        </select>
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">{t('rejectionNotes')}</label>
                        <textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)} className="mt-1 block w-full shadow-sm sm:text-sm border-slate-300 rounded-md dark:bg-slate-700 dark:border-slate-600 dark:text-white"></textarea>
                    </div>
                </div>
                <footer className="p-4 bg-slate-50 dark:bg-slate-700/50 flex justify-end gap-3 rounded-b-xl">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-medium rounded-md bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-slate-600 dark:text-slate-200 dark:hover:bg-slate-500">{t('cancel')}</button>
                    <button onClick={handleSubmit} className="px-4 py-2 text-sm font-medium rounded-md bg-red-600 text-white hover:bg-red-700">{t('submitRejection')}</button>
                </footer>
            </div>
        </div>
    );
};


const AdminPortal: React.FC<{ user: User; onLogout: () => void; allGrievances: Grievance[]; onStatusChange: (id: string, status: GrievanceStatus, reason?: string, notes?: string) => void; onAddSolution: (id: string, solution: string) => void; onUpdateUser: (user: User, password?: {current: string, new: string}) => Promise<boolean>, t: (key: string) => string; language: Language; setLanguage: (lang: Language) => void; }> = ({ user, onLogout, allGrievances, onStatusChange, onAddSolution, onUpdateUser, t, language, setLanguage }) => {
    const [selectedGrievance, setSelectedGrievance] = useState<Grievance | null>(null);
    const [filter, setFilter] = useState<GrievanceStatus | 'All'>('All');
    const [rejectionModalId, setRejectionModalId] = useState<string | null>(null);
    const [adminView, setAdminView] = useState<'dashboard' | 'profile' | 'insights'>('dashboard');
    
    const departmentGrievances = allGrievances.filter(g => g.organization === user.department);
    const filteredGrievances = filter === 'All' ? departmentGrievances : departmentGrievances.filter(g => g.status === filter);

    const handleRejectSubmit = (id: string, reason: string, notes: string) => {
        onStatusChange(id, GrievanceStatus.REJECTED, reason, notes);
    };
    
    const AdminDashboard = () => (
        <>
            <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-md">
                <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-slate-800 dark:text-white">{t('grievancesFor')} {user.department}</h2>
                <div className="relative">
                        <select value={filter} onChange={e => setFilter(e.target.value as any)} className="pl-3 pr-8 py-2 text-sm border-slate-300 rounded-md dark:bg-slate-700 dark:border-slate-600 dark:text-white focus:ring-indigo-500 focus:border-indigo-500">
                            <option value="All">{t('allStatuses')}</option>
                            {Object.values(GrievanceStatus).map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                </div>
            </div>
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                    <thead className="bg-slate-50 dark:bg-slate-700">
                        <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">{t('tableId')}</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">{t('tableComplainant')}</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">{t('tableDateFiled')}</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">{t('tableStatus')}</th>
                            <th scope="col" className="relative px-6 py-3"><span className="sr-only">{t('view')}</span></th>
                        </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                        {filteredGrievances.map(g => (
                            <tr key={g.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900 dark:text-white">{g.id}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-300">{g.complainantName}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-300">{g.dateFiled}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm"><StatusBadge status={g.status} /></td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <button onClick={() => setSelectedGrievance(g)} className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-200">{t('view')}</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            </div>
        </>
    );

    const AdminInsights = () => (
        <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1">
                    <GrievanceStatusPieChart grievances={allGrievances} t={t} />
                </div>
                <div className="lg:col-span-2">
                    <GrievanceCategoryChart grievances={allGrievances} t={t} />
                </div>
            </div>
            <MonthlyTrendChart grievances={allGrievances} t={t} />
        </div>
    );
    
    return (
        <div className="min-h-screen bg-slate-100 dark:bg-slate-900">
            <AdminHeader user={user} onLogout={onLogout} onProfile={() => setAdminView('profile')} t={t} language={language} setLanguage={setLanguage} />
            <main className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                 {selectedGrievance ? (
                    <GrievanceDetail grievance={selectedGrievance} onClose={() => setSelectedGrievance(null)} onStatusChange={onStatusChange} onAddSolution={onAddSolution} onReject={setRejectionModalId} t={t} />
                ) : (
                <>
                    <div className="mb-6 flex border-b border-slate-200 dark:border-slate-700">
                        <button onClick={() => setAdminView('dashboard')} className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${adminView === 'dashboard' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}>{t('dashboard')}</button>
                        <button onClick={() => setAdminView('insights')} className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${adminView === 'insights' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}>{t('insights')}</button>
                    </div>

                    {adminView === 'dashboard' && <AdminDashboard />}
                    {adminView === 'insights' && <AdminInsights />}
                    {adminView === 'profile' && <AdminProfile user={user} onUpdateUser={onUpdateUser} t={t} />}
                </>
                )}
            </main>
            {rejectionModalId && <RejectionModal grievanceId={rejectionModalId} onClose={() => setRejectionModalId(null)} onSubmit={handleRejectSubmit} t={t} />}
        </div>
    );
};


// --- MAIN APP COMPONENT ---

export default function App() {
    const [view, setView] = useState<'home' | 'loginHub' | 'login' | 'portal'>('home');
    const [loginRole, setLoginRole] = useState<UserRole>(UserRole.CITIZEN);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [notification, setNotification] = useState<string | null>(null);
    const [language, setLanguage] = useState<Language>('en');

    // --- PERSISTENCE LOGIC ---
    const [users, setUsers] = useState<User[]>(() => {
      try {
        const savedUsers = localStorage.getItem('grievance_users');
        return savedUsers ? JSON.parse(savedUsers) : [MOCK_USER_CITIZEN, MOCK_USER_ADMIN];
      } catch (error) {
        console.error("Failed to parse users from localStorage", error);
        return [MOCK_USER_CITIZEN, MOCK_USER_ADMIN];
      }
    });

    const [grievances, setGrievances] = useState<Grievance[]>(() => {
      try {
        const savedGrievances = localStorage.getItem('grievance_data');
        return savedGrievances ? JSON.parse(savedGrievances) : INITIAL_GRIEVANCES;
      } catch (error) {
        console.error("Failed to parse grievances from localStorage", error);
        return INITIAL_GRIEVANCES;
      }
    });

    useEffect(() => {
        try {
            localStorage.setItem('grievance_users', JSON.stringify(users));
        } catch (error) {
            console.error("Failed to save users to localStorage", error);
        }
    }, [users]);

    useEffect(() => {
        try {
            localStorage.setItem('grievance_data', JSON.stringify(grievances));
        } catch (error) {
            console.error("Failed to save grievances to localStorage", error);
        }
    }, [grievances]);


    const t = useCallback((key: string): string => {
        const castKey = key as keyof typeof translations.en;
        return translations[language][castKey] || translations.en[castKey] || key;
    }, [language]);
    
    useEffect(() => {
        if(notification) {
            const timer = setTimeout(() => setNotification(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [notification]);

    const handleLoginClick = () => setView('loginHub');
    const handleBackToHub = () => setView('loginHub');

    const handlePortalSelect = (role: UserRole) => {
        setLoginRole(role);
        setView('login');
    };

    const handleAuth = (type: 'login' | 'register', userData: Partial<User>): boolean => {
        const { email, phone, password, role, name, department } = userData;
        
        if (type === 'register') {
            const userExists = users.some(u => u.email.toLowerCase() === email?.toLowerCase());
            if (userExists) return false;
            
            const newUser: User = {
                name: name!,
                email: email!,
                role: role!,
                phone: phone,
                password: password,
                department: department,
                misuseStrikes: 0,
            };
            const updatedUsers = [...users, newUser];
            setUsers(updatedUsers);
            setNotification(t('registrationSuccess'));
            setView('login'); // Go back to login screen after successful registration
            return true;

        } else { // Login
            const user = users.find(u => u.email.toLowerCase() === email?.toLowerCase() && u.role === role);
            if (!user) return false;

            const isCitizen = role === UserRole.CITIZEN;
            const credentialsMatch = isCitizen ? user.phone === phone : user.password === password;

            if (credentialsMatch) {
                setCurrentUser(user);
                setView('portal');
                return true;
            }
            return false;
        }
    };

    const handleLogout = () => {
        setCurrentUser(null);
        setView('home');
    };
    
    const handleBackToHome = () => {
        setView('home');
    };
    
    const handleUserUpdate = async (updatedUser: User, password?: {current: string, new: string}): Promise<boolean> => {
        if (password && updatedUser.role === UserRole.ADMIN) {
            const userInDb = users.find(u => u.email === updatedUser.email);
            if (userInDb?.password !== password.current) {
                return false; // Incorrect current password
            }
            updatedUser.password = password.new;
        }

        const newUsers = users.map(u => u.email === updatedUser.email ? updatedUser : u)
        setUsers(newUsers);
        setCurrentUser(updatedUser);
        
        if(password) {
            setNotification(t("passwordUpdated"));
        } else {
            setNotification(t("profileUpdated"));
        }
        return true;
    }

    const handleGrievanceSubmit = async (newGrievanceData: Omit<Grievance, 'id' | 'status' | 'dateFiled' | 'history' | 'aiSolution'>): Promise<boolean> => {
        // Duplicate check
        const userGrievances = grievances.filter(g => g.complainantEmail === newGrievanceData.complainantEmail);
        const isDuplicate = userGrievances.some(g => stringSimilarity(g.description, newGrievanceData.description) > 0.85);
        if (isDuplicate) {
            return false; // Indicate failure
        }

        const newGrievance: Grievance = {
            ...newGrievanceData,
            id: `GRV${String(grievances.length + 1).padStart(3, '0')}`,
            status: GrievanceStatus.FILED,
            dateFiled: new Date().toISOString().split('T')[0],
            history: [{ status: GrievanceStatus.FILED, date: new Date().toISOString().split('T')[0], notes: 'Grievance submitted by citizen.' }]
        };
        const updatedGrievances = [newGrievance, ...grievances];
        setGrievances(updatedGrievances);
        setNotification(t("grievanceSubmitted"));
        return true; // Indicate success
    };

    const handleStatusChange = (id: string, newStatus: GrievanceStatus, reason?: string, notes?: string) => {
        const grievanceToUpdate = grievances.find(g => g.id === id);
        if (!grievanceToUpdate) return;
    
        // Handle misuse strikes and update users state if necessary
        if (newStatus === GrievanceStatus.REJECTED && reason === t('rejectionReasonFalse')) {
            const updatedUsers = users.map(u => {
                if (u.email === grievanceToUpdate.complainantEmail) {
                    const updatedUser = { ...u, misuseStrikes: (u.misuseStrikes || 0) + 1 };
                    // Also update the currently logged-in user if they are the one being updated
                    if (currentUser?.email === u.email) {
                        setCurrentUser(updatedUser);
                    }
                    return updatedUser;
                }
                return u;
            });
            setUsers(updatedUsers);
        }
        
        // Now update grievances state
        const updatedGrievances = grievances.map(g => {
            if (g.id !== id) return g;
            
            return { 
                ...g, 
                status: newStatus,
                history: [...g.history, { 
                    status: newStatus, 
                    date: new Date().toISOString().split('T')[0], 
                    notes: notes || `Status updated to ${newStatus} by admin.`,
                    rejectionReason: reason
                }]
            };
        });
        setGrievances(updatedGrievances);
        setNotification(t('statusUpdated').replace('{id}', id).replace('{newStatus}', newStatus));
    };

    const handleAddSolution = (id: string, solution: string) => {
        const updatedGrievances = grievances.map(g => g.id === id ? { ...g, aiSolution: solution } : g);
        setGrievances(updatedGrievances);
    };
    
    const renderContent = () => {
        switch(view) {
            case 'home':
                return <HomePage onLoginClick={handleLoginClick} t={t} language={language} setLanguage={setLanguage} />;
            case 'loginHub':
                return <LoginHub onPortalSelect={handlePortalSelect} onBack={handleBackToHome} t={t} />;
            case 'login':
                return <LoginPage role={loginRole} onAuth={handleAuth} onBack={handleBackToHub} t={t} />;
            case 'portal':
                 if (currentUser?.role === UserRole.CITIZEN) {
                    return <CitizenPortal 
                        user={currentUser} 
                        onLogout={handleLogout} 
                        grievances={grievances.filter(g => g.complainantEmail === currentUser.email)}
                        onGrievanceSubmit={handleGrievanceSubmit}
                        onUpdateUser={handleUserUpdate as (user: User) => void}
                        t={t}
                        language={language}
                        setLanguage={setLanguage}
                    />;
                }
                if (currentUser?.role === UserRole.ADMIN) {
                    return <AdminPortal 
                        user={currentUser} 
                        onLogout={handleLogout}
                        allGrievances={grievances}
                        onStatusChange={handleStatusChange}
                        onAddSolution={handleAddSolution}
                        onUpdateUser={handleUserUpdate}
                        t={t}
                        language={language}
                        setLanguage={setLanguage}
                    />;
                }
                return null; // Should not happen
            default:
                return <HomePage onLoginClick={handleLoginClick} t={t} language={language} setLanguage={setLanguage} />;
        }
    }
    
    return (
        <>
            {notification && (
                <div className="fixed top-5 right-5 bg-green-500 text-white py-2 px-4 rounded-lg shadow-lg z-50 animate-fade-in-out">
                    {notification}
                </div>
            )}
            {renderContent()}
        </>
    );
}
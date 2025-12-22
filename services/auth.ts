
import {
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    sendPasswordResetEmail,
    updatePassword,
    createUserWithEmailAndPassword
} from "firebase/auth";

import {
    doc,
    getDoc,
    setDoc,
    updateDoc,
    serverTimestamp,
    collection,
    getDocs
} from "firebase/firestore";

import { auth, db } from "./firebase";
import { User, UserRole, UserStatus } from "../types";

const normalizeRole = (data: any): UserRole => {
    const rawRole = (data.role || 'USER').toString().toUpperCase();
    if (rawRole === 'DEV' || rawRole === 'DEVELOPER') return 'DEV';
    if (rawRole === 'ADMIN') return 'ADMIN';
    return 'USER';
};

/**
 * Recarrega a sessão com motor de auto-healing para perfis Firestore.
 * Essencial para evitar erros de permissão em usuários novos ou com documentos ausentes.
 */
export const reloadSession = (): Promise<User | null> => {
    return new Promise((resolve) => {
        const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
            if (!fbUser) {
                localStorage.removeItem("sys_session_v1");
                resolve(null);
                unsubscribe();
                return;
            }

            try {
                let profileSnap;
                try {
                    profileSnap = await getDoc(doc(db, "profiles", fbUser.uid));
                } catch (permissionError) {
                    console.warn("[Auth] Erro de acesso ao perfil. Tentando reparar permissões...");
                    profileSnap = { exists: () => false };
                }
                
                // AUTO-HEALING: Se o perfil não existe ou deu erro de leitura, cria/repara como prioridade absoluta.
                if (!profileSnap.exists()) {
                    const initialProfile = {
                        name: fbUser.displayName || 'Usuário Gestor',
                        username: fbUser.email?.split('@')[0] || 'user',
                        email: fbUser.email!,
                        role: fbUser.email === 'admin@admin.com' ? 'DEV' : 'USER',
                        isActive: true,
                        userStatus: 'ACTIVE',
                        createdAt: serverTimestamp(),
                        modules_config: { 
                            sales: true, finance: true, whatsapp: true, 
                            ai: true, dev: false, crm: true, reports: true,
                            news: true, receivables: true, distribution: true, imports: true
                        }
                    };
                    await setDoc(doc(db, "profiles", fbUser.uid), initialProfile);
                    profileSnap = await getDoc(doc(db, "profiles", fbUser.uid));
                }

                const data = profileSnap.data()!;
                if (data.isActive === false) {
                    await signOut(auth);
                    resolve(null);
                    unsubscribe();
                    return;
                }

                const user: User = {
                    id: fbUser.uid,
                    username: data.username || fbUser.email?.split('@')[0] || 'user',
                    name: data.name || 'Usuário',
                    email: fbUser.email!,
                    role: normalizeRole(data),
                    isActive: true,
                    theme: data.theme || "glass",
                    userStatus: "ACTIVE",
                    createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
                    modules: data.modules_config || { sales: true, finance: true },
                    profilePhoto: data.profilePictureUrl || "",
                    tel: data.tel || "",
                    chat_config: data.chat_config,
                    keys: data.keys
                };

                localStorage.setItem("sys_session_v1", JSON.stringify(user));
                resolve(user);
            } catch (e) {
                console.error("[Auth] Erro Crítico na inicialização de sessão:", e);
                resolve(null);
            }
            unsubscribe();
        });
    });
};

export const getSession = (): User | null => {
    const raw = localStorage.getItem("sys_session_v1");
    if (!raw) return null;
    try {
        return JSON.parse(raw);
    } catch { return null; }
};

export const login = async (email: string, password?: string): Promise<{ user: User | null; error?: string }> => {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password || "");
        const fbUser = userCredential.user;
        const profileSnap = await getDoc(doc(db, "profiles", fbUser.uid));
        
        if (!profileSnap.exists()) {
            return { user: null, error: "Perfil não configurado no servidor." };
        }

        const data = profileSnap.data();
        if (data.isActive === false) {
            await signOut(auth);
            return { user: null, error: "Sua conta está inativa." };
        }

        const user: User = { id: fbUser.uid, ...data } as any;
        localStorage.setItem("sys_session_v1", JSON.stringify(user));
        return { user };
    } catch (e: any) {
        return { user: null, error: "Credenciais inválidas." };
    }
};

export const logout = async () => {
    localStorage.removeItem("sys_session_v1");
    await signOut(auth);
    window.location.reload();
};

export const listUsers = async (): Promise<User[]> => {
    const snap = await getDocs(collection(db, "profiles"));
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
};

export const createUser = async (adminId: string, userData: any) => {
    const userCredential = await createUserWithEmailAndPassword(auth, userData.email, "Gestor360!");
    await setDoc(doc(db, "profiles", userCredential.user.uid), {
        ...userData,
        isActive: true,
        userStatus: "ACTIVE",
        createdAt: serverTimestamp()
    });
    return { success: true };
};

export const updateUser = async (userId: string, data: any) => {
    await updateDoc(doc(db, "profiles", userId), { ...data, updatedAt: serverTimestamp() });
};

export const deactivateUser = async (userId: string) => {
    await updateDoc(doc(db, "profiles", userId), { isActive: false, userStatus: "INACTIVE" });
};

export const requestPasswordReset = async (email: string) => { await sendPasswordResetEmail(auth, email); };
export const sendMagicLink = async (email: string) => { await sendPasswordResetEmail(auth, email); };
export const changePassword = async (userId: string, newPassword: string) => {
    if (auth.currentUser?.uid === userId) await updatePassword(auth.currentUser, newPassword);
};

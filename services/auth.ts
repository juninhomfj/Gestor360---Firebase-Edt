
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
    getDocs,
    collection,
    setDoc,
    updateDoc,
    serverTimestamp,
} from "firebase/firestore";

import { auth, db } from "./firebase";
import { User, UserRole, UserStatus, UserModules } from "../types";

/**
 * Normaliza a Role do usuário para garantir a hierarquia DEV > ADMIN > USER
 */
const normalizeRole = (data: any): UserRole => {
    const rawRole = (data.role || 'USER').toString().toUpperCase();
    if (rawRole === 'DEV' || rawRole === 'DEVELOPER') return 'DEV';
    if (rawRole === 'ADMIN') return 'ADMIN';
    return 'USER';
};

/**
 * RESTAURA SESSÃO (Fonte Única da Verdade: Firestore profiles)
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
                // Busca perfil direto no Firestore
                const profileSnap = await getDoc(doc(db, "profiles", fbUser.uid));
                
                if (!profileSnap.exists()) {
                    console.error("[Auth] Perfil não configurado no Firestore.");
                    await signOut(auth);
                    resolve(null);
                    unsubscribe();
                    return;
                }

                const data = profileSnap.data();

                // BLOQUEIO CRÍTICO: Se perfil inativo, desloga.
                if (data.isActive === false || data.user_status === 'INACTIVE') {
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
                    modules: data.modules_config || { sales: true, finance: true, reports: true },
                    profilePhoto: data.profilePictureUrl || "",
                    tel: data.tel || "",
                    chat_config: data.chat_config,
                    keys: data.keys
                };

                localStorage.setItem("sys_session_v1", JSON.stringify(user));
                resolve(user);
            } catch (e) {
                console.error("[Auth] Erro na validação de sessão:", e);
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
        const user = JSON.parse(raw);
        if (!user.isActive) return null;
        return user;
    } catch { return null; }
};

export const login = async (email: string, password?: string): Promise<{ user: User | null; error?: string }> => {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password || "");
        const fbUser = userCredential.user;

        const profileSnap = await getDoc(doc(db, "profiles", fbUser.uid));
        if (!profileSnap.exists()) {
            await signOut(auth);
            return { user: null, error: "Perfil não encontrado no Firestore." };
        }

        const data = profileSnap.data();
        if (data.isActive === false) {
            await signOut(auth);
            return { user: null, error: "Sua conta está desativada." };
        }

        const user: User = {
            id: fbUser.uid,
            username: data.username,
            name: data.name,
            email: fbUser.email!,
            role: normalizeRole(data),
            isActive: true,
            theme: data.theme || "glass",
            userStatus: "ACTIVE",
            createdAt: new Date().toISOString(),
            modules: data.modules_config || {}
        } as any;

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
    const tempPassword = "SetPassword360!" + Math.floor(Math.random() * 1000);
    const userCredential = await createUserWithEmailAndPassword(auth, userData.email, tempPassword);
    const uid = userCredential.user.uid;
    
    await setDoc(doc(db, "profiles", uid), {
        ...userData,
        isActive: true,
        user_status: "ACTIVE",
        createdAt: serverTimestamp()
    });

    await sendPasswordResetEmail(auth, userData.email);
    return { success: true };
};

export const updateUser = async (userId: string, data: any) => {
    await updateDoc(doc(db, "profiles", userId), { ...data, updatedAt: serverTimestamp() });
};

export const deactivateUser = async (userId: string) => {
    await updateDoc(doc(db, "profiles", userId), { isActive: false, user_status: "INACTIVE" });
};

export const requestPasswordReset = async (email: string) => { await sendPasswordResetEmail(auth, email); };
export const sendMagicLink = async (email: string) => { await sendPasswordResetEmail(auth, email); };
export const changePassword = async (userId: string, newPassword: string) => {
    if (auth.currentUser?.uid === userId) await updatePassword(auth.currentUser, newPassword);
};

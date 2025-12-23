
import {
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    sendPasswordResetEmail,
    updatePassword,
    createUserWithEmailAndPassword,
    sendSignInLinkToEmail
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
import { User, UserRole, UserStatus, UserPermissions } from "../types";

/**
 * Permissões padrão para novos usuários (USER)
 */
const DEFAULT_PERMISSIONS: UserPermissions = {
    sales: true,
    finance: true,
    crm: true,
    whatsapp: false,
    reports: true,
    ai: true,
    dev: false,
    settings: true,
    news: true,
    receivables: true,
    distribution: true,
    imports: true
};

/**
 * Permissões para Administradores
 */
const ADMIN_PERMISSIONS: UserPermissions = {
    ...DEFAULT_PERMISSIONS,
    whatsapp: true,
    settings: true,
    dev: false
};

/**
 * Permissões para Desenvolvedores (Root)
 */
const DEV_PERMISSIONS: UserPermissions = {
    ...DEFAULT_PERMISSIONS,
    whatsapp: true,
    settings: true,
    dev: true
};

/**
 * Recarrega a sessão com motor de auto-healing.
 * Garante que Auth e Firestore estejam sempre em sincronia (Perfís v2).
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
                const profileRef = doc(db, "profiles", fbUser.uid);
                let profileSnap = await getDoc(profileRef);

                // REGRA ABSOLUTA: Criar perfil se não existir
                if (!profileSnap.exists()) {
                    console.warn(`[Auth] Perfil ausente para UID ${fbUser.uid}. Iniciando criação automática...`);
                    
                    // Define o papel inicial (DEV se for o admin master, senão USER)
                    const role: UserRole = fbUser.email === 'admin@admin.com' || fbUser.email === 'dev@gestor360.com' ? 'DEV' : 'USER';
                    const permissions = role === 'DEV' ? DEV_PERMISSIONS : DEFAULT_PERMISSIONS;

                    const initialProfile = {
                        uid: fbUser.uid,
                        username: fbUser.email?.split('@')[0] || 'user',
                        name: fbUser.displayName || 'Novo Usuário',
                        email: fbUser.email!,
                        role: role,
                        isActive: true,
                        userStatus: 'ACTIVE',
                        theme: 'glass',
                        permissions: permissions,
                        createdAt: serverTimestamp(),
                        updatedAt: serverTimestamp()
                    };

                    await setDoc(profileRef, initialProfile);
                    profileSnap = await getDoc(profileRef);
                }

                const data = profileSnap.data()!;
                if (!data.isActive) {
                    await signOut(auth);
                    resolve(null);
                    unsubscribe();
                    return;
                }

                const user: User = {
                    id: fbUser.uid,
                    uid: fbUser.uid,
                    username: data.username || fbUser.email?.split('@')[0],
                    name: data.name || 'Usuário',
                    email: fbUser.email!,
                    role: data.role || 'USER',
                    isActive: true,
                    theme: data.theme || "glass",
                    userStatus: "ACTIVE",
                    createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
                    updatedAt: data.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
                    permissions: data.permissions || DEFAULT_PERMISSIONS,
                    profilePhoto: data.profilePhoto || "",
                    tel: data.tel || "",
                    chat_config: data.chat_config,
                    keys: data.keys
                };

                localStorage.setItem("sys_session_v1", JSON.stringify(user));
                resolve(user);
            } catch (e) {
                console.error("[Auth] Erro crítico no auto-healing de perfil:", e);
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
        await signInWithEmailAndPassword(auth, email, password || "");
        // ReloadSession cuidará do perfil
        const user = await reloadSession();
        return { user };
    } catch (e: any) {
        console.error("[Auth] Falha no login:", e);
        return { user: null, error: "Credenciais inválidas ou erro de rede." };
    }
};

export const logout = async () => {
    localStorage.removeItem("sys_session_v1");
    await signOut(auth);
    window.location.reload();
};

export const listUsers = async (): Promise<User[]> => {
    try {
        const snap = await getDocs(collection(db, "profiles"));
        return snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
    } catch (e) {
        return [];
    }
};

export const createUser = async (adminId: string, userData: any) => {
    // Cria no Auth
    const userCredential = await createUserWithEmailAndPassword(auth, userData.email, userData.password || "Gestor360!");
    const fbUser = userCredential.user;

    // Cria Perfil Imediato com role especificada
    const profileRef = doc(db, "profiles", fbUser.uid);
    const role: UserRole = userData.role || 'USER';
    const permissions = role === 'DEV' ? DEV_PERMISSIONS : (role === 'ADMIN' ? ADMIN_PERMISSIONS : DEFAULT_PERMISSIONS);

    const profile = {
        uid: fbUser.uid,
        username: userData.username || userData.email.split('@')[0],
        name: userData.name,
        email: userData.email,
        role: role,
        isActive: true,
        userStatus: 'ACTIVE',
        theme: 'glass',
        permissions: permissions,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    };

    await setDoc(profileRef, profile);
    return { success: true };
};

export const updateUser = async (userId: string, data: any) => {
    await updateDoc(doc(db, "profiles", userId), { ...data, updatedAt: serverTimestamp() });
};

export const deactivateUser = async (userId: string) => {
    await updateDoc(doc(db, "profiles", userId), { isActive: false, userStatus: "INACTIVE" });
};

export const requestPasswordReset = async (email: string) => { await sendPasswordResetEmail(auth, email); };
export const changePassword = async (userId: string, newPassword: string) => {
    if (auth.currentUser?.uid === userId) await updatePassword(auth.currentUser, newPassword);
};

/**
 * Added sendMagicLink for email-based authentication
 */
export const sendMagicLink = async (email: string) => {
    const actionCodeSettings = {
        url: window.location.origin + '/finish-login',
        handleCodeInApp: true,
    };
    await sendSignInLinkToEmail(auth, email, actionCodeSettings);
    localStorage.setItem('emailForSignIn', email);
};

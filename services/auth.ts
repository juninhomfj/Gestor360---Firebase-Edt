
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
 * Normaliza a Role seguindo a hierarquia DEV > ADMIN > USER
 */
const normalizeRole = (data: any): UserRole => {
    const rawRole = (data.role || 'USER').toString().toUpperCase();
    if (rawRole === 'DEV') return 'DEV';
    if (rawRole === 'ADMIN') return 'ADMIN';
    return 'USER';
};

/**
 * RESTAURA SESSÃO: Bloqueio de renderização garantido.
 * Aguarda a resolução do perfil no Firestore. Se não existir, desloga o usuário Auth.
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
                // Carrega perfil oficial do Firestore (Fonte da Verdade)
                const profileSnap = await getDoc(doc(db, "profiles", fbUser.uid));
                
                if (!profileSnap.exists()) {
                    console.error("[Auth] Perfil não encontrado no Firestore para o UID:", fbUser.uid);
                    await signOut(auth);
                    resolve(null);
                    unsubscribe();
                    return;
                }

                const data = profileSnap.data();
                
                // Bloqueio imediato se o usuário estiver inativo
                if (data.isActive === false || data.user_status === 'INACTIVE') {
                    console.warn("[Auth] Tentativa de acesso de usuário inativo.");
                    await signOut(auth);
                    resolve(null);
                    unsubscribe();
                    return;
                }

                const user: User = {
                    id: fbUser.uid,
                    username: data.username || fbUser.email?.split('@')[0] || 'user',
                    name: data.name || fbUser.displayName || 'Usuário',
                    email: fbUser.email!,
                    tel: data.tel || "",
                    role: normalizeRole(data),
                    isActive: true,
                    profilePhoto: data.profilePictureUrl || "",
                    theme: data.theme || "glass",
                    userStatus: "ACTIVE",
                    createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
                    modules: data.modules_config || { sales: true, finance: true, ai: true },
                    chat_config: data.chat_config || { public_access: false, private_enabled: true },
                    keys: data.keys
                };

                localStorage.setItem("sys_session_v1", JSON.stringify(user));
                resolve(user);
            } catch (e) {
                console.error("[Auth] Erro ao carregar perfil:", e);
                resolve(null);
            }
            unsubscribe();
        });
    });
};

/**
 * Retorna a sessão síncrona salva no localstorage
 */
// Fixed: Added missing getSession function to export current user session from local storage.
export const getSession = (): User | null => {
    const raw = localStorage.getItem("sys_session_v1");
    if (!raw) return null;
    try {
        return JSON.parse(raw) as User;
    } catch {
        return null;
    }
};

export const login = async (email: string, password?: string): Promise<{ user: User | null; error?: string }> => {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password || "");
        const fbUser = userCredential.user;

        const profileSnap = await getDoc(doc(db, "profiles", fbUser.uid));
        if (!profileSnap.exists()) {
            await signOut(auth);
            return { user: null, error: "Seu e-mail está autenticado, mas seu perfil não foi configurado no Gestor 360." };
        }

        const data = profileSnap.data();
        if (data.isActive === false) {
            await signOut(auth);
            return { user: null, error: "Esta conta foi desativada pelo administrador." };
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
            createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
            modules: data.modules_config || {},
            chat_config: data.chat_config || { public_access: false, private_enabled: true }
        } as any;

        localStorage.setItem("sys_session_v1", JSON.stringify(user));
        return { user };
    } catch (e: any) {
        return { user: null, error: "E-mail ou senha incorretos." };
    }
};

export const logout = async () => {
    localStorage.removeItem("sys_session_v1");
    await signOut(auth);
    window.location.reload();
};

export const listUsers = async (): Promise<User[]> => {
    const snap = await getDocs(collection(db, "profiles"));
    return snap.docs.map((d) => {
        const data = d.data();
        return {
            id: d.id,
            username: data.username,
            name: data.name,
            email: data.email,
            role: normalizeRole(data),
            isActive: data.isActive !== false,
            userStatus: data.user_status,
            modules: data.modules_config,
            profilePhoto: data.profilePictureUrl
        } as any;
    });
};

export const createUser = async (adminId: string, userData: any) => {
    const tempPassword = "SetPassword360!" + Math.floor(Math.random() * 1000);
    const userCredential = await createUserWithEmailAndPassword(auth, userData.email, tempPassword);
    const uid = userCredential.user.uid;
    
    await setDoc(doc(db, "profiles", uid), {
        username: userData.username,
        name: userData.name,
        email: userData.email,
        role: userData.role || 'USER',
        isActive: true,
        modules_config: userData.modules_config,
        user_status: "ACTIVE",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: adminId
    });

    await sendPasswordResetEmail(auth, userData.email);
    return { success: true };
};

export const updateUser = async (userId: string, data: any) => {
    const ref = doc(db, "profiles", userId);
    await updateDoc(ref, { ...data, updatedAt: serverTimestamp() });
};

export const deactivateUser = async (userId: string) => {
    const ref = doc(db, "profiles", userId);
    await updateDoc(ref, { isActive: false, user_status: "INACTIVE", updatedAt: serverTimestamp() });
};

export const requestPasswordReset = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
};

export const sendMagicLink = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
};

export const changePassword = async (userId: string, newPassword: string) => {
    if (auth.currentUser?.uid === userId) {
        await updatePassword(auth.currentUser, newPassword);
    }
};

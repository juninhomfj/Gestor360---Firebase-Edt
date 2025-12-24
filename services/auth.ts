
import {
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    sendPasswordResetEmail,
    updatePassword,
    createUserWithEmailAndPassword,
    User as FirebaseUser
} from "firebase/auth";

import {
    doc,
    getDoc,
    setDoc,
    serverTimestamp,
    collection,
    getDocs
} from "firebase/firestore";

import { auth, db } from "./firebase";
import { User, UserRole, UserPermissions } from "../types";

const DEFAULT_PERMISSIONS: UserPermissions = {
    sales: true, finance: true, crm: true, whatsapp: false,
    reports: true, ai: true, dev: false, settings: true,
    news: true, receivables: true, distribution: true, imports: true
};

const DEV_PERMISSIONS: UserPermissions = {
    ...DEFAULT_PERMISSIONS, whatsapp: true, dev: true
};

async function getProfileFromFirebase(fbUser: FirebaseUser): Promise<User | null> {
    try {
        const profileRef = doc(db, "profiles", fbUser.uid);
        let profileSnap = await getDoc(profileRef);

        const isRoot = fbUser.email === 'admin@admin.com' || fbUser.email === 'dev@gestor360.com';

        if (!profileSnap.exists()) {
            console.warn(`[Auth] Auto-healing: Criando perfil para ${fbUser.email}`);
            const newProfile = {
                uid: fbUser.uid,
                username: fbUser.email?.split('@')[0] || 'user',
                name: fbUser.displayName || 'Novo Usuário',
                email: fbUser.email!,
                role: isRoot ? 'DEV' : 'USER',
                isActive: true,
                userStatus: 'ACTIVE',
                theme: 'glass',
                permissions: isRoot ? DEV_PERMISSIONS : DEFAULT_PERMISSIONS,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            };
            await setDoc(profileRef, newProfile);
            profileSnap = await getDoc(profileRef);
        }

        const data = profileSnap.data()!;
        
        // Auto-healing logic: if permissions are missing, add defaults
        if (!data.permissions) {
            await setDoc(profileRef, { permissions: isRoot ? DEV_PERMISSIONS : DEFAULT_PERMISSIONS }, { merge: true });
        }

        return {
            id: fbUser.uid,
            uid: fbUser.uid,
            username: data.username || fbUser.email?.split('@')[0],
            name: data.name || 'Usuário',
            email: data.email || fbUser.email,
            role: data.role || (isRoot ? 'DEV' : 'USER'),
            isActive: data.isActive !== false,
            theme: data.theme || "glass",
            userStatus: data.userStatus || "ACTIVE",
            createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
            updatedAt: data.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
            permissions: data.permissions || (isRoot ? DEV_PERMISSIONS : DEFAULT_PERMISSIONS),
            profilePhoto: data.profilePhoto || "",
            tel: data.tel || ""
        } as User;
    } catch (e) {
        console.error("[Auth] Erro crítico ao carregar perfil:", e);
        return null;
    }
}

export const reloadSession = (): Promise<User | null> => {
    return new Promise((resolve) => {
        const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
            if (!fbUser) {
                localStorage.removeItem("sys_session_v1");
                resolve(null);
                unsubscribe();
                return;
            }
            const user = await getProfileFromFirebase(fbUser);
            if (user) {
                localStorage.setItem("sys_session_v1", JSON.stringify(user));
            }
            resolve(user);
            unsubscribe();
        });
    });
};

export const getSession = (): User | null => {
    const raw = localStorage.getItem("sys_session_v1");
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
};

export const login = async (email: string, password?: string): Promise<{ user: User | null; error?: string }> => {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password || "");
        const user = await getProfileFromFirebase(userCredential.user);
        
        if (!user) return { user: null, error: "Erro ao sincronizar perfil corporativo." };
        if (!user.isActive && user.role !== 'DEV') {
            await signOut(auth);
            return { user: null, error: "Acesso bloqueado. Contate o administrador." };
        }

        localStorage.setItem("sys_session_v1", JSON.stringify(user));
        return { user };
    } catch (e: any) {
        console.error("[Auth] Falha no login:", e.code);
        let msg = "Falha na autenticação.";
        if (e.code === 'auth/invalid-credential') msg = "E-mail ou senha incorretos.";
        if (e.code === 'auth/user-not-found') msg = "Usuário não cadastrado.";
        return { user: null, error: msg };
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
    } catch (e) { return []; }
};

export const createUser = async (adminId: string, userData: any) => {
    const userCredential = await createUserWithEmailAndPassword(auth, userData.email, "Gestor360!");
    const fbUser = userCredential.user;
    const role: UserRole = userData.role || 'USER';
    const profile = {
        uid: fbUser.uid,
        username: userData.username || userData.email.split('@')[0],
        name: userData.name,
        email: userData.email,
        role: role,
        isActive: true,
        userStatus: 'ACTIVE',
        theme: 'glass',
        permissions: role === 'DEV' ? DEV_PERMISSIONS : DEFAULT_PERMISSIONS,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    };
    await setDoc(doc(db, "profiles", fbUser.uid), profile);
    return { success: true };
};

export const updateUser = async (userId: string, data: any) => {
    const profileRef = doc(db, "profiles", userId);
    await setDoc(profileRef, { ...data, updatedAt: serverTimestamp() }, { merge: true });
    const currentSession = getSession();
    if (currentSession && currentSession.id === userId) {
        localStorage.setItem("sys_session_v1", JSON.stringify({ ...currentSession, ...data }));
    }
};

export const deactivateUser = async (userId: string) => {
    await updateUser(userId, { isActive: false, userStatus: 'INACTIVE' });
};

export const sendMagicLink = async (email: string) => { await sendPasswordResetEmail(auth, email); };
export const requestPasswordReset = async (email: string) => { await sendPasswordResetEmail(auth, email); };
export const changePassword = async (userId: string, newPassword: string) => {
    if (auth.currentUser?.uid === userId) await updatePassword(auth.currentUser, newPassword);
};

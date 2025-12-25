
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
    getDocs,
    query,
    orderBy,
    updateDoc
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
        const defaultRole = isRoot ? 'DEV' : 'USER';
        const defaultPerms = isRoot ? DEV_PERMISSIONS : DEFAULT_PERMISSIONS;

        if (!profileSnap.exists()) {
            const newProfile = {
                uid: fbUser.uid,
                username: fbUser.email?.split('@')[0] || 'user',
                name: fbUser.displayName || 'Novo Usuário',
                email: fbUser.email!,
                role: defaultRole,
                isActive: true,
                userStatus: 'ACTIVE',
                theme: 'glass',
                permissions: defaultPerms,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            };
            await setDoc(profileRef, newProfile);
            profileSnap = await getDoc(profileRef);
        } else {
            // ETAPA 1: Auditoria de campos críticos e Auto-healing Mandatório
            const data = profileSnap.data();
            const needsFix = !data.permissions || !data.role || data.isActive === undefined;
            
            if (needsFix) {
                await updateDoc(profileRef, {
                    permissions: data.permissions || defaultPerms,
                    role: data.role || defaultRole,
                    isActive: data.isActive ?? true,
                    updatedAt: serverTimestamp()
                });
                profileSnap = await getDoc(profileRef);
            }
        }

        const data = profileSnap.data()!;
        
        return {
            id: fbUser.uid,
            uid: fbUser.uid,
            username: data.username,
            name: data.name,
            email: data.email,
            role: data.role,
            isActive: data.isActive,
            theme: data.theme || "glass",
            userStatus: data.userStatus || "ACTIVE",
            createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
            updatedAt: data.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
            permissions: data.permissions,
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

// Fix: implemented missing getSession to resolve module export errors.
/**
 * Retorna o usuário da sessão atual armazenado localmente.
 */
export const getSession = (): User | null => {
    const session = localStorage.getItem("sys_session_v1");
    if (!session) return null;
    try {
        return JSON.parse(session);
    } catch {
        return null;
    }
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
        let msg = "Falha na autenticação.";
        if (e.code === 'auth/invalid-credential') msg = "E-mail ou senha incorretos.";
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
        const q = query(collection(db, "profiles"), orderBy("name"));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data() } as User));
    } catch (e) { return []; }
};

export const createUser = async (adminId: string, userData: any) => {
    const userCredential = await createUserWithEmailAndPassword(auth, userData.email, "Gestor360!");
    const fbUser = userCredential.user;
    const role: UserRole = userData.role || 'USER';
    await setDoc(doc(db, "profiles", fbUser.uid), {
        uid: fbUser.uid,
        username: userData.username || userData.email.split('@')[0],
        name: userData.name,
        email: userData.email,
        role: role,
        isActive: true,
        userStatus: 'ACTIVE',
        permissions: role === 'DEV' ? DEV_PERMISSIONS : DEFAULT_PERMISSIONS,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    });
    return { success: true };
};

export const updateUser = async (userId: string, data: any) => {
    await updateDoc(doc(db, "profiles", userId), { ...data, updatedAt: serverTimestamp() });
};

export const deactivateUser = async (userId: string) => {
    await updateUser(userId, { isActive: false, userStatus: 'INACTIVE' });
};

export const sendMagicLink = async (email: string) => { await sendPasswordResetEmail(auth, email); };
export const requestPasswordReset = async (email: string) => { await sendPasswordResetEmail(auth, email); };
export const changePassword = async (userId: string, newPassword: string) => {
    // Fix: replaced 'fbAuth' with 'auth' as it was not defined.
    if (auth.currentUser?.uid === userId) await updatePassword(auth.currentUser, newPassword);
};

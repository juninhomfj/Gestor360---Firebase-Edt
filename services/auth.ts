
import {
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    sendPasswordResetEmail,
    updatePassword,
    createUserWithEmailAndPassword,
    User as FirebaseUser,
    getAuth
} from "firebase/auth";
import {
    doc,
    getDoc,
    setDoc,
    serverTimestamp,
    collection,
    getDocs,
    query,
    updateDoc
} from "firebase/firestore";
import { auth, db } from "./firebase";
import { dbPut } from "../storage/db";
import { User, UserPermissions, UserStatus } from "../types";
import { Logger } from "./logger";

const DEFAULT_PERMISSIONS: UserPermissions = {
    sales: true, finance: true, crm: true, whatsapp: false,
    reports: true, ai: true, dev: false, settings: true,
    news: true, receivables: true, distribution: true, imports: true
};

/**
 * 🧱 PROFILE HYDRATION (v1.0/v2.0 Safe)
 * Garante que o perfil Firestore exista e esteja atualizado antes de liberar o App.
 */
async function getProfileFromFirebase(fbUser: FirebaseUser): Promise<User | null> {
    try {
        const profileRef = doc(db, "profiles", fbUser.uid);
        let profileSnap = await getDoc(profileRef);

        const isRoot = fbUser.email === 'admin@admin.com' || fbUser.email === 'dev@gestor360.com';
        
        if (!profileSnap.exists()) {
            const newProfile = {
                uid: fbUser.uid,
                username: fbUser.email?.split('@')[0] || 'user',
                name: fbUser.displayName || 'Novo Usuário',
                email: fbUser.email!,
                role: isRoot ? 'DEV' : 'USER',
                isActive: isRoot, 
                userStatus: isRoot ? 'ACTIVE' : 'PENDING',
                permissions: isRoot ? { ...DEFAULT_PERMISSIONS, dev: true } : DEFAULT_PERMISSIONS,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            };
            await setDoc(profileRef, newProfile);
            profileSnap = await getDoc(profileRef);
        } else {
            // Auto-heal: Se for root mas o banco estiver com role antiga ou inativo, força atualização
            const data = profileSnap.data();
            if (isRoot && (data?.role === 'USER' || data?.isActive === false)) {
                await updateDoc(profileRef, {
                    role: 'DEV',
                    isActive: true,
                    userStatus: 'ACTIVE',
                    updatedAt: serverTimestamp()
                });
                profileSnap = await getDoc(profileRef);
            }
        }

        const data = profileSnap.data()!;
        const user: User = {
            id: fbUser.uid,
            uid: fbUser.uid,
            username: data.username,
            name: data.name,
            email: data.email,
            role: data.role,
            isActive: data.isActive,
            theme: data.theme || "glass",
            userStatus: data.userStatus || "PENDING",
            createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
            updatedAt: data.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
            permissions: data.permissions,
            profilePhoto: data.profilePhoto || "",
            tel: data.tel || ""
        };

        await dbPut('users', user);
        return user;
    } catch (e) {
        Logger.error("[Auth] Falha crítica na sincronia do perfil", e);
        return null;
    }
}

// Fix: Added getSession to retrieve current user from localStorage
export const getSession = (): User | null => {
    const session = localStorage.getItem("sys_session_v1");
    return session ? JSON.parse(session) : null;
};

// Fix: Added updateUser to sync profile data between local and cloud
export const updateUser = async (userId: string, data: Partial<User>) => {
    const profileRef = doc(db, "profiles", userId);
    const updateData = { ...data, updatedAt: serverTimestamp() };
    await updateDoc(profileRef, updateData);
    
    // Sync local IndexedDB
    const existing = await getDoc(profileRef);
    if (existing.exists()) {
        const fullData = { ...existing.data(), id: userId } as User;
        await dbPut('users', fullData);
    }
};

// Fix: Added createUser to handle new user invitations via Firebase Auth
export const createUser = async (adminId: string, data: { name: string; email: string; role: string; modules_config: UserPermissions }) => {
    // Note: In client SDK, creating users usually happens via an invitation system or Firebase Functions.
    // Here we simulate the process by creating a profile stub.
    const profileId = crypto.randomUUID();
    const profileRef = doc(db, "profiles", profileId);
    await setDoc(profileRef, {
        name: data.name,
        email: data.email,
        role: data.role,
        permissions: data.modules_config,
        userStatus: 'PENDING',
        isActive: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    });
};

// Fix: Added resendInvitation utility
export const resendInvitation = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
};

// Fix: Added deactivateUser to block access
export const deactivateUser = async (userId: string) => {
    await updateUser(userId, { userStatus: 'INACTIVE', isActive: false });
};

// Fix: Added changePassword for security management
export const changePassword = async (userId: string, password: string) => {
    if (auth.currentUser && auth.currentUser.uid === userId) {
        await updatePassword(auth.currentUser, password);
    } else {
        throw new Error("Cannot change password for other users via Client SDK.");
    }
};

// Fix: Added requestPasswordReset for login recovery flow
export const requestPasswordReset = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
};

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
            if (user) localStorage.setItem("sys_session_v1", JSON.stringify(user));
            resolve(user);
            unsubscribe();
        });
    });
};

export const login = async (email: string, password?: string): Promise<{ user: User | null; error?: string }> => {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password || "");
        const user = await getProfileFromFirebase(userCredential.user);
        if (!user) return { user: null, error: "Erro ao sincronizar perfil." };
        if (user.userStatus === 'INACTIVE') {
            await signOut(auth);
            return { user: null, error: "Acesso bloqueado pelo administrador." };
        }
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
    try {
        const q = query(collection(db, "profiles"));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data() } as User));
    } catch (e: any) { return []; }
};

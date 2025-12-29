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

import { initializeApp, getApps } from "firebase/app";
import { auth, db, firebaseConfig } from "./firebase";
import { dbPut } from "../storage/db";
import { User, UserRole, UserPermissions, UserStatus } from "../types";

const secondaryApp = getApps().find(a => a.name === "SecondaryApp") || initializeApp(firebaseConfig, "SecondaryApp");
const secondaryAuth = getAuth(secondaryApp);

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
            const defaultRole = isRoot ? 'DEV' : 'USER';
            const defaultPerms = isRoot ? DEV_PERMISSIONS : DEFAULT_PERMISSIONS;
            const defaultStatus: UserStatus = isRoot ? 'ACTIVE' : 'PENDING';

            const newProfile = {
                uid: fbUser.uid,
                username: fbUser.email?.split('@')[0] || 'user',
                name: fbUser.displayName || 'Novo Usuário',
                email: fbUser.email!,
                role: defaultRole,
                isActive: isRoot, 
                userStatus: defaultStatus,
                theme: 'glass',
                permissions: defaultPerms,
                profilePhoto: "",
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            };
            await setDoc(profileRef, newProfile);
            profileSnap = await getDoc(profileRef);
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
            userStatus: data.userStatus || (data.isActive ? "ACTIVE" : "PENDING"),
            createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
            updatedAt: data.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
            permissions: data.permissions,
            profilePhoto: data.profilePhoto || "",
            tel: data.tel || ""
        };

        await dbPut('users', user);
        return user;
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
        if (!user) return { user: null, error: "Erro ao sincronizar perfil." };
        if (user.userStatus === 'INACTIVE') {
            await signOut(auth);
            return { user: null, error: "Acesso bloqueado pelo administrador." };
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
        const q = query(collection(db, "profiles"));
        const snap = await getDocs(q);
        return snap.docs.map(d => {
            const data = d.data();
            return {
                id: d.id,
                ...data,
                createdAt: data.createdAt?.toDate?.()?.toISOString(),
                updatedAt: data.updatedAt?.toDate?.()?.toISOString(),
            } as User;
        }).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    } catch (e: any) { return []; }
};

export const createUser = async (adminId: string, userData: any) => {
    const userCredential = await createUserWithEmailAndPassword(secondaryAuth, userData.email, "Gestor360!");
    const fbUser = userCredential.user;
    const role: UserRole = userData.role || 'USER';
    
    await setDoc(doc(db, "profiles", fbUser.uid), {
        uid: fbUser.uid,
        username: userData.username || userData.email.split('@')[0],
        name: userData.name,
        email: userData.email,
        role: role,
        isActive: false, 
        userStatus: 'PENDING',
        permissions: role === 'DEV' ? DEV_PERMISSIONS : (userData.modules_config || DEFAULT_PERMISSIONS),
        profilePhoto: "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    });

    await sendPasswordResetEmail(secondaryAuth, userData.email);
    await signOut(secondaryAuth);
    return { success: true };
};

export const resendInvitation = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
    return { success: true };
};

/**
 * Atualiza dados do usuário no Firestore.
 * Filtra metadados e garante apenas gravação de campos permitidos.
 */
export const updateUser = async (userId: string, data: any) => {
    const userRef = doc(db, "profiles", userId);
    
    // Lista de campos permitidos para gravação no Firestore
    const ALLOWED_FIELDS = ['name', 'username', 'tel', 'profilePhoto', 'role', 'isActive', 'userStatus', 'permissions', 'theme', 'contactVisibility'];
    
    const cleanData = Object.entries(data).reduce((acc, [key, value]) => {
        if (ALLOWED_FIELDS.includes(key) && value !== undefined) {
            acc[key] = value;
        }
        return acc;
    }, {} as any);

    if (cleanData.isActive === true) cleanData.userStatus = 'ACTIVE';
    if (cleanData.isActive === false) cleanData.userStatus = 'INACTIVE';

    await updateDoc(userRef, { 
        ...cleanData, 
        updatedAt: serverTimestamp() 
    });

    const current = await getDoc(userRef);
    if (current.exists()) {
        const fullData = current.data();
        const userObj: User = {
            id: userId,
            uid: userId,
            ...fullData,
            createdAt: fullData.createdAt?.toDate?.()?.toISOString(),
            updatedAt: new Date().toISOString()
        } as User;
        await dbPut('users', userObj);
    }
};

export const deactivateUser = async (userId: string) => {
    await updateUser(userId, { isActive: false, userStatus: 'INACTIVE' });
};

export const requestPasswordReset = async (email: string) => { await sendPasswordResetEmail(auth, email); };

export const changePassword = async (userId: string, newPassword: string) => {
    // FIX: Using correctly imported 'auth' instance instead of undefined 'fbAuth'
    if (auth.currentUser?.uid === userId) {
        await updatePassword(auth.currentUser, newPassword);
        const userRef = doc(db, "profiles", userId);
        const snap = await getDoc(userRef);
        
        if (snap.exists()) {
            const data = snap.data();
            if (data.userStatus === 'PENDING') {
                await updateDoc(userRef, {
                    userStatus: 'ACTIVE',
                    isActive: true,
                    updatedAt: serverTimestamp()
                });
                
                const session = getSession();
                if (session && session.id === userId) {
                    const updated = { ...session, userStatus: 'ACTIVE' as UserStatus, isActive: true };
                    localStorage.setItem("sys_session_v1", JSON.stringify(updated));
                }
            }
        }
    }
};
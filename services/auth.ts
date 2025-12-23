
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

/**
 * Sincroniza o perfil do Firestore com o usuário autenticado.
 * REGRA: Esta função só pode ser chamada APÓS o Firebase Auth retornar sucesso.
 */
async function syncAndFetchProfile(fbUser: FirebaseUser): Promise<User | null> {
    try {
        const profileRef = doc(db, "profiles", fbUser.uid);
        let profileSnap = await getDoc(profileRef);

        // AUTO-HEALING (Pós-Auth): Cria documento de perfil se ausente
        if (!profileSnap.exists()) {
            console.warn(`[Auth] Criando documento de perfil no Firestore para ${fbUser.email}`);
            const isRoot = fbUser.email === 'admin@admin.com' || fbUser.email === 'dev@gestor360.com';
            
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
        return {
            id: fbUser.uid,
            uid: fbUser.uid,
            username: data.username,
            name: data.name,
            email: data.email,
            role: data.role || 'USER',
            isActive: data.isActive !== false,
            theme: data.theme || "glass",
            userStatus: data.userStatus || "ACTIVE",
            createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
            updatedAt: data.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
            permissions: data.permissions || DEFAULT_PERMISSIONS,
            profilePhoto: data.profilePhoto || "",
            tel: data.tel || ""
        } as User;
    } catch (e) {
        console.error("[Auth] Erro ao carregar perfil do Firestore:", e);
        return null;
    }
}

/**
 * Escuta o estado do Auth e retorna a sessão processada.
 * Respeita a ordem: Auth Check -> Firestore Read.
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
            
            // Autenticado com sucesso via Persistence/Refresh -> Busca Perfil
            const user = await syncAndFetchProfile(fbUser);
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

/**
 * Login principal: fluxo direto signIn -> syncProfile.
 * O erro invalid-credential agora é isolado e tratado.
 */
export const login = async (email: string, password?: string): Promise<{ user: User | null; error?: string }> => {
    try {
        // PASSO 1: Autenticação Direta (Isole o Firestore aqui para evitar concorrência)
        const userCredential = await signInWithEmailAndPassword(auth, email, password || "");
        
        // PASSO 2: Sincronização de Perfil APÓS Sucesso Garantido
        const user = await syncAndFetchProfile(userCredential.user);
        
        if (!user) return { user: null, error: "Usuário autenticado, mas erro ao sincronizar perfil." };
        if (!user.isActive) {
            await signOut(auth);
            return { user: null, error: "Acesso bloqueado: Conta inativa." };
        }

        localStorage.setItem("sys_session_v1", JSON.stringify(user));
        return { user };
    } catch (e: any) {
        console.error("[Auth] Falha no login:", e.code);
        let msg = "E-mail ou senha inválidos.";
        if (e.code === 'auth/invalid-credential') msg = "E-mail ou senha incorretos.";
        if (e.code === 'auth/user-not-found') msg = "E-mail não cadastrado.";
        if (e.code === 'auth/wrong-password') msg = "Senha incorreta.";
        if (e.code === 'auth/network-request-failed') msg = "Falha de rede. Verifique sua conexão.";
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
    
    // Sincroniza sessão local se for o próprio usuário logado
    const currentSession = getSession();
    if (currentSession && (currentSession.id === userId || currentSession.uid === userId)) {
        localStorage.setItem("sys_session_v1", JSON.stringify({ ...currentSession, ...data }));
    }
};

export const deactivateUser = async (userId: string) => {
    await updateUser(userId, { isActive: false, userStatus: 'INACTIVE' });
};

export const sendMagicLink = async (email: string) => {
    await requestPasswordReset(email);
};

export const requestPasswordReset = async (email: string) => { await sendPasswordResetEmail(auth, email); };
export const changePassword = async (userId: string, newPassword: string) => {
    if (auth.currentUser?.uid === userId) await updatePassword(auth.currentUser, newPassword);
};

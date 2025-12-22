
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
 * Normaliza a Role do usuário vinda do banco para o padrão DEV | ADMIN | USER
 */
const normalizeRole = (data: any): UserRole => {
    const rawRole = (
        data.role || 
        data.profile || 
        data.permissions?.role || 
        'USER'
    ).toString().toUpperCase();

    if (rawRole === 'DEV' || rawRole === 'DEVELOPER') return 'DEV';
    if (rawRole === 'ADMIN') return 'ADMIN';
    return 'USER';
};

/**
 * Retorna o usuário logado do cache local.
 */
export const getSession = (): User | null => {
    const session = localStorage.getItem("sys_session_v1");
    if (!session) return null;
    const user = JSON.parse(session) as User;
    if (!user.isActive) return null;
    return user;
};

/**
 * LOGIN: Valida Auth + Status no Firestore
 */
export const login = async (
    email: string,
    password?: string
): Promise<{ user: User | null; error?: string; code?: string }> => {
    try {
        const userCredential = await signInWithEmailAndPassword(
            auth,
            email,
            password || ""
        );

        const fbUser = userCredential.user;
        const profileRef = doc(db, "profiles", fbUser.uid);
        const profileSnap = await getDoc(profileRef);

        if (!profileSnap.exists()) {
            await signOut(auth);
            return { user: null, error: "Perfil não configurado no sistema.", code: 'PROFILE_MISSING' };
        }

        const data = profileSnap.data();

        // Bloqueio de usuários inativos (conforme campo isActive ou user_status)
        const isActive = data.isActive !== false && data.user_status !== "INACTIVE";
        if (!isActive) {
            await signOut(auth);
            return {
                user: null,
                error: "Sua conta foi desativada. Entre em contato com o suporte.",
                code: 'USER_INACTIVE'
            };
        }

        const user: User = {
            id: fbUser.uid,
            username: data.username,
            name: data.name,
            email: fbUser.email!,
            tel: data.tel || "",
            role: normalizeRole(data),
            isActive: true,
            profilePhoto: data.profilePictureUrl || "",
            theme: data.theme || "glass",
            userStatus: "ACTIVE",
            createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
            modules: data.modules_config || {},
            chat_config: data.chat_config || {
                public_access: false,
                private_enabled: true
            },
            keys: data.keys
        };

        localStorage.setItem("sys_session_v1", JSON.stringify(user));
        return { user };
    } catch (e: any) {
        return {
            user: null,
            error: "Credenciais inválidas ou erro de conexão.",
            code: 'AUTH_FAILED'
        };
    }
};

/**
 * RESTAURA SESSÃO: Observador nativo do Firebase.
 * Aguarda a resolução do perfil no Firestore antes de liberar.
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
                const profileSnap = await getDoc(doc(db, "profiles", fbUser.uid));
                if (!profileSnap.exists()) {
                    await signOut(auth);
                    resolve(null);
                    unsubscribe();
                    return;
                }

                const data = profileSnap.data();
                const isActive = data.isActive !== false && data.user_status !== "INACTIVE";

                if (!isActive) {
                    await signOut(auth);
                    resolve(null);
                    unsubscribe();
                    return;
                }

                const user: User = {
                    id: fbUser.uid,
                    username: data.username,
                    name: data.name,
                    email: fbUser.email!,
                    tel: data.tel || "",
                    role: normalizeRole(data),
                    isActive: true,
                    profilePhoto: data.profilePictureUrl || "",
                    theme: data.theme || "glass",
                    userStatus: "ACTIVE",
                    createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
                    modules: data.modules_config || {},
                    chat_config: data.chat_config || {
                        public_access: false,
                        private_enabled: true
                    },
                    keys: data.keys
                };

                localStorage.setItem("sys_session_v1", JSON.stringify(user));
                resolve(user);
            } catch (e) {
                resolve(null);
            }
            unsubscribe();
        });
    });
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
            isActive: data.isActive !== false && data.user_status !== "INACTIVE",
            userStatus: data.user_status,
            modules: data.modules_config,
            chat_config: data.chat_config,
            profilePhoto: data.profilePictureUrl
        } as any;
    });
};

export const createUser = async (
    adminId: string,
    userData: {
        email: string;
        username: string;
        name: string;
        role: UserRole;
        tel?: string;
        modules_config: UserModules;
    }
) => {
    const tempPassword = "SetPassword360!" + Math.floor(Math.random() * 1000);
    const userCredential = await createUserWithEmailAndPassword(
        auth,
        userData.email,
        tempPassword
    );

    const uid = userCredential.user.uid;
    await setDoc(doc(db, "profiles", uid), {
        username: userData.username,
        name: userData.name,
        email: userData.email,
        tel: userData.tel || "",
        role: userData.role,
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
    await updateDoc(ref, {
        ...data,
        updatedAt: serverTimestamp()
    });
    
    // Atualiza cache local se for o próprio usuário
    if (auth.currentUser?.uid === userId) {
        const current = getSession();
        if (current) {
            localStorage.setItem("sys_session_v1", JSON.stringify({ ...current, ...data }));
        }
    }
};

export const deactivateUser = async (userId: string) => {
    const ref = doc(db, "profiles", userId);
    await updateDoc(ref, {
        isActive: false,
        user_status: "INACTIVE",
        deactivatedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    });
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

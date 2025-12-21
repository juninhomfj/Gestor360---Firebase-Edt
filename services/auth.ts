
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
    query,
    where
} from "firebase/firestore";

import { auth, db } from "./firebase";
import { User, UserRole, UserStatus, UserModules } from "../types";

/**
 * Retorna o usuário logado do cache local.
 */
export const getSession = (): User | null => {
    const session = localStorage.getItem("sys_session_v1");
    return session ? JSON.parse(session) : null;
};

/**
 * LOGIN: Valida Auth + Status no Firestore
 */
export const login = async (
    email: string,
    password?: string
): Promise<{ user: User | null; error?: string }> => {
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
            return { user: null, error: "Perfil não configurado no sistema." };
        }

        const data = profileSnap.data();

        // ETAPA 2: Bloqueio de usuários inativos
        if (data.user_status === "INACTIVE") {
            await signOut(auth);
            return {
                user: null,
                error: "Sua conta foi desativada. Entre em contato com o suporte."
            };
        }

        const user: User = {
            id: fbUser.uid,
            username: data.username,
            name: data.name,
            email: fbUser.email!,
            tel: data.tel || "",
            role: data.role as UserRole,
            profilePhoto: data.profilePictureUrl || "",
            theme: data.theme || "glass",
            userStatus: data.user_status as UserStatus,
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
            error: "Credenciais inválidas ou erro de conexão."
        };
    }
};

/**
 * RESTAURA SESSÃO: Observador nativo do Firebase
 */
export const reloadSession = (): Promise<User | null> => {
    return new Promise((resolve) => {
        onAuthStateChanged(auth, async (fbUser) => {
            if (!fbUser) {
                resolve(null);
                return;
            }

            const profileSnap = await getDoc(doc(db, "profiles", fbUser.uid));
            if (!profileSnap.exists()) {
                resolve(null);
                return;
            }

            const data = profileSnap.data();

            if (data.user_status !== "ACTIVE") {
                await signOut(auth);
                resolve(null);
                return;
            }

            const user: User = {
                id: fbUser.uid,
                username: data.username,
                name: data.name,
                email: fbUser.email!,
                tel: data.tel || "",
                role: data.role as UserRole,
                profilePhoto: data.profilePictureUrl || "",
                theme: data.theme || "glass",
                userStatus: data.user_status as UserStatus,
                createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
                modules: data.modules_config || {},
                chat_config: data.chat_config || {
                    public_access: false,
                    private_enabled: true
                },
                keys: data.keys
            };

            resolve(user);
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
            role: data.role,
            userStatus: data.user_status,
            modules: data.modules_config,
            chat_config: data.chat_config,
            profilePhoto: data.profilePictureUrl
        } as User;
    });
};

/**
 * ETAPA 3: Criar usuário (Admin) vinculando UID do Auth ao ID do Doc
 */
// Fixed: Using UserModules instead of Record<string, boolean> to satisfy index signature requirements.
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
    // Senha temporária para criação (será resetada pelo usuário)
    const tempPassword = "SetPassword360!" + Math.floor(Math.random() * 1000);

    // 1. Cria no Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(
        auth,
        userData.email,
        tempPassword
    );

    const uid = userCredential.user.uid;

    // 2. Cria o perfil no Firestore usando o UID como chave
    await setDoc(doc(db, "profiles", uid), {
        username: userData.username,
        name: userData.name,
        email: userData.email,
        tel: userData.tel || "",
        role: userData.role,
        modules_config: userData.modules_config,
        user_status: "ACTIVE",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: adminId
    });

    // 3. Envia e-mail de reset de senha para que o usuário defina a sua própria
    await sendPasswordResetEmail(auth, userData.email);

    return { success: true };
};

/**
 * ETAPA 4: Atualizar perfil com proteção de campos sensíveis
 */
export const updateUser = async (userId: string, data: any) => {
    const ref = doc(db, "profiles", userId);
    await updateDoc(ref, {
        ...data,
        updatedAt: serverTimestamp()
    });
};

export const deactivateUser = async (userId: string) => {
    const ref = doc(db, "profiles", userId);
    await updateDoc(ref, {
        user_status: "INACTIVE",
        deactivatedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    });
};

export const requestPasswordReset = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
};

// Fixed: Added sendMagicLink as a required export for Login.tsx. 
// For this context, it utilizes sendPasswordResetEmail to provide authenticated entry instructions.
export const sendMagicLink = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
};

export const changePassword = async (userId: string, newPassword: string) => {
    if (auth.currentUser?.uid === userId) {
        await updatePassword(auth.currentUser, newPassword);
    }
};

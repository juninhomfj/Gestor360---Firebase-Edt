// services/auth.ts
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updatePassword
} from "firebase/auth";

import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  collection,
  getDocs,
  query,
  where
} from "firebase/firestore";

import { dbPut } from "../storage/db";
import { Logger } from "./logger";
import { User, UserPermissions } from "../types";

const auth = getAuth();
const db = getFirestore();

const DEFAULT_PERMISSIONS: UserPermissions = {
  sales: true,
  finance: true,
  crm: false,
  whatsapp: false,
  reports: false,
  ai: false,
  dev: false,
  settings: true,
  news: false,
  fiscal: false,
  abc_analysis: false,
  ltv_details: false,
  ai_retention: false,
  receivables: false,
  distribution: false,
  imports: false,
  manual_billing: false,
  audit_logs: false
};

/**
 * 🧱 PROFILE HYDRATION & MIGRATION ENGINE (v3.1)
 * Garante que o perfil Firestore exista, esteja atualizado e migra campos legados para prefs.defaultModule.
 */
async function getProfileFromFirebase(fbUser: any): Promise<User | null> {
  try {
    const profileRef = doc(db, "profiles", fbUser.uid);
    let profileSnap = await getDoc(profileRef);

    const isRoot = fbUser.email === "admin@admin.com" || fbUser.email === "dev@gestor360.com";

    if (!profileSnap.exists()) {
      const newProfile = {
        uid: fbUser.uid,
        username: fbUser.email?.split("@")[0] || "user",
        name: fbUser.displayName || "Novo Usuário",
        email: fbUser.email!,
        role: isRoot ? "DEV" : "USER",
        isActive: isRoot,
        userStatus: isRoot ? "ACTIVE" : "PENDING",
        modules: isRoot ? { ...DEFAULT_PERMISSIONS, dev: true } : DEFAULT_PERMISSIONS,
        permissions: isRoot ? { ...DEFAULT_PERMISSIONS, dev: true } : DEFAULT_PERMISSIONS,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        prefs: { defaultModule: 'home' }
      };
      await setDoc(profileRef, newProfile);
      profileSnap = await getDoc(profileRef);
    }

    const data = profileSnap.data();
    let needsMigrationUpdate = false;
    let migratedPrefs = { ...(data?.prefs || {}) };

    // --- MOTOR DE MIGRAÇÃO DE PREFERÊNCIAS (ETAPA 1) ---
    // Se não temos o campo canônico, mas temos campos antigos, migramos.
    if (!migratedPrefs.defaultModule) {
      const legacyValue = data?.HomeModule || data?.homeTab || data?.moduleDefault || data?.prefs?.HomeModule || null;
      if (legacyValue) {
        migratedPrefs.defaultModule = legacyValue;
        needsMigrationUpdate = true;
        Logger.info(`[Migration] Migrando preferência legada "${legacyValue}" para defaultModule.`);
      } else {
        migratedPrefs.defaultModule = 'home';
      }
    }

    // Se houve migração ou correção de role para ROOT, atualiza o Firestore de forma silenciosa
    if (needsMigrationUpdate || (isRoot && (data?.role === "USER" || data?.isActive === false))) {
        await updateDoc(profileRef, {
          role: isRoot ? "DEV" : data?.role,
          isActive: isRoot ? true : data?.isActive,
          userStatus: isRoot ? "ACTIVE" : data?.userStatus,
          prefs: migratedPrefs,
          updatedAt: serverTimestamp()
        });
    }
    // ----------------------------------------------------

    const user: User = {
      id: fbUser.uid,
      uid: fbUser.uid,
      username: data?.username || fbUser.email?.split("@")[0] || "user",
      name: data?.name || fbUser.displayName || "Usuário",
      email: data?.email || fbUser.email || "",
      role: data?.role || 'USER',
      isActive: data?.isActive ?? true,
      theme: data?.theme || "glass",
      userStatus: data?.userStatus || "PENDING",
      createdAt: data?.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
      updatedAt: data?.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
      permissions: data?.modules || data?.permissions || DEFAULT_PERMISSIONS,
      profilePhoto: data?.profilePhoto || "",
      tel: data?.tel || "",
      prefs: migratedPrefs
    };

    await dbPut("users", user);
    localStorage.setItem("sys_session_v1", JSON.stringify(user));
    return user;
  } catch (e) {
    Logger.error("[Auth] Falha crítica na sincronia ou migração do perfil", e);
    return null;
  }
}

export const getSession = (): User | null => {
  const session = localStorage.getItem("sys_session_v1");
  return session ? JSON.parse(session) : null;
};

export const updateUser = async (userId: string, data: Partial<User>) => {
  const profileRef = doc(db, "profiles", userId);
  const updateData = { ...data, updatedAt: serverTimestamp() };
  await updateDoc(profileRef, updateData);

  const current = getSession();
  if (current?.id === userId) {
    const merged = { ...current, ...data } as User;
    localStorage.setItem("sys_session_v1", JSON.stringify(merged));
  }
};

export const login = async (email: string, pass: string): Promise<{ user: User | null; error: string | null }> => {
    try {
        const user = await loginWithEmail(email, pass);
        return { user, error: null };
    } catch (e: any) {
        return { user: null, error: e.message };
    }
};

export const loginWithEmail = async (email: string, pass: string): Promise<User> => {
  const cred = await signInWithEmailAndPassword(auth, email.trim(), pass);
  const profile = await getProfileFromFirebase(cred.user);
  if (!profile) throw new Error("Perfil não encontrado no Firestore. Contate o administrador.");
  return profile;
};

export const listUsers = async (): Promise<User[]> => {
    try {
        const q = collection(db, "profiles");
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ ...d.data(), id: d.id } as User));
    } catch (e) {
        console.error("[Auth] listUsers error:", e);
        return [];
    }
};

export const createUser = async (adminId: string, userData: any): Promise<void> => {
    const { name, email, role, modules_config } = userData;
    const newUid = crypto.randomUUID();
    const profileRef = doc(db, "profiles", newUid);
    const newProfile = {
        uid: newUid,
        email,
        name,
        role,
        modules: modules_config,
        isActive: true,
        userStatus: 'PENDING',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        prefs: { defaultModule: 'home' }
    };
    await setDoc(profileRef, newProfile);
};

export const resendInvitation = async (email: string): Promise<void> => {
    await sendPasswordResetEmail(auth, email);
};

export const deactivateUser = async (userId: string): Promise<void> => {
    await updateUser(userId, { isActive: false, userStatus: 'INACTIVE' });
};

export const changePassword = async (userId: string, newPass: string): Promise<void> => {
    if (auth.currentUser && auth.currentUser.uid === userId) {
        await updatePassword(auth.currentUser, newPass);
    } else {
        throw new Error("Usuário não autenticado ou ID divergente.");
    }
};

export const requestPasswordReset = async (email: string): Promise<void> => {
    await sendPasswordResetEmail(auth, email);
};

export const reloadSession = async (): Promise<User | null> => {
  const fbUser = auth.currentUser;
  if (!fbUser) return null;
  return await getProfileFromFirebase(fbUser);
};

export const logout = async () => {
  localStorage.removeItem("sys_session_v1");
  await signOut(auth);
};

export const watchAuthChanges = (cb: (u: User | null) => void) => {
  return onAuthStateChanged(auth, async (fbUser) => {
    if (!fbUser) return cb(null);
    const user = await getProfileFromFirebase(fbUser);
    cb(user);
  });
};

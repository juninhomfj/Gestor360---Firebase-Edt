
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

// Fix: Corrected import path for database utilities from services to storage
import { dbPut } from "../storage/db";
import { Logger } from "./logger";
import { User, UserPermissions } from "../types";

const auth = getAuth();
const db = getFirestore();

// Default conservador: NÃO auto-libera módulos sensíveis.
// DEV/ADMIN habilitam via governança (campo modules).
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
 * 🧱 PROFILE HYDRATION (v1.0/v2.0 Safe)
 * Garante que o perfil Firestore exista e esteja atualizado antes de liberar o App.
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
        // Ao criar, inicializa ambos para compatibilidade, mas as regras de escrita protegem 'modules'
        modules: isRoot ? { ...DEFAULT_PERMISSIONS, dev: true } : DEFAULT_PERMISSIONS,
        permissions: isRoot ? { ...DEFAULT_PERMISSIONS, dev: true } : DEFAULT_PERMISSIONS,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      await setDoc(profileRef, newProfile);
      profileSnap = await getDoc(profileRef);
    } else {
      // Auto-heal: Se for root mas o banco estiver com role antiga ou inativo, força atualização
      const data = profileSnap.data();
      if (isRoot && (data?.role === "USER" || data?.isActive === false)) {
        await updateDoc(profileRef, {
          role: "DEV",
          isActive: true,
          userStatus: "ACTIVE",
          updatedAt: serverTimestamp()
        });
        profileSnap = await getDoc(profileRef);
      }
    }

    const data = profileSnap.data();

    const user: User = {
      id: fbUser.uid,
      uid: fbUser.uid,
      username: data?.username || fbUser.email?.split("@")[0] || "user",
      name: data?.name || fbUser.displayName || "Usuário",
      email: data?.email || fbUser.email || "",
      role: data?.role,
      isActive: data?.isActive,
      theme: data?.theme || "glass",
      userStatus: data?.userStatus || "PENDING",
      createdAt: data?.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
      updatedAt: data?.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
      // --- PATCH DE CONVERGÊNCIA ---
      // A UI usa '.permissions', mas o Firestore usa '.modules' como fonte de verdade.
      permissions: data?.modules || data?.permissions || DEFAULT_PERMISSIONS,
      // -----------------------------
      profilePhoto: data?.profilePhoto || "",
      tel: data?.tel || "",
      prefs: data?.prefs || {}
    };

    await dbPut("users", user);
    localStorage.setItem("sys_session_v1", JSON.stringify(user));
    return user;
  } catch (e) {
    Logger.error("[Auth] Falha crítica na sincronia do perfil", e);
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

  // Atualiza sessão se for o próprio usuário
  const current = getSession();
  if (current?.id === userId) {
    const merged = { ...current, ...data } as User;
    localStorage.setItem("sys_session_v1", JSON.stringify(merged));
  }
};

// Fix: Exported login function as expected by Login.tsx
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

// Fix: Exported listUsers function as expected by AdminUsers.tsx
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

// Fix: Exported createUser function as expected by AdminUsers.tsx
export const createUser = async (adminId: string, userData: any): Promise<void> => {
    const { name, email, role, modules_config } = userData;
    // Em um ambiente frontend puro, criamos apenas o documento de perfil.
    // O usuário deverá usar o link de recuperação para definir sua senha inicial.
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
        updatedAt: serverTimestamp()
    };
    await setDoc(profileRef, newProfile);
};

// Fix: Exported resendInvitation function as expected by AdminUsers.tsx
export const resendInvitation = async (email: string): Promise<void> => {
    await sendPasswordResetEmail(auth, email);
};

// Fix: Exported deactivateUser function as expected by UserProfile.tsx
export const deactivateUser = async (userId: string): Promise<void> => {
    await updateUser(userId, { isActive: false, userStatus: 'INACTIVE' });
};

// Fix: Exported changePassword function as expected by PasswordReset.tsx
export const changePassword = async (userId: string, newPass: string): Promise<void> => {
    if (auth.currentUser && auth.currentUser.uid === userId) {
        await updatePassword(auth.currentUser, newPass);
    } else {
        throw new Error("Usuário não autenticado ou ID divergente.");
    }
};

// Fix: Exported requestPasswordReset function as expected by RequestReset.tsx
export const requestPasswordReset = async (email: string): Promise<void> => {
    await sendPasswordResetEmail(auth, email);
};

export const reloadSession = async (): Promise<User | null> => {
  const fbUser = auth.currentUser;
  if (!fbUser) return null;

  const profile = await getProfileFromFirebase(fbUser);
  if (!profile) return null;

  return profile;
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

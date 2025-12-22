
export const SOURCE_FILES = {
    'types.ts': `export interface User {
    id: string;
    username: string;
    role: 'DEV' | 'ADMIN' | 'USER';
    isActive: boolean;
    modules: UserModules;
    // ...
}`,
    'services/logic.ts': `export const canAccess = (user: User | null, feature: string): boolean => {
    if (!user || !user.isActive) return false;
    if (user.role === 'DEV') return true; 
    return !!(user.modules as any)[feature];
};

export const bootstrapProductionData = async () => {
    // Garante Tabelas Iniciais no Firestore
};`,
    'services/auth.ts': `export const reloadSession = async () => {
    // Autentica via Firebase Auth
    // Recupera Perfil Firestore
    // Se não existir, auto-gera cargo DEV
};`,
    'components/Layout.tsx': `const hasAccess = (mod: string) => {
    return canAccess(currentUser, mod);
};

// Renderiza menus dinâmicos baseados no canAccess`,
    'DOCUMENTATION.md': `# Gestor360 v2.5.0 - Firebase Native Architecture

Este sistema utiliza escrita direta no Cloud Firestore para garantir consistência de dados entre múltiplos dispositivos de uma mesma organização.

## Segurança
- Hierarquia DEV > ADMIN > USER protegida por RLS.
- Chaves BYOK criptografadas no cliente.`
};

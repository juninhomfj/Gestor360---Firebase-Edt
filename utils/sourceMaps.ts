
// Este arquivo simula a leitura do código fonte para a aba "Código" no DevRoadmap.
// Em produção real, isso seria feito via API ou build step.

export const SOURCE_FILES = {
    'types.ts': `export type AppMode = 'SALES' | 'FINANCE' | 'WHATSAPP';
export interface User {
    id: string;
    username: string;
    role: 'ADMIN' | 'USER';
    authMethod: 'local' | 'supabase';
    // ...
}
export interface SyncEntry {
    table: SyncTable;
    type: SyncOperation;
    status: 'PENDING' | 'SYNCED';
    // ...
}`,
    'services/supabaseSync.ts': `import { getSupabase } from './supabase';
import { getPendingSyncs, dbPut, dbDelete } from '../storage/db';

export const processSyncQueue = async () => {
    if (isSyncing) return;
    const pending = await getPendingSyncs();
    
    // PUSH: IndexedDB -> Supabase
    for (const item of pending) {
        await processSingleItem(item);
    }
    
    // PULL: Supabase -> IndexedDB (Incremental)
    await pullChanges();
};`,
    'storage/db.ts': `import { openDB } from 'idb';

export const initDB = () => {
  return openDB('gestor360_local_db', 9, {
      upgrade(db) {
          // Stores locais
          if (!db.objectStoreNames.contains('sales')) db.createObjectStore('sales', { keyPath: 'id' });
          
          // Fila de Sincronização (Outbox Pattern)
          if (!db.objectStoreNames.contains('sync_queue')) {
              const syncStore = db.createObjectStore('sync_queue', { keyPath: 'id', autoIncrement: true });
              syncStore.createIndex('by-status', 'status');
          }
      }
  });
};`,
    'components/UserProfile.tsx': `// Lógica de Salvamento e Criptografia de Chaves
const handleSave = async () => {
    let encryptedKey = '';
    if (geminiKey) {
        encryptedKey = encryptData(geminiKey);
    }
    
    const updatePayload = {
        name,
        keys: {
            isGeminiEnabled,
            geminiApiKey: encryptedKey
        }
    };
    await updateUser(currentUser.id, updatePayload);
};`,
    'components/Layout.tsx': `// Correção Mobile (100dvh)
return (
    <div className="flex h-[100dvh] overflow-hidden ...">
        <aside className="hidden md:flex ...">
            {/* Desktop Sidebar */}
        </aside>
        
        <main className="flex-1 overflow-y-auto pb-32 md:pb-8">
            {/* Content Area com padding extra para Mobile */}
            {children}
        </main>
        
        <FAB /> {/* Floating Action Button */}
    </div>
);`,
    'DOCUMENTATION.md': `# Manual Mestre de Engenharia - Gestor360 (v2.3.5)

## 1. Arquitetura
O sistema opera em modelo **Híbrido (Local-First)**:
1.  **Escrita:** O usuário grava no IndexedDB. A UI atualiza instantaneamente.
2.  **Fila:** Uma entrada é criada na \`sync_queue\`.
3.  **Sync:** O \`supabaseSync.ts\` processa a fila em background e envia para o PostgreSQL.

## 2. Estrutura de Pastas (Raiz)
- \`/components\`: UI React (Tailwind).
- \`/services\`: Lógica de negócios e adaptadores.
- \`/storage\`: Camada de acesso ao IndexedDB.
- \`/utils\`: Helpers puros (formatação, criptografia).

## 3. Segurança
- **Chaves de API (Gemini):** Criptografadas no cliente (AES) antes de salvar no perfil.
- **Supabase:** RLS (Row Level Security) ativado em todas as tabelas.
`
};

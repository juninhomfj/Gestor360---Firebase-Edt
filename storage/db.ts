
import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { InternalMessage, User, LogEntry, Sale, CommissionRule, FinanceAccount, CreditCard, Transaction, TransactionCategory, FinanceGoal, Challenge, ChallengeCell, Receivable, WAContact, WATag, WACampaign, WAMessageQueue, ManualInteractionLog, CampaignStatistics, SyncEntry, Client, ClientTransferRequest, SyncTable } from '../types';

interface Gestor360DB extends DBSchema {
  users: { key: string; value: User };
  audit_log: { key: number; value: LogEntry };
  
  // CORE CRM
  clients: { key: string; value: Client };
  client_transfer_requests: { key: string; value: ClientTransferRequest };

  sales: { key: string; value: Sale };
  
  commission_basic: { key: string; value: CommissionRule };
  commission_natal: { key: string; value: CommissionRule };
  commission_custom: { key: string; value: CommissionRule }; 
  
  config: { key: string; value: any };
  
  accounts: { key: string; value: FinanceAccount };
  cards: { key: string; value: CreditCard };
  transactions: { key: string; value: Transaction };
  categories: { key: string; value: TransactionCategory };
  goals: { key: string; value: FinanceGoal };
  challenges: { key: string; value: Challenge };
  challenge_cells: { key: string; value: ChallengeCell };
  receivables: { key: string; value: Receivable };
  
  wa_contacts: { key: string; value: WAContact };
  wa_tags: { key: string; value: WATag };
  wa_campaigns: { key: string; value: WACampaign };
  wa_queue: { key: string; value: WAMessageQueue };
  wa_manual_logs: { key: string; value: ManualInteractionLog };
  wa_campaign_stats: { key: string; value: CampaignStatistics };

  internal_messages: {
      key: string;
      value: InternalMessage;
      indexes: { 'by-recipient': string };
  };

  // --- SYNC QUEUE (OUTBOX) ---
  sync_queue: {
      key: number;
      value: SyncEntry;
      autoIncrement: true;
      indexes: { 'by-status': string, 'by-table': string };
  };
}

const getDbName = () => {
    const env = localStorage.getItem('SYS_ENV');
    return env === 'TEST' ? 'gestor360_sandbox_db' : 'gestor360_local_db';
};

// FIX: Bumped to 15 to bypass browser cache version 14
const DB_VERSION = 15;

let dbPromise: Promise<IDBPDatabase<Gestor360DB>> | null = null;

export const closeDBConnection = async () => {
    if (dbPromise) {
        const db = await dbPromise;
        db.close();
        dbPromise = null;
    }
};

export const initDB = () => {
  if (!dbPromise) {
    const dbName = getDbName();
    
    dbPromise = openDB<Gestor360DB>(dbName, DB_VERSION, {
      upgrade(db, oldVersion, newVersion, transaction) {
        if (!db.objectStoreNames.contains('users')) db.createObjectStore('users', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('sales')) db.createObjectStore('sales', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('accounts')) db.createObjectStore('accounts', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('transactions')) db.createObjectStore('transactions', { keyPath: 'id' });
        
        if (!db.objectStoreNames.contains('clients')) db.createObjectStore('clients', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('client_transfer_requests')) db.createObjectStore('client_transfer_requests', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('commission_basic')) db.createObjectStore('commission_basic', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('commission_natal')) db.createObjectStore('commission_natal', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('commission_custom')) db.createObjectStore('commission_custom', { keyPath: 'id' }); 
        if (!db.objectStoreNames.contains('config')) db.createObjectStore('config'); 
        if (!db.objectStoreNames.contains('cards')) db.createObjectStore('cards', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('categories')) db.createObjectStore('categories', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('goals')) db.createObjectStore('goals', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('challenges')) db.createObjectStore('challenges', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('challenge_cells')) db.createObjectStore('challenge_cells', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('receivables')) db.createObjectStore('receivables', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('wa_contacts')) db.createObjectStore('wa_contacts', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('wa_tags')) db.createObjectStore('wa_tags', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('wa_campaigns')) db.createObjectStore('wa_campaigns', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('wa_queue')) db.createObjectStore('wa_queue', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('wa_manual_logs')) db.createObjectStore('wa_manual_logs', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('wa_campaign_stats')) db.createObjectStore('wa_campaign_stats', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('audit_log')) db.createObjectStore('audit_log', { keyPath: 'timestamp' });

        if (!db.objectStoreNames.contains('internal_messages')) {
            const msgStore = db.createObjectStore('internal_messages', { keyPath: 'id' });
            msgStore.createIndex('by-recipient', 'recipientId');
        }

        if (!db.objectStoreNames.contains('sync_queue')) {
            const syncStore = db.createObjectStore('sync_queue', { keyPath: 'id', autoIncrement: true });
            syncStore.createIndex('by-status', 'status');
            syncStore.createIndex('by-table', 'table');
        } else {
            const syncStore = transaction.objectStore('sync_queue');
            if (!syncStore.indexNames.contains('by-status')) syncStore.createIndex('by-status', 'status');
            if (!syncStore.indexNames.contains('by-table')) syncStore.createIndex('by-table', 'table');
        }
      },
    });
  }
  return dbPromise;
};

export const dbGetAll = async <StoreName extends keyof Gestor360DB>(
    storeName: StoreName, 
    filterFn?: (item: Gestor360DB[StoreName]['value']) => boolean,
    limit?: number
): Promise<Gestor360DB[StoreName]['value'][]> => {
    const db = await initDB();
    const all = await db.getAll(storeName as any);
    if (filterFn) {
        const filtered = all.filter(filterFn);
        return limit ? filtered.slice(0, limit) : filtered;
    }
    return limit ? all.slice(0, limit) : all;
};

export const dbGet = async <StoreName extends keyof Gestor360DB>(
    storeName: StoreName, 
    key: Gestor360DB[StoreName]['key']
): Promise<Gestor360DB[StoreName]['value'] | undefined> => {
    const db = await initDB();
    return await db.get(storeName as any, key);
};

export const dbPut = async <StoreName extends keyof Gestor360DB>(
    storeName: StoreName, 
    value: Gestor360DB[StoreName]['value'], 
    key?: Gestor360DB[StoreName]['key']
) => {
    const db = await initDB();
    await db.put(storeName as any, value, key);
};

export const dbBulkPut = async <StoreName extends keyof Gestor360DB>(
    storeName: StoreName, 
    values: Gestor360DB[StoreName]['value'][]
) => {
    const db = await initDB();
    const tx = db.transaction(storeName as any, 'readwrite');
    await Promise.all(values.map(v => tx.store.put(v)));
    await tx.done;
};

export const dbDelete = async <StoreName extends keyof Gestor360DB>(
    storeName: StoreName, 
    key: Gestor360DB[StoreName]['key']
) => {
    const db = await initDB();
    await db.delete(storeName as any, key);
};

export const dbClear = async <StoreName extends keyof Gestor360DB>(storeName: StoreName) => {
    const db = await initDB();
    await db.clear(storeName as any);
};

export const enqueueSync = async (entry: Omit<SyncEntry, 'id' | 'timestamp' | 'status' | 'retryCount'>) => {
    try {
        /* Fix: Included missing properties when enqueuing sync item */
        const fullEntry: Omit<SyncEntry, 'id'> = {
            ...entry,
            timestamp: Date.now(),
            status: 'PENDING',
            retryCount: 0
        } as any;
        await dbPut('sync_queue', fullEntry as SyncEntry);
    } catch (e) {
        console.error("[DB] Failed to enqueue sync item", e);
        throw e;
    }
};

export const getPendingSyncs = async () => {
    const db = await initDB();
    return db.getAllFromIndex('sync_queue', 'by-status', 'PENDING');
};

export const getPendingSyncsByTable = async (table: SyncTable) => {
    const db = await initDB();
    const allForTable = await db.getAllFromIndex('sync_queue', 'by-table', table);
    return allForTable.filter(entry => entry.status === 'PENDING');
};

export const saveConfigItem = async (key: string, value: any) => {
    await dbPut('config', value, key);
};

export const getConfigItem = async (key: string) => {
    return await dbGet('config', key);
};


import { dbGetAll, dbPut, enqueueSync } from '../storage/db';
/* Fix: Removed takeSnapshot from logic import as it will be provided by other means if needed, or implemented here */
import { saveSales } from './logic';
import { Client, Sale, LogEntry } from '../types';
import { Logger } from './logger';
import { markDirty } from './sync';

export interface MergePreviewResult {
    salesAffected: number;
    masterName: string;
    duplicatesCount: number;
}

export const previewClientMerge = async (
    masterId: string, 
    duplicateIds: string[]
): Promise<MergePreviewResult> => {
    const allSales = await dbGetAll('sales');
    // Conta vendas vinculadas via ID ou via Nome (legado)
    // Nota: O preview é uma estimativa. A execução real varre mais profundamente.
    
    // Precisamos dos nomes para verificar legado
    const allClients = await dbGetAll('clients');
    const duplicateClients = allClients.filter(c => duplicateIds.includes(c.id));
    const duplicateNames = duplicateClients.map(c => c.name.toLowerCase());

    const salesCount = allSales.filter(s => {
        if (s.deleted) return false;
        // Vínculo forte
        if (s.clientId && duplicateIds.includes(s.clientId)) return true;
        // Vínculo fraco (legado)
        if (!s.clientId && duplicateNames.includes(s.client.toLowerCase())) return true;
        return false;
    }).length;

    const master = allClients.find(c => c.id === masterId);

    return {
        salesAffected: salesCount,
        masterName: master?.name || 'Desconhecido',
        duplicatesCount: duplicateIds.length
    };
};

export const executeClientMerge = async (
    masterId: string, 
    duplicateIds: string[], 
    approvedName: string,
    currentUser: { id: string, name: string }
): Promise<boolean> => {
    
    // 1. Snapshot de Segurança
    const allSalesSnapshot = await dbGetAll('sales');
    
    try {
        const allClients = await dbGetAll('clients');
        const masterClient = allClients.find(c => c.id === masterId);
        if (!masterClient) throw new Error("Cliente mestre não encontrado.");

        const duplicateClients = allClients.filter(c => duplicateIds.includes(c.id));
        const duplicateNames = duplicateClients.map(c => c.name);

        // 2. Atualizar Vendas
        // Escopo: Apenas vendas QUE EU TENHO ACESSO (localmente todas, mas lógica de negócio é userId)
        // Como o banco é local e filtrado, assumimos que as vendas carregadas são visíveis.
        
        let salesUpdatedCount = 0;
        const updatedSales: Sale[] = [];

        for (const sale of allSalesSnapshot) {
            if (sale.deleted) continue;

            let shouldUpdate = false;

            // Checa vínculo por ID
            if (sale.clientId && duplicateIds.includes(sale.clientId)) {
                shouldUpdate = true;
            }
            // Checa vínculo por Nome (Case insensitive para robustez)
            else if (!sale.clientId && duplicateNames.some(n => n.toLowerCase() === sale.client.toLowerCase())) {
                shouldUpdate = true;
            }

            if (shouldUpdate) {
                updatedSales.push({
                    ...sale,
                    clientId: masterId, // Vínculo forte no novo mestre
                    client: approvedName, // Normaliza o texto
                    updatedAt: new Date().toISOString() // Se existir na interface Sale extendida, senão ignorado
                } as any);
                salesUpdatedCount++;
            }
        }

        // Persistir Vendas
        if (updatedSales.length > 0) {
            await saveSales(updatedSales);
        }

        // 3. Atualizar Cliente Mestre
        const updatedMaster: Client = {
            ...masterClient,
            name: approvedName,
            updatedAt: new Date().toISOString()
        };
        await dbPut('clients', updatedMaster);
        /* Fix: Corrected SyncEntry object structure */
        await enqueueSync({ table: 'clients', type: 'UPDATE', data: updatedMaster, rowId: updatedMaster.id } as any);

        // 4. Soft Delete nos Duplicados
        for (const dup of duplicateClients) {
            const deletedDup: Client = {
                ...dup,
                deleted: true,
                deletedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                notes: (dup.notes ? dup.notes + "\n" : "") + `[MESCLADO] Mesclado em ${updatedMaster.id} por ${currentUser.name}`
            };
            await dbPut('clients', deletedDup);
            /* Fix: Corrected SyncEntry object structure */
            await enqueueSync({ table: 'clients', type: 'UPDATE', data: deletedDup, rowId: deletedDup.id } as any);
        }

        // 5. Log de Auditoria
        Logger.info(`Mescla de clientes executada por ${currentUser.name}`, {
            masterId,
            duplicates: duplicateIds,
            salesMoved: salesUpdatedCount
        });

        markDirty();
        return true;

    } catch (e: any) {
        console.error("Erro crítico na mescla:", e);
        Logger.error("Falha na mescla de clientes", { error: e.message });
        throw e; // Repassa erro para UI
    }
};

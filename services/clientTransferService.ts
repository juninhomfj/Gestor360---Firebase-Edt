
import { dbPut, dbGet, dbGetAll, enqueueSync } from '../storage/db';
import { Client, ClientTransferRequest } from '../types';
import { markDirty } from './sync';

/**
 * Cria uma solicitação de transferência de cliente.
 */
export const requestClientTransfer = async (
    clientId: string,
    fromUserId: string,
    toUserId: string,
    message?: string
): Promise<ClientTransferRequest> => {
    
    // Validar integridade básica
    if (fromUserId === toUserId) {
        throw new Error("Origem e destino não podem ser iguais.");
    }

    // Verificar duplicidade de solicitações pendentes
    const existingRequests = await dbGetAll('client_transfer_requests');
    const duplicate = existingRequests.find(r => 
        r.clientId === clientId && 
        r.toUserId === toUserId && 
        r.status === 'PENDING'
    );

    if (duplicate) {
        throw new Error("Já existe uma solicitação pendente para este cliente.");
    }

    const newRequest: ClientTransferRequest = {
        id: crypto.randomUUID(),
        clientId,
        fromUserId,
        toUserId,
        status: 'PENDING',
        message: message || null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    // Persistir Local
    await dbPut('client_transfer_requests', newRequest);

    // Enfileirar Sync
    await enqueueSync({
        table: 'client_transfer_requests',
        type: 'INSERT',
        data: newRequest,
        rowId: newRequest.id
    });
    
    markDirty();

    return newRequest;
};

/**
 * Aprova a transferência, alterando o dono do cliente.
 */
export const approveClientTransfer = async (
    requestId: string,
    approverUserId: string
): Promise<void> => {
    const request = await dbGet('client_transfer_requests', requestId);
    if (!request) throw new Error("Solicitação não encontrada.");

    if (request.status !== 'PENDING') throw new Error("Solicitação não está pendente.");

    // Validação de segurança (conforme regra do prompt 2A-3, mas aplicada no serviço para garantir integridade)
    if (request.toUserId !== approverUserId) {
        throw new Error("Apenas o destinatário pode aprovar esta transferência.");
    }

    const client = await dbGet('clients', request.clientId);
    if (!client) throw new Error("Cliente não encontrado.");

    // 1. Atualizar Solicitação
    const updatedRequest: ClientTransferRequest = {
        ...request,
        status: 'APPROVED',
        updatedAt: new Date().toISOString()
    };

    // 2. Atualizar Cliente (Troca de Propriedade)
    const updatedClient: Client = {
        ...client,
        userId: request.toUserId, // Novo dono
        updatedAt: new Date().toISOString()
    };

    // Transação Atômica (Conceitual via Promises sequenciais no IndexedDB)
    await dbPut('client_transfer_requests', updatedRequest);
    await dbPut('clients', updatedClient);

    // Enfileirar Syncs
    await enqueueSync({
        table: 'client_transfer_requests',
        type: 'UPDATE',
        data: updatedRequest,
        rowId: updatedRequest.id
    });

    await enqueueSync({
        table: 'clients',
        type: 'UPDATE',
        data: updatedClient,
        rowId: updatedClient.id
    });

    markDirty();
};

/**
 * Rejeita a transferência.
 */
export const rejectClientTransfer = async (
    requestId: string,
    rejectorUserId: string // Pode ser usado para log/validação futura
): Promise<void> => {
    const request = await dbGet('client_transfer_requests', requestId);
    if (!request) throw new Error("Solicitação não encontrada.");

    if (request.status !== 'PENDING') throw new Error("Solicitação não está pendente.");

    // Atualizar Solicitação
    const updatedRequest: ClientTransferRequest = {
        ...request,
        status: 'REJECTED',
        updatedAt: new Date().toISOString()
    };

    await dbPut('client_transfer_requests', updatedRequest);

    await enqueueSync({
        table: 'client_transfer_requests',
        type: 'UPDATE',
        data: updatedRequest,
        rowId: updatedRequest.id
    });

    markDirty();
};

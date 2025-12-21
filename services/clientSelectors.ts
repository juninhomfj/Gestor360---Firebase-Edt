
import { dbGetAll } from '../storage/db';
import { Client, ClientTransferRequest } from '../types';

/**
 * Retorna todos os clientes que pertencem ao usuário fornecido.
 */
export const getMyClients = async (userId: string): Promise<Client[]> => {
    const allClients = await dbGetAll('clients');
    // Filtra por userId e garante que não estão deletados
    return allClients.filter(c => c.userId === userId && !c.deleted);
};

/**
 * Retorna as solicitações de transferência pendentes DIRECIONADAS ao usuário.
 * (Situação onde alguém quer transferir um cliente PARA mim, e eu preciso aprovar)
 */
export const getClientsSharedWithMe = async (userId: string): Promise<ClientTransferRequest[]> => {
    const allRequests = await dbGetAll('client_transfer_requests');
    return allRequests.filter(req => 
        req.toUserId === userId && 
        req.status === 'PENDING'
    );
};

/**
 * Retorna solicitações que EU fiz para outros usuários (aguardando aprovação deles).
 */
export const getMySentTransferRequests = async (userId: string): Promise<ClientTransferRequest[]> => {
    const allRequests = await dbGetAll('client_transfer_requests');
    return allRequests.filter(req => 
        req.fromUserId === userId && 
        req.status === 'PENDING'
    );
};

/**
 * Busca clientes pelo nome para fins de solicitação de transferência.
 * Retorna apenas dados públicos/seguros (ID, Nome, ID do Dono).
 * Ignora clientes que já são do próprio usuário ou estão deletados.
 */
export const searchClientsByName = async (
    term: string, 
    currentUserId: string
): Promise<Pick<Client, 'id' | 'name' | 'userId'>[]> => {
    if (!term || term.length < 2) return [];

    const allClients = await dbGetAll('clients');
    const lowerTerm = term.toLowerCase();

    return allClients
        .filter(c => 
            c.name.toLowerCase().includes(lowerTerm) && 
            c.userId !== currentUserId && // Não buscar meus próprios clientes
            !c.deleted
        )
        .map(c => ({
            id: c.id,
            name: c.name,
            userId: c.userId
        }))
        .slice(0, 10); // Limita resultados
};

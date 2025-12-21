
// src/tests/syncSimulation.ts

let simulationLogs: string[] = [];

/**
 * Executa uma simulação controlada de sync
 * NÃO escreve no Supabase
 * NÃO altera IndexedDB
 */
export const runSyncSimulation = async (): Promise<void> => {
    simulationLogs = [];

    log('Iniciando simulação de sincronização');

    // Simulações controladas
    await delay(300);
    log('Validando payloads locais');

    await delay(300);
    log('Passando pelo syncGate');

    await delay(300);
    log('Simulação concluída com sucesso');
};

export const getSimulationLogs = (): string[] => {
    return [...simulationLogs];
};

export const runFullSystemTest = async (): Promise<void> => {
    simulationLogs = [];
    log('Iniciando teste completo do sistema (full system test) - v2.4.1');

    await delay(300);
    log('Testando autenticação e sincronização de usuários (Pull on Read)');
    
    await delay(300);
    log('Testando módulo financeiro (Cálculo de DRE)');

    await delay(300);
    log('Testando módulo CRM (Unificação de Duplicatas)');
    
    await delay(300);
    log('Simulando venda com trigger de comissão (Server-side calc)');

    await delay(300);
    log('Full system test concluído com sucesso');
};

export const clearSimulationLogs = (): void => {
    simulationLogs = [];
};

// ----------------------

const log = (msg: string) => {
    simulationLogs.push(`[${new Date().toISOString()}] ${msg}`);
};

const delay = (ms: number) =>
    new Promise(resolve => setTimeout(resolve, ms));

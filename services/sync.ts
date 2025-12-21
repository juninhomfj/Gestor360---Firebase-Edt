
export const markDirty = () => {
    // No-op: O Firebase SDK gerencia a sincronização em tempo real.
};

export const syncWhatsAppToDrive = async () => {
    return { success: true, message: "Sincronização nativa Firebase ativa." };
};

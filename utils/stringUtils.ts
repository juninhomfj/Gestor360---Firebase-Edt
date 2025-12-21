
/**
 * Converte chaves de objeto (camelCase) para snake_case recursivamente.
 * Útil para preparar payloads para APIs que esperam convenção snake_case (ex: Supabase/Postgres).
 */
export const toSnakeCase = (obj: any): any => {
    if (typeof obj !== 'object' || obj === null) return obj;
    if (Array.isArray(obj)) return obj.map(toSnakeCase);
    
    const newObj: any = {};
    for (const key in obj) {
        // Converte a chave: myFieldName -> my_field_name
        let newKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
        newObj[newKey] = toSnakeCase(obj[key]);
    }
    return newObj;
};

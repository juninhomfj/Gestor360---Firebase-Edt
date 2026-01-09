
import { 
    collection, query, where, getDocs, doc, 
    setDoc, serverTimestamp, getDoc, updateDoc, 
    limit, orderBy 
} from "firebase/firestore";
import { db, auth } from "./firebase";
import { Company, FiscalPeriod, TaxEstimate, TaxRule, Obligation, TaxRegime } from "../types";
import { dbPut, dbGetAll } from "../storage/db";
import { Logger } from "./logger";
import { sanitizeForFirestore } from "../utils/firestoreUtils";
import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase";

export const getCompany = async (userId: string): Promise<Company | null> => {
    try {
        const q = query(collection(db, "companies"), where("userId", "==", userId), limit(1));
        const snap = await getDocs(q);
        if (snap.empty) return null;
        const data = { id: snap.docs[0].id, ...snap.docs[0].data() } as Company;
        await dbPut('companies', data);
        return data;
    } catch (e) {
        console.error("FiscalService Error:", e);
        return null;
    }
};

export const saveCompany = async (company: Company): Promise<void> => {
    const ref = doc(db, "companies", company.id);
    const data = sanitizeForFirestore(company);
    await setDoc(ref, { ...data, updatedAt: serverTimestamp() }, { merge: true });
    await dbPut('companies', company);
    Logger.info(`Fiscal: Empresa ${company.cnpj} salva.`);
};

export const fetchCnpjData = async (cnpj: string) => {
    const fetchFn = httpsCallable(functions, 'fetchCnpjData');
    const res = await fetchFn({ cnpj: cnpj.replace(/\D/g, '') });
    return res.data;
};

export const getFiscalPeriods = async (companyId: string): Promise<FiscalPeriod[]> => {
    const q = query(collection(db, "fiscal_periods"), where("companyId", "==", companyId), orderBy("year", "desc"), orderBy("month", "desc"));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as FiscalPeriod));
};

export const saveFiscalPeriod = async (period: FiscalPeriod): Promise<void> => {
    const ref = doc(db, "fiscal_periods", period.id);
    await setDoc(ref, sanitizeForFirestore(period), { merge: true });
    await dbPut('fiscal_periods', period);
};

export const calculateTaxes = async (period: FiscalPeriod, regime: TaxRegime): Promise<TaxEstimate> => {
    // 1. Busca Regras do Regime
    const q = query(collection(db, "tax_rules"), where("regime", "==", regime), where("isActive", "==", true), limit(1));
    const snap = await getDocs(q);
    
    let rules: TaxRule | null = null;
    if (!snap.empty) rules = { id: snap.docs[0].id, ...snap.docs[0].data() } as TaxRule;

    const items: any[] = [];
    let total = 0;

    if (regime === 'SIMPLES_NACIONAL') {
        const rate = 0.06; // Mock base - em produção buscaria tiers
        const val = period.grossRevenue * rate;
        items.push({ label: 'DAS (Simples Nacional)', value: val, rate: rate * 100 });
        total = val;
    } else {
        // Lucro Presumido Mock
        const pis = period.grossRevenue * 0.0065;
        const cofins = period.grossRevenue * 0.03;
        items.push({ label: 'PIS', value: pis, rate: 0.65 });
        items.push({ label: 'COFINS', value: cofins, rate: 3.0 });
        total = pis + cofins;
    }

    const estimate: TaxEstimate = {
        id: crypto.randomUUID(),
        userId: period.userId,
        companyId: period.companyId,
        periodId: period.id,
        regimeTributario: regime,
        rulesVersion: rules?.version || 'v1',
        items,
        total,
        generatedAt: new Date().toISOString()
    };

    // Salva estimativa no Firestore para histórico (Admin-only write rule handles this via functions usually, but here we do via DEV logic)
    if (auth.currentUser) {
        await setDoc(doc(db, "tax_estimates", estimate.id), sanitizeForFirestore(estimate));
    }

    return estimate;
};

export const getObligations = async (companyId: string): Promise<Obligation[]> => {
    const q = query(collection(db, "obligations"), where("companyId", "==", companyId), orderBy("dueDate", "asc"));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Obligation));
};

export const saveObligation = async (ob: Obligation): Promise<void> => {
    await setDoc(doc(db, "obligations", ob.id), sanitizeForFirestore(ob));
};

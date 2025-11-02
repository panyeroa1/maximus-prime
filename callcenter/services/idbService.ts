import { Agent, Voice, CallLog, TtsGeneration, ChatMessage, Feedback, AgentFeedback } from '../types';

const DB_NAME = 'EburonStudioDB';
const DB_VERSION = 3; // Incremented version for schema change
const AGENTS_STORE = 'agents';
const VOICES_STORE = 'voices';
const CALL_LOGS_STORE = 'call_logs';
const TTS_GENERATIONS_STORE = 'tts_generations';
const CHATBOT_MESSAGES_STORE = 'chatbot_messages';
const FEEDBACK_STORE = 'feedback';
const AGENT_FEEDBACK_STORE = 'agent_feedback';


let db: IDBDatabase | null = null;

const openDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        if (db) {
            return resolve(db);
        }

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const tempDb = (event.target as IDBOpenDBRequest).result;
            if (!tempDb.objectStoreNames.contains(AGENTS_STORE)) {
                tempDb.createObjectStore(AGENTS_STORE, { keyPath: 'id' });
            }
            if (!tempDb.objectStoreNames.contains(VOICES_STORE)) {
                tempDb.createObjectStore(VOICES_STORE, { keyPath: 'id' });
            }
            if (!tempDb.objectStoreNames.contains(CALL_LOGS_STORE)) {
                tempDb.createObjectStore(CALL_LOGS_STORE, { keyPath: 'call_id' });
            }
            if (!tempDb.objectStoreNames.contains(TTS_GENERATIONS_STORE)) {
                tempDb.createObjectStore(TTS_GENERATIONS_STORE, { keyPath: 'id' });
            }
            if (!tempDb.objectStoreNames.contains(CHATBOT_MESSAGES_STORE)) {
                tempDb.createObjectStore(CHATBOT_MESSAGES_STORE, { keyPath: 'id' });
            }
            if (!tempDb.objectStoreNames.contains(FEEDBACK_STORE)) {
                tempDb.createObjectStore(FEEDBACK_STORE, { keyPath: 'id', autoIncrement: true });
            }
            if (!tempDb.objectStoreNames.contains(AGENT_FEEDBACK_STORE)) {
                tempDb.createObjectStore(AGENT_FEEDBACK_STORE, { keyPath: 'id' });
            }
        };

        request.onsuccess = (event) => {
            db = (event.target as IDBOpenDBRequest).result;
            resolve(db);
        };

        request.onerror = (event) => {
            console.error('IndexedDB error:', (event.target as IDBOpenDBRequest).error);
            reject('Error opening IndexedDB.');
        };
    });
};

export const initDB = async () => {
    if (!db) {
        db = await openDB();
    }
};

const getAll = <T>(storeName: string): Promise<T[]> => {
    return new Promise(async (resolve, reject) => {
        const db = await openDB();
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.getAll();

        request.onsuccess = () => {
            resolve(request.result);
        };

        request.onerror = () => {
            console.error('Error getting all from store:', request.error);
            reject(request.error);
        };
    });
};

const upsertAll = <T>(storeName: string, items: T[]): Promise<void> => {
    return new Promise(async (resolve, reject) => {
        const db = await openDB();
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);

        items.forEach(item => {
            store.put(item);
        });

        transaction.oncomplete = () => {
            resolve();
        };

        transaction.onerror = () => {
            console.error('Error upserting items:', transaction.error);
            reject(transaction.error);
        };
    });
};

const deleteItem = (storeName: string, id: IDBValidKey): Promise<void> => {
    return new Promise(async (resolve, reject) => {
        const db = await openDB();
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.delete(id);
        
        request.onsuccess = () => {
            resolve();
        };

        request.onerror = () => {
            console.error('Error deleting item from store:', request.error);
            reject(request.error);
        };
    });
};

const clearStore = (storeName: string): Promise<void> => {
    return new Promise(async (resolve, reject) => {
        const db = await openDB();
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.clear();

        request.onsuccess = () => resolve();
        request.onerror = () => {
            console.error(`Error clearing store ${storeName}:`, request.error);
            reject(request.error);
        };
    });
};


// AGENTS
export const getAgentsFromIdb = (): Promise<Agent[]> => getAll<Agent>(AGENTS_STORE);
export const upsertAgentsToIdb = (agents: Agent[]): Promise<void> => upsertAll<Agent>(AGENTS_STORE, agents);
export const deleteAgentFromIdb = (agentId: string): Promise<void> => deleteItem(AGENTS_STORE, agentId);

// VOICES
export const getVoicesFromIdb = (): Promise<Voice[]> => getAll<Voice>(VOICES_STORE);
export const upsertVoicesToIdb = (voices: Voice[]): Promise<void> => upsertAll<Voice>(VOICES_STORE, voices);

// CALL LOGS
export const getCallLogsFromIdb = (): Promise<CallLog[]> => getAll<CallLog>(CALL_LOGS_STORE);
export const upsertCallLogsToIdb = (logs: CallLog[]): Promise<void> => upsertAll<CallLog>(CALL_LOGS_STORE, logs);

// TTS GENERATIONS
export const getTtsGenerationsFromIdb = (): Promise<TtsGeneration[]> => getAll<TtsGeneration>(TTS_GENERATIONS_STORE);
export const upsertTtsGenerationsToIdb = (generations: TtsGeneration[]): Promise<void> => upsertAll<TtsGeneration>(TTS_GENERATIONS_STORE, generations);

// CHATBOT MESSAGES
export const getChatbotMessagesFromIdb = (): Promise<ChatMessage[]> => getAll<ChatMessage>(CHATBOT_MESSAGES_STORE);
export const upsertChatbotMessagesToIdb = (messages: ChatMessage[]): Promise<void> => upsertAll<ChatMessage>(CHATBOT_MESSAGES_STORE, messages);
export const clearChatbotMessagesFromIdb = (): Promise<void> => clearStore(CHATBOT_MESSAGES_STORE);

// FEEDBACK
export const upsertFeedbackToIdb = (feedback: Feedback[]): Promise<void> => upsertAll<Feedback>(FEEDBACK_STORE, feedback);

// AGENT FEEDBACK
export const upsertAgentFeedbackToIdb = (feedback: AgentFeedback[]): Promise<void> => upsertAll<AgentFeedback>(AGENT_FEEDBACK_STORE, feedback);
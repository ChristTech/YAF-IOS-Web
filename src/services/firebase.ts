import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import {
  doc,
  enableNetwork,
  getDocFromServer,
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import {
  classifyFirestoreConnectionCheckError,
  isValidFirebaseClientConfig,
} from '../utils/fellowshipLogic';

export const FELLOWSHIP_ID = 'GIDEONITES';
export const ADMIN_DOC_ID = 'user-admin-01';
export const NAMED_DATABASE_ID =
  firebaseConfig.firestoreDatabaseId || 'ai-studio-android-youthali-dedc7e7c-c321-419b-be88-e862b3860a45';

const app = initializeApp(firebaseConfig);
let dbInstance: Firestore;
try {
  dbInstance = initializeFirestore(
    app,
    {
      experimentalAutoDetectLongPolling: true,
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    },
    NAMED_DATABASE_ID
  );
} catch {
  try {
    dbInstance = initializeFirestore(
      app,
      {
        experimentalAutoDetectLongPolling: true,
      },
      NAMED_DATABASE_ID
    );
  } catch {
    dbInstance = getFirestore(app, NAMED_DATABASE_ID);
  }
}
export const db: Firestore = dbInstance;
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null,
  silent = false
): FirestoreErrorInfo {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid ?? null,
      email: auth.currentUser?.email ?? null,
      emailVerified: auth.currentUser?.emailVerified ?? null,
      isAnonymous: auth.currentUser?.isAnonymous ?? null,
      tenantId: auth.currentUser?.tenantId ?? null,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));
  if (!silent) {
    throw new Error(JSON.stringify(errInfo));
  }
  return errInfo;
}

export async function reconnectFirestoreNetwork(): Promise<void> {
  try {
    await enableNetwork(db);
  } catch {
    // Non-fatal if already online or persistence not active
  }
}

export async function testConnection(options?: {
  forceEnableNetwork?: boolean;
}): Promise<boolean> {
  const configValid = isValidFirebaseClientConfig(firebaseConfig);
  if (!configValid) {
    console.error('Please check your Firebase configuration (missing or invalid project settings).');
    return false;
  }

  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  if (!isOnline) {
    // Expected offline PWA launch; cached persistence serves data until connectivity resumes.
    return false;
  }

  if (options?.forceEnableNetwork) {
    await reconnectFirestoreNetwork();
  }

  const probeServer = async (): Promise<unknown | null> => {
    try {
      await getDocFromServer(doc(db, 'test', 'connection'));
      return null;
    } catch (error) {
      return error;
    }
  };

  const firstError = await probeServer();
  if (!firstError) return true;

  const firstDisposition = classifyFirestoreConnectionCheckError({
    error: firstError,
    isNavigatorOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    isConfigValid: configValid,
    isRetryAttempt: false,
  });

  if (firstDisposition === 'reachable') return true;
  if (firstDisposition === 'offline_expected') return false;
  if (firstDisposition === 'invalid_config') {
    console.error('Please check your Firebase configuration.');
    return false;
  }

  // Transient cold-start WebChannel / IndexedDB lock race: wake network & retry once after brief backoff
  await reconnectFirestoreNetwork();
  await new Promise((resolve) => setTimeout(resolve, 1200));

  const onlineOnRetry = typeof navigator !== 'undefined' ? navigator.onLine : true;
  if (!onlineOnRetry) return false;

  const retryError = await probeServer();
  if (!retryError) return true;

  const retryDisposition = classifyFirestoreConnectionCheckError({
    error: retryError,
    isNavigatorOnline: onlineOnRetry,
    isConfigValid: configValid,
    isRetryAttempt: true,
  });

  if (retryDisposition === 'reachable') return true;
  if (retryDisposition === 'invalid_config') {
    console.error('Please check your Firebase configuration.');
    return false;
  }

  console.warn('Firestore server temporarily unreachable; operating with offline cache until network stabilizes.');
  return false;
}


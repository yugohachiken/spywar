import { doc, getDoc, setDoc, updateDoc, onSnapshot, deleteDoc } from 'firebase/firestore';
import { db, auth, ensureAuthenticatedUser } from '../firebase';
import { SpywarEngine, EngineConfig } from '../engine/SpywarEngine';
import { MultiplayerRoomDoc, RoomDefenseData } from '../types/spywar';

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

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export function sanitizeForFirestore<T>(data: T): T {
  if (data === undefined) {
    return null as any;
  }
  if (data === null || typeof data !== 'object') {
    return data;
  }
  if (Array.isArray(data)) {
    return data.map(item => (item === undefined ? null : sanitizeForFirestore(item))) as any;
  }
  const clean: Record<string, any> = {};
  for (const [key, val] of Object.entries(data as Record<string, any>)) {
    if (val !== undefined) {
      clean[key] = sanitizeForFirestore(val);
    }
  }
  return clean as T;
}

// Generate 6-character room code like 'SPY482'
export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'SPY';
  for (let i = 0; i < 3; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export async function createMultiplayerRoom(
  hostName: string,
  config?: Partial<EngineConfig>
): Promise<{ roomId: string; roomDoc: MultiplayerRoomDoc }> {
  const user = await ensureAuthenticatedUser();
  const roomId = generateRoomCode();
  
  const engine = new SpywarEngine(config);
  engine.setGameMode('online_multiplayer');
  engine.players[0].name = hostName.trim() || 'Agent 1';
  engine.players[1].name = 'Waiting for Agent 2...';
  engine.setupGame();

  const now = new Date().toISOString();
  const roomData: MultiplayerRoomDoc = {
    roomId,
    status: 'waiting',
    hostUid: user.uid,
    hostName: hostName.trim() || 'Agent 1',
    guestUid: '',
    guestName: '',
    currentRound: engine.currentRound,
    activePlayerIndex: engine.activePlayerIndex,
    currentPhase: engine.currentPhase,
    actionCounter: engine.actionCounter,
    gameOver: engine.gameOver,
    winner: '',
    winReason: '',
    engineState: engine.toSerializable(),
    pendingDefense: null,
    lastActionText: `Match room created by ${hostName.trim() || 'Agent 1'}. Awaiting opponent...`,
    createdAt: now,
    updatedAt: now
  };

  const path = `rooms/${roomId}`;
  const roomRef = doc(db, 'rooms', roomId);
  try {
    await setDoc(roomRef, sanitizeForFirestore(roomData));
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }

  return { roomId, roomDoc: roomData };
}

export async function joinMultiplayerRoom(
  roomId: string,
  guestName: string
): Promise<MultiplayerRoomDoc> {
  const user = await ensureAuthenticatedUser();
  const cleanId = roomId.trim().toUpperCase();
  const path = `rooms/${cleanId}`;
  const roomRef = doc(db, 'rooms', cleanId);
  
  let snap;
  try {
    snap = await getDoc(roomRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }

  if (!snap.exists()) {
    throw new Error(`Room "${cleanId}" not found. Verify the code and try again.`);
  }

  const data = snap.data() as MultiplayerRoomDoc;

  // Check if room is already full with another player
  if (data.guestUid && data.guestUid !== user.uid && data.hostUid !== user.uid) {
    throw new Error(`Room "${cleanId}" is already full with two agents.`);
  }

  // If user is guest joining
  if (data.hostUid !== user.uid && (!data.guestUid || data.guestUid === user.uid)) {
    const updatedGuestName = guestName.trim() || 'Agent 2';
    const engineState = { ...data.engineState };
    if (engineState.players && engineState.players[1]) {
      engineState.players[1].name = updatedGuestName;
    }

    const updates: Partial<MultiplayerRoomDoc> = {
      guestUid: user.uid,
      guestName: updatedGuestName,
      status: 'playing',
      engineState,
      lastActionText: `${updatedGuestName} entered the room. Operation underway!`,
      updatedAt: new Date().toISOString()
    };

    try {
      await updateDoc(roomRef, sanitizeForFirestore(updates));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
    return { ...data, ...updates };
  }

  return data;
}

export function subscribeToMultiplayerRoom(
  roomId: string,
  onUpdate: (room: MultiplayerRoomDoc) => void,
  onError?: (error: Error) => void
): () => void {
  const cleanId = roomId.trim().toUpperCase();
  const path = `rooms/${cleanId}`;
  const roomRef = doc(db, 'rooms', cleanId);

  return onSnapshot(
    roomRef,
    (snap) => {
      if (snap.exists()) {
        onUpdate(snap.data() as MultiplayerRoomDoc);
      }
    },
    (err) => {
      console.error('Room subscription error:', err);
      if (onError) onError(err);
      handleFirestoreError(err, OperationType.GET, path);
    }
  );
}

export async function syncRoomState(
  roomId: string,
  engine: SpywarEngine,
  lastActionText?: string,
  pendingDefense?: RoomDefenseData | null
): Promise<void> {
  const cleanId = roomId.trim().toUpperCase();
  const path = `rooms/${cleanId}`;
  const roomRef = doc(db, 'rooms', cleanId);
  const now = new Date().toISOString();

  const updates: Partial<MultiplayerRoomDoc> = {
    engineState: engine.toSerializable(),
    currentRound: engine.currentRound,
    activePlayerIndex: engine.activePlayerIndex,
    currentPhase: engine.currentPhase,
    actionCounter: engine.actionCounter,
    gameOver: engine.gameOver,
    winner: engine.winner?.name || '',
    winReason: engine.winReason || '',
    status: engine.gameOver ? 'ended' : 'playing',
    pendingDefense: pendingDefense !== undefined ? pendingDefense : null,
    updatedAt: now
  };

  if (lastActionText) {
    updates.lastActionText = lastActionText;
  }

  try {
    await updateDoc(roomRef, sanitizeForFirestore(updates));
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteMultiplayerRoom(roomId: string): Promise<void> {
  const cleanId = roomId.trim().toUpperCase();
  const path = `rooms/${cleanId}`;
  const roomRef = doc(db, 'rooms', cleanId);
  try {
    await deleteDoc(roomRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}


export const onAuthStateChanged = (_auth: unknown, callback: (user: unknown) => void) => { queueMicrotask(() => callback({ uid: 'qa-user', email: 'qa@example.test' })); return () => {}; };
export const signOut = async () => { location.reload(); };
export const signInWithEmailAndPassword = async () => {};
export const createUserWithEmailAndPassword = async () => {};

import { getAuth } from 'firebase/auth';
import { resetTestFinanceWithBackup } from '../services/firestoreService';

(async () => {
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) {
    console.error('No authenticated user. Please sign in before running this script.');
    process.exit(1);
  }
  const uid = user.uid;
  try {
    await resetTestFinanceWithBackup(uid);
    console.log('Test finance data cleared, backup saved for uid', uid);
  } catch (e) {
    console.error('Error clearing test data:', e);
    process.exit(1);
  }
})();

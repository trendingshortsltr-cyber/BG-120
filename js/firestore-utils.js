/**
 * Firestore Utilities for Dashboard & Leaderboard
 */

let db = null;

export function setFirestore(firestore) {
  db = firestore;
}

/**
 * Fetch user profile from Firestore
 */
export async function getUserProfile(uid) {
  if (!db) throw new Error('Firestore not initialized');
  try {
    const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js');
    const userDoc = await getDoc(doc(db, 'users', uid));
    return userDoc.exists() ? userDoc.data() : null;
  } catch (error) {
    console.error('Error fetching user profile:', error);
    throw error;
  }
}

/**
 * Get user statistics (submissions, solved, accuracy)
 */
export async function getUserStats(uid) {
  if (!db) throw new Error('Firestore not initialized');
  try {
    const { collection, query, where, getDocs } = await import('https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js');
    
    const submissionsRef = collection(db, 'submissions');
    const q = query(submissionsRef, where('uid', '==', uid));
    const snapshot = await getDocs(q);
    
    let totalSubmissions = 0;
    let acceptedCount = 0;
    const solvedProblems = new Set();

    snapshot.forEach(doc => {
      const submission = doc.data();
      totalSubmissions++;
      if (submission.status === 'Accepted') {
        acceptedCount++;
        solvedProblems.add(submission.problemId);
      }
    });

    const accuracy = totalSubmissions > 0 ? ((acceptedCount / totalSubmissions) * 100).toFixed(1) : 0;

    return {
      totalSubmissions,
      accepted: acceptedCount,
      solved: solvedProblems.size,
      accuracy: parseFloat(accuracy)
    };
  } catch (error) {
    console.error('Error calculating user stats:', error);
    return { totalSubmissions: 0, accepted: 0, solved: 0, accuracy: 0 };
  }
}

/**
 * Fetch recent submissions for a user
 */
export async function getRecentSubmissions(uid, limit = 5) {
  if (!db) throw new Error('Firestore not initialized');
  try {
    const { collection, query, where, orderBy, limit: limitFn, getDocs } = 
      await import('https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js');
    
    const submissionsRef = collection(db, 'submissions');
    const q = query(
      submissionsRef,
      where('uid', '==', uid),
      orderBy('timestamp', 'desc'),
      limitFn(limit)
    );
    
    const snapshot = await getDocs(q);
    const submissions = [];
    snapshot.forEach(doc => {
      submissions.push({ id: doc.id, ...doc.data() });
    });
    return submissions;
  } catch (error) {
    console.error('Error fetching recent submissions:', error);
    return [];
  }
}

/**
 * Store a submission in Firestore
 */
export async function storeSubmission(uid, problemId, status, language = 'JavaScript') {
  if (!db) throw new Error('Firestore not initialized');
  try {
    const { collection, addDoc, serverTimestamp } = 
      await import('https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js');
    
    const submissionsRef = collection(db, 'submissions');
    const docRef = await addDoc(submissionsRef, {
      uid,
      problemId,
      status,
      language,
      timestamp: serverTimestamp()
    });
    return docRef.id;
  } catch (error) {
    console.error('Error storing submission:', error);
    throw error;
  }
}

/**
 * Fetch leaderboard (all users sorted by problems solved, then submissions)
 * Expects users collection with schema: uid, name, email, problemsSolved, totalSubmissions
 */
export async function getLeaderboard(limit = 50, currentUserUid = null) {
  if (!db) throw new Error('Firestore not initialized');
  try {
    const { collection, getDocs } = await import('https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js');
    
    const usersRef = collection(db, 'users');
    const snapshot = await getDocs(usersRef);
    
    const leaderboardData = [];
    
    snapshot.forEach(userDoc => {
      const user = userDoc.data();
      
      leaderboardData.push({
        uid: userDoc.id,
        name: user.name || user.username || 'User',
        email: user.email || '',
        problemsSolved: user.problemsSolved || 0,
        totalSubmissions: user.totalSubmissions || 0,
        isCurrentUser: userDoc.id === currentUserUid
      });
    });
    
    // Sort by problemsSolved (descending), then by totalSubmissions (descending)
    leaderboardData.sort((a, b) => {
      if (b.problemsSolved !== a.problemsSolved) {
        return b.problemsSolved - a.problemsSolved;
      }
      return b.totalSubmissions - a.totalSubmissions;
    });
    
    // Add ranking
    leaderboardData.forEach((user, index) => {
      user.rank = index + 1;
    });
    
    return leaderboardData.slice(0, limit);
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    return [];
  }
}
